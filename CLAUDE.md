# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Articuno is a **multi-tenant CMS microservice** (NestJS + Prisma + PostgreSQL) designed to run behind main websites (Tenants), providing article management, comments, moderation, webhooks, and analytics. The codebase lives entirely in `src/modules/` with 22 NestJS feature modules.

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
- **bastion/** — Admin auth against Bastion: `BastionUserGuard` (extends the `@heyatom/bastion-client` guard, which owns the JWKS cache), `@GetSession()` decorator
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

**Admin roles**: every admin controller declares `@Roles(CONTENT_ROLES | MODERATION_ROLES | SUPER_ADMIN_ROLES)` (`bastion/decorators/roles.decorator.ts`), enforced by `BastionUserGuard`; no `@Roles` = SUPER_ADMIN-only. AUTHOR+ articles/translations/categories/tags/stats; MODERATOR+ comments/reports/banned-words, DELETE of articles/categories/tags, article status UNDER_REVIEW/HIDDEN/BANNED; SUPER_ADMIN only for users/audits/webhooks (Bastion's seed grants `articuno-users.manage` / `articuno-config.manage` to no role). Mirrors Meridian's `articuno-*` permissions. Full matrix: [docs/admin-roles.md](docs/admin-roles.md).

**Rate limiting**: admin routes only — `AdminThrottlerGuard` (`THROTTLE_LIMIT` per `THROTTLE_TTL_SECONDS`) per Bastion user. The public API is deliberately not throttled (server-to-server, every tenant backend shares one Docker IP; end users are rate-limited in the tenant site): [docs/DECISIONS.md D-001](docs/DECISIONS.md).

**Public API never sets status**: `Public*Dto` variants omit `status` (articles start DRAFT); status changes go through `/admin/*` and `isValidModerationTransition()`.

**Public API only reads PUBLISHED articles**: `GET /articles` and `GET /articles/:slug` go through `ArticlesService.findAllPublic` / `findOnePublic` (`PublicArticleFiltersQueryDto`): PUBLISHED by default, DRAFT only with `includeDrafts=true`, UNDER_REVIEW/HIDDEN/BANNED never (detail → 404). Admin routes keep `findAll` / `findOne` and see every status. The same rule (`publicArticleStatuses()` in `articles/article-visibility.ts`) gates the public `GET /articles/:id/translations[/:languageCode]`; likes, interaction status, bookmarks and views accept only PUBLISHED articles (404 otherwise). `POST /interactions/articles/:id/view` (no `X-User-Id`) is the only writer of `Article.views`: one raw `UPDATE … SET views = views + 1` so it doesn't bump `updatedAt`; the tenant calls it server-side and owns dedup/bot filtering. Public comments (`CommentsService.findAllPublic` / `findOnePublic`, `create`) follow it too: only comments of PUBLISHED articles, VISIBLE/UNDER_REVIEW only (`PublicCommentFiltersQueryDto.status` narrows to one of them); `GET /comments/:id` with `X-User-Id` equal to the author's `externalId` returns that author's comment whatever its or its article's status (gateways check ownership with it).

**Admin article create/update** (`POST /admin/articles`, `PATCH /admin/articles/:id`): the article JSON comes from **one place only**, by content type (`articlePayload` in `admin-articles.controller.ts`) — the whole body for JSON (a `data` field in it is rejected by the DTO whitelist), the `data` field alone for multipart (any other text field → 400 `INVALID_MULTIPART`, no `data` → 400). The old `@Body('data') ?? JSON.stringify(@Body())` fallback let a `status` sit where Meridian's BFF status check wasn't looking. `authorId` is a moderator's call (`canSetArticleAuthor`, `MODERATION_ROLES`, else 403), and `moderatorId` in `article.status_changed` is always `session.externalId`, never the body.

**Admin article list** (`GET /admin/articles`, `ArticleFiltersQueryDto`): on top of the shared filters it takes `search` (case-insensitive contains on a translation title, trimmed, max 100; with `languageCode` it shares the same `translations.some`, so the title must match in that language) and `sortBy` (`createdAt` default | `updatedAt` | `publishedAt`, nulls last | `views`) + `sortOrder` (`desc` default), built by `adminArticleOrderBy()` with an `id` tiebreak. The public DTO does not take them (400, `forbidNonWhitelisted`); for the same reason an older Articuno answers 400 to a Meridian that sends them — deploy Articuno first. `GET /admin/users` takes `externalId` (exact) next to `username` (contains): it turns an audit `actorUserId` back into a user.

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

- **The sentinel never leaves the service**: `/admin/webhooks` (list, detail, resend) maps every row through `toWebhookEventView()` (`webhook.constants.ts`): a dead-lettered row reads `nextRetryAt: null` + `deadLettered: true`. Before, the console printed the sentinel as `01/01/10000`. `GET /admin/stats/dashboard` carries `webhooks: { undelivered, deadLettered }` (tenant, all-time) so the console can raise dead letters on its dashboard.

- **Article lifecycle**: `publishArticleStatusChangedEvent` also calls `publishArticleLifecycleEvent` → `article.published` on every entry into PUBLISHED (the first one sets `publishedAt` via a conditional `updateMany … publishedAt: null`, payload `firstPublication: true`), `article.unpublished` on leaving PUBLISHED (only if `publishedAt` is set). Every article status change must go through it, in the same `tx`, after the status write. `create` as PUBLISHED calls `publishArticleLifecycleEvent` directly; `remove` reads `articleSummary` before the delete and publishes `article.deleted`.

- **Claim before send**: `WebhooksJob.claimDue()` takes up to 20 due rows with `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING id` and leases them for 5 min (`nextRetryAt` and `claimedUntil` pushed forward). Replicas and overlapping ticks get disjoint rows; a crashed worker's rows become due again when the lease expires. Every outcome update clears `claimedUntil`. Never read due rows with a plain `findMany`.
- **Resend respects the lease**: `resendOne` (409 if leased) and `resendAllFailed` (skips leased rows) never clear `nextRetryAt` on a row being delivered.
- **Due-rows index**: partial `webhook_events_due_idx ON ("nextRetryAt") WHERE "sentAt" IS NULL`, hand-written in migration `20261006120000_webhook_outbox_claim_and_retention` (Prisma can't express it — don't remove it from the DB).
- **Retention**: `WebhooksJob.retention()` (03:00) deletes delivered rows (`sentAt` older than `WEBHOOK_EVENT_RETENTION_DAYS`, default 30) in 5000-row `SKIP LOCKED` batches. Unsent and dead-lettered rows are never deleted.
- The job is a global worker across tenants; tenant-facing queries (`findAll`, `findOne`, resend) always filter by `tenantId`.
- **SSRF guard** (`@heyatom/nest-common/webhooks`): `WebhooksService.send` runs `checkWebhookUrl` (https, no credentials, no literal private IP) and posts through `postWebhook` (every DNS answer must be public, checked at connect time; no redirects, a 3xx is a failure; 5 s total timeout). A refused target returns `'blocked'` (a `DNS_TRANSIENT` lookup is `'failed'` and retried) → dead-lettered at once (counted `dead_lettered`), never retried. `SEED_WEBHOOK_URL` goes through `assertPublicWebhookUrl` before the seed saves it. `WEBHOOK_ALLOW_PRIVATE_TARGETS=true` (development only, refused in production) admits private and `http://` targets. Logs carry the host, never the full URL.
- **Signature**: Standard Webhooks via `signStandardWebhook` + `postWebhook` (`@heyatom/nest-common/webhooks`): `webhook-id` = `WebhookEvent.id` (stable across retries/resends, receivers dedupe on it), `webhook-timestamp` = send time, `webhook-signature` = `v1,<base64 HMAC-SHA256 of id.timestamp.body>` keyed with `webhookSecret` as UTF-8. The body is serialized once and signed as sent. No legacy `x-webhook-signature`.

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

Migrations do **not** run in the Docker image (no `migrate deploy`, and `prisma` is pruned): apply them with `pnpm exec prisma migrate deploy` before starting a new version — see README › Deployment.

Validation runs at startup via Joi (`src/configs/config.validation.ts`) — the app will fail fast on misconfigured env vars.

Key runtime settings — the HTTP runtime is `@heyatom/nest-common` (platform standard `../docs/standards/api.md`); don't re-add local copies:
- Bootstrap: `setupHttpApp` in `main.ts` — shutdown hooks, `trust proxy` = `TRUST_PROXY_HOPS`, helmet, CORS allowlist `CORS_ORIGINS` (`X-API-Key`/`X-User-Id` deliberately **not** in `allowedHeaders`), JSON 1mb, global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`). The urlencoded limit (256kb) is set right after it. Old `CORS_ORIGIN` / `TRUST_PROXY=true` are still read as defaults.
- Errors: `AllExceptionsFilter` (`APP_FILTER`) → `{ statusCode, code, message, errors?, requestId }`. Domain errors declare an `UPPER_SNAKE` `code` (`throw new ConflictException({ code: 'SLUG_TAKEN', message })`); consumers branch on `code`, never on `message`. P2002 → 409, P2003 → 409, P2025 → 404 globally; anything non-HTTP → generic 500.
- **No `TransformInterceptor`**: responses are raw resources (no `{ data }` envelope) until the coordinated phase-3 migration with heyatom-client, dbdbuilds-api and Meridian.
- Logging: `loggerParams` (nestjs-pino), server-generated `X-Request-Id` on every response, `ip` kept on the request line; `LOG_LEVEL` default info in production, debug elsewhere.
- API docs: `GET /docs` only with `ENABLE_SWAGGER` (unset = on only for an explicit `NODE_ENV` development/test). `SWAGGER_OPTIONS` (`src/common/swagger.ts`) is shared with `pnpm openapi:dump`.
- Pagination: `PageParams` / `paginate()` / `ApiPaginatedResponse` from the package.
- Metrics: `GET /metrics` on `METRICS_PORT` (default 9091), not on the API port — see below
- Health: `GET /health`

### Metrics

`MetricsModule` from `@heyatom/nest-common/metrics` (own `Registry`, default label `app=articuno`) serves `GET /metrics` on `METRICS_PORT` (default 9091, `METRICS_HOST` unset = `::`), outside the Nest app: no guards, no TenantMiddleware, no CORS — and nothing on the API port (404 there). Isolation is the network's job: never publish 9091 on the host, nginx never proxies it; Prometheus scrapes `articuno:9091` on the internal Docker network. Its middleware records `http_request_duration_seconds` on every route, labelled by route pattern, never the raw URL; `/health*` is skipped. Domain metrics live in `WebhookMetrics` (`src/modules/webhook/webhook.metrics.ts`) on `MetricsService.registry`.

`articuno_webhook_outbox_events{state}` (gauge, `state` = `overdue` | `dead`, both always emitted) — one `$queryRaw` on `webhook_events` with `sentAt IS NULL`, computed lazily in `collect()` (no query until scraped; a DB error logs `warn` and keeps the previous value). `overdue` = `COALESCE(nextRetryAt, createdAt)` more than 2 minutes in the past (the job runs every 30s; dead-lettered and leased rows have `nextRetryAt` in the future, so they never count). `dead` = `nextRetryAt` equal to the dead-letter sentinel `9999-12-31T23:59:59Z` (`DEAD_LETTER_DATE` in `src/modules/webhook/webhook.constants.ts`, bound as a query parameter — its own file because `WebhooksJob` depends on `WebhookMetrics`). Alerts: `articuno_webhook_outbox_events{state="overdue"} > 0 for 10m`; `increase(articuno_webhook_outbox_events{state="dead"}[1h]) > 0` — `dead` only drops via manual resend, so alert on its increase, not its level.

`articuno_webhook_delivery_attempts_total{result}` (counter, `result` = `success` | `failure` | `unconfigured` | `dead_lettered`, all four initialised to 0) — incremented by `WebhooksJob.processPendingWebhooks` once per claimed row, right **after** the outcome's `webhookEvent.update` resolves (a failed update counts nothing). `unconfigured` = tenant without `webhookUrl`/`webhookSecret` (rescheduled +1h, attempts still incremented); `dead_lettered` = row reached `MAX_ATTEMPTS` and got the sentinel, no send, or the target was refused by the SSRF guard. Alert: `sum(rate(articuno_webhook_delivery_attempts_total{result="failure"}[15m])) / sum(rate(articuno_webhook_delivery_attempts_total[15m])) > 0.5 and sum(rate(articuno_webhook_delivery_attempts_total[15m])) > 0`.

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

- [docs/BACKLOG.md](docs/BACKLOG.md) — bug verificati e backlog prioritizzato
- [docs/DECISIONS.md](docs/DECISIONS.md) — decisioni e deviazioni dallo standard API (D-001 API pubblica senza throttler)
- [docs/admin-api.md](docs/admin-api.md) — admin panel API reference
- [docs/article-moderation.md](docs/article-moderation.md) — moderation workflow dettagliato
- [docs/comment-moderation.md](docs/comment-moderation.md) — comment moderation flow
- [docs/admin-roles.md](docs/admin-roles.md) — ruoli Bastion e matrice endpoint × ruolo di `/admin/*`
- [../docs/integrations/articuno.md](../docs/integrations/articuno.md) — integration guide di piattaforma (fonte di verità per chi integra Articuno; aggiornarla quando cambia il contratto)
- [../docs/standards/coding.md](../docs/standards/coding.md) — NestJS conventions condivise
- [src/modules/admin/README.md](src/modules/admin/README.md), [src/modules/webhook/tenant-validation.md](src/modules/webhook/tenant-validation.md) — note di modulo

## Platform integration guides

Services this repo calls (Bastion for admin JWT/JWKS and service-client auth, FileHarbor for image uploads):

@../docs/integrations/bastion.md
@../docs/integrations/fileharbor.md
