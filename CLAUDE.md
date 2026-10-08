# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Articuno is a **multi-tenant CMS microservice** (NestJS + Prisma + PostgreSQL) designed to run behind main websites (Tenants), providing article management, comments, moderation, webhooks, and analytics. The codebase lives entirely in `src/modules/` with 24 NestJS feature modules.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm run start:dev        # Watch mode (hot reload)
pnpm run start:debug      # Debug mode with inspector

# Build
pnpm run build            # Compile TypeScript + resolve @/* path aliases (tsc-alias)
pnpm run start:prod       # Run compiled output

# Database
pnpm run prisma:generate  # Regenerate Prisma client after schema changes
pnpm run db:seed          # Seed via prisma/seed.ts

# Code quality
pnpm run lint             # ESLint with auto-fix
pnpm run format           # Prettier formatting

# Tests
pnpm run test             # Unit tests (rootDir: src, matches *.spec.ts)
pnpm run test:watch       # Watch mode
pnpm run test:cov         # Coverage report
pnpm run test:e2e         # E2E tests (uses test/jest-e2e.json)
pnpm run test:debug       # Debug tests with --inspect-brk
```

> After any `prisma/schema.prisma` change, always run `pnpm run prisma:generate` before building or running tests.

## Architecture

### Module Layout

All feature code is in `src/modules/`. Each module follows:
```
modules/{domain}/
  ├── {domain}.module.ts
  ├── {domain}.controller.ts   # HTTP endpoints only
  ├── {domain}.service.ts      # Business logic
  └── dto/                     # class-validator DTOs
```

Key module groups:
- **tenants/** — Multi-tenancy middleware, guard, and `@GetTenant()` decorator
- **bastion/** — Admin auth against Bastion: `BastionUserGuard`, `BastionJwksService`, `@GetSession()` decorator
- **admin/controllers/** — Admin panel routes (reuse existing services behind `BastionUserGuard`)
- **articles/** + **article-translations/** — Content with multilingual support
- **moderation/** — `ModerationPolicyService` (central policy) + `WebhookEventPublisher` (outbox)
- **reports/** — Polymorphic reports; thresholds trigger auto-moderation
- **analytics/** — `AnalyticsJob` aggregates `DailyStats` nightly
- **webhook/** — `WebhooksJob` delivers outbox events with exponential backoff

### Two Auth Systems (Never Mix Guards)

| | Public API | Admin Panel |
|---|---|---|
| Path prefix | `/articles`, `/tags`, … | `/admin/articles`, … |
| Auth | `X-API-Key` header | `Authorization: Bearer` — Bastion user-JWT (RS256) |
| Guard | `TenantGuard` | `BastionUserGuard` |
| Decorator | `@GetTenant()` | `@GetSession()` |
| Tenant source | SHA-256 hashed key lookup | `Tenant.bastionTenantId` ← JWT `tenantId` claim |

The admin path is stateless: the token is verified against Bastion's cached JWKS, so
there is no session table, no cookie and no login endpoint in Articuno. The guard
JIT-upserts the admin as a `User` row because `Report.reporterId` / `Report.moderatorId`
are real foreign keys onto `users(externalId, tenantId)`.

`TenantMiddleware` runs globally except `/health` (GET) and `/admin/*` routes.

**Admin roles**: every admin controller declares `@Roles(CONTENT_ROLES | MODERATION_ROLES | ADMIN_ROLES)` (`bastion/decorators/roles.decorator.ts`), enforced by `BastionUserGuard`; no `@Roles` = ADMIN-only. AUTHOR+ articles/translations/categories/tags/stats; MODERATOR+ comments/reports/banned-words, DELETE of articles/categories/tags, article status UNDER_REVIEW/HIDDEN/BANNED; ADMIN+ users/audits/webhooks/notifications. Mirrors Meridian's `articuno-*` permissions.

**Rate limiting**: two named throttlers. `ApiThrottlerGuard` (global `APP_GUARD`) applies only `public` (`PUBLIC_THROTTLE_LIMIT`, default 1000/window) per tenant + IP, and skips routes that use `AdminThrottlerGuard` at class or method level. `AdminThrottlerGuard` applies only `default` (`THROTTLE_LIMIT`) per Bastion user. Probes are `@SkipThrottle({ public: true })`.

**Public API never sets status**: `Public*Dto` variants omit `status` (articles start DRAFT); status changes go through `/admin/*` and `isValidModerationTransition()`.

### Critical Invariant: tenantId in Every Query

**Every** database query must filter by `tenantId`. Omitting it leaks data across tenants:

```typescript
// Correct
await this.prisma.article.findFirst({ where: { id, tenantId } });

// Wrong — never do this
await this.prisma.article.findFirst({ where: { id } });
```

### Content Creation Flow (Moderation Required)

When creating articles or comments, always go through `ModerationPolicyService`:

```typescript
// 1. Check user status
const { isAllowed, suggestedCommentStatus } =
  await this.moderationPolicy.checkUserModeration(tenantId, externalUserId);

// 2. Check banned words
const { hasBannedWords } = await this.moderationPolicy.checkBannedWords(tenantId, content);

// 3. Apply final status, then enqueue webhook if auto-moderated
await this.webhookPublisher.publishCommentModerationEvent(...);
```

Auto-moderation thresholds: ≥5 reports → comment HIDDEN; ≥10 reports → article UNDER_REVIEW.

Concurrency: the article branch locks the row (`SELECT … FOR UPDATE`, tenant-scoped) before counting; the comment branch uses `increment` and hides via `updateMany … status: VISIBLE`, so exactly one report fires the event. Duplicate open reports are refused by the partial unique index `reports_open_reporter_target_key` (hand-written in migration `20261008120000_report_races_and_tenant_indexes`; P2002 → 409). Outbox events describing a change in a `$transaction` must be published with that `tx` (every `WebhookEventPublisher.publish*` takes it last). JIT user rows go through `PrismaService.ensureUser` (retries the upsert race on P2002).

### Audit Logging

`AuditLoggerService.log()` is **fire-and-forget** — it never throws. Call it after every successful state-changing admin operation and do not guard the main flow on its result:

```typescript
await this.auditLogger.log({ tenantId, actorUserId: session.externalId, ... });
```

### Webhook Outbox Pattern

`WebhookEventPublisher` writes `WebhookEvent` records to the database. `WebhooksJob` (cron every 30s) delivers them with exponential backoff (`min(2^attempts, 300)` seconds), max 10 attempts. Dead-lettered events use sentinel date `9999-12-31`.

- **Claim before send**: `WebhooksJob.claimDue()` takes up to 20 due rows with `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING id` and leases them for 5 min (`nextRetryAt` and `claimedUntil` pushed forward). Replicas and overlapping ticks get disjoint rows; a crashed worker's rows become due again when the lease expires. Every outcome update clears `claimedUntil`. Never read due rows with a plain `findMany`.
- **Resend respects the lease**: `resendOne` (409 if leased) and `resendAllFailed` (skips leased rows) never clear `nextRetryAt` on a row being delivered.
- **Due-rows index**: partial `webhook_events_due_idx ON ("nextRetryAt") WHERE "sentAt" IS NULL`, hand-written in migration `20261006120000_webhook_outbox_claim_and_retention` (Prisma can't express it — don't remove it from the DB).
- **Retention**: `WebhooksJob.retention()` (03:00) deletes delivered rows (`sentAt` older than `WEBHOOK_EVENT_RETENTION_DAYS`, default 30) in 5000-row `SKIP LOCKED` batches. Unsent and dead-lettered rows are never deleted.
- The job is a global worker across tenants; tenant-facing queries (`findAll`, `findOne`, resend) always filter by `tenantId`.

### FileHarbor (Image Uploads)

`FileHarborService` is stateless — pass `FileHarborConfig` on every call using per-tenant values:

```typescript
const config = { endpoint: tenant.fileharborEndpoint, apiKey: tenant.fileharborApiKey };
await this.fileHarborService.uploadImageIfProvided(file, 'article', externalId, config, existingUrl);
```

Supported types: JPEG, PNG, GIF, WebP (max 10 MB). `deleteImageSafely()` silently ignores 404s.

### Scheduled Jobs

| Job | Schedule | Purpose |
|---|---|---|
| `WebhooksJob` | Every 30s | Claim and deliver due webhook events |
| `WebhooksJob.retention` | 03:00 | Purge delivered webhook events past retention |
| `AnalyticsJob` | Midnight UTC | Aggregate `DailyStats` per tenant |

## Configuration

Required env var: `DATABASE_URL` (PostgreSQL). Pool: `DATABASE_POOL_MAX` (default 10 per replica), `DATABASE_POOL_TIMEOUT_MS` (default 5000). See `.env.example` for all options.

`SEED_DEFAULT_TENANT` (default false in production, true elsewhere) creates tenant `default` at boot; its API key is logged outside production only.

Validation runs at startup via Joi (`src/configs/config.validation.ts`) — the app will fail fast on misconfigured env vars.

Key runtime settings:
- API docs: `GET /docs` (Swagger)
- Metrics: `GET /metrics` on `METRICS_PORT` (default 9091), not on the API port — see below
- Health: `GET /health`
- Global validation pipe: `whitelist: true, forbidNonWhitelisted: true`

### Metrics

`src/modules/metrics/`, `@prometheus-io/client` directly (own `Registry`, default label `app=articuno`). `MetricsServer` serves `GET /metrics` with `node:http` on `METRICS_PORT` (default 9091), outside the Nest app: no guards, no TenantMiddleware, no CORS — and nothing on the API port (404 there). Isolation is the network's job: never publish 9091 on the host, nginx never proxies it; Prometheus scrapes `articuno:9091` on the internal Docker network. `MetricsMiddleware` (registered in `AppModule.configure`, all routes) records `http_request_duration_seconds` labelled by route pattern, never the raw URL; `/health*` and `/status` are skipped.

`articuno_webhook_outbox_events{state}` (gauge, `state` = `overdue` | `dead`, both always emitted) — one `$queryRaw` on `webhook_events` with `sentAt IS NULL`, computed lazily in `collect()` (no query until scraped; a DB error logs `warn` and keeps the previous value). `overdue` = `COALESCE(nextRetryAt, createdAt)` more than 2 minutes in the past (the job runs every 30s; dead-lettered and leased rows have `nextRetryAt` in the future, so they never count). `dead` = `nextRetryAt` equal to the dead-letter sentinel `9999-12-31T23:59:59Z` (`DEAD_LETTER_DATE` in `src/modules/webhook/webhook.constants.ts`, bound as a query parameter — its own file because `WebhooksJob` depends on `MetricsService`). Alerts: `articuno_webhook_outbox_events{state="overdue"} > 0 for 10m`; `increase(articuno_webhook_outbox_events{state="dead"}[1h]) > 0` — `dead` only drops via manual resend, so alert on its increase, not its level.

`articuno_webhook_delivery_attempts_total{result}` (counter, `result` = `success` | `failure` | `unconfigured` | `dead_lettered`, all four initialised to 0) — incremented by `WebhooksJob.processPendingWebhooks` once per claimed row, right **after** the outcome's `webhookEvent.update` resolves (a failed update counts nothing). `unconfigured` = tenant without `webhookUrl`/`webhookSecret` (rescheduled +1h, attempts still incremented); `dead_lettered` = row reached `MAX_ATTEMPTS` and got the sentinel, no send. Alert: `sum(rate(articuno_webhook_delivery_attempts_total{result="failure"}[15m])) / sum(rate(articuno_webhook_delivery_attempts_total[15m])) > 0.5 and sum(rate(articuno_webhook_delivery_attempts_total[15m])) > 0`.

## Code Conventions

- **Path alias**: Use `@/` for imports from `src/` (e.g., `import { X } from '@/modules/prisma/prisma.service'`)
- **Prettier**: single quotes, trailing commas
- **TypeScript**: strict null checks off, `noImplicitAny` off — rely on Prisma types for correctness
- **DTOs**: All request bodies use class-validator decorators; controllers never perform business logic
- **API keys**: Always store as SHA-256 hash — never plaintext
- **Content status FSM**: Use `isValidModerationTransition()` before any admin status change; valid transitions are enforced by `ModerationTransitionDto`

## Anti-Patterns

1. Querying without `tenantId` — data isolation violation
2. Storing plain API keys in the database
3. Bypassing `ModerationPolicyService` for content mutations
4. Skipping webhook enqueue after moderation actions
5. Using `TenantGuard` on admin routes (use `BastionUserGuard`)
6. Throwing from audit log call sites (it's fire-and-forget by design)
7. Hardcoding FileHarbor credentials (always read from `tenant.*` at runtime)

## Docs

- `docs/admin-api.md` — admin panel API reference
- `docs/article-moderation.md` — moderation workflow dettagliato
- `docs/comment-moderation.md` — comment moderation flow
- `docs/guida-integrazione-be-nestjs.md` — guida integrazione per app NestJS consumatrici
- `../docs/ARTICUNO_INTEGRATION.md` — integration guide per Claude (fonte di verità)
- `../docs/BASTION_INTEGRATION.md` — Bastion JWT/JWKS guide
- `../docs/CODING_STANDARDS.md` — NestJS conventions condivise
