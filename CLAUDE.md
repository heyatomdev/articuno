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
- **auth/** — Admin session auth, `SessionGuard`, `@GetSession()` decorator, `AuthJob` cleanup
- **admin/controllers/** — Admin panel routes (reuse existing services behind `SessionGuard`)
- **articles/** + **article-translations/** — Content with multilingual support
- **moderation/** — `ModerationPolicyService` (central policy) + `WebhookEventPublisher` (outbox)
- **reports/** — Polymorphic reports; thresholds trigger auto-moderation
- **analytics/** — `AnalyticsJob` aggregates `DailyStats` nightly
- **webhook/** — `WebhooksJob` delivers outbox events with exponential backoff

### Two Auth Systems (Never Mix Guards)

| | Public API | Admin Panel |
|---|---|---|
| Path prefix | `/articles`, `/tags`, … | `/admin/articles`, … |
| Auth | `X-API-Key` header | `sessionId` HTTP-only cookie |
| Guard | `TenantGuard` | `SessionGuard` |
| Decorator | `@GetTenant()` | `@GetSession()` |
| Tenant source | SHA-256 hashed key lookup | Session record |

`TenantMiddleware` runs globally except `/health` (GET) and `/admin/*` routes.

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

### Audit Logging

`AuditLoggerService.log()` is **fire-and-forget** — it never throws. Call it after every successful state-changing admin operation and do not guard the main flow on its result:

```typescript
await this.auditLogger.log({ tenantId, actorUserId: session.externalId, ... });
```

### Webhook Outbox Pattern

`WebhookEventPublisher` writes `WebhookEvent` records to the database. `WebhooksJob` (cron every 30s) delivers them with exponential backoff (`min(2^attempts, 300)` seconds), max 10 attempts. Dead-lettered events use sentinel date `9999-12-31`.

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
| `WebhooksJob` | Every 30s | Deliver pending webhook events |
| `AuthJob` | Hourly + 3 AM daily | Expire sessions; purge inactive (30d+) sessions |
| `AnalyticsJob` | Midnight UTC | Aggregate `DailyStats` per tenant |

## Configuration

Required env var: `DATABASE_URL` (PostgreSQL). See `.env.example` for all options.

Validation runs at startup via Joi (`src/configs/config.validation.ts`) — the app will fail fast on misconfigured env vars.

Key runtime settings:
- API docs: `GET /docs` (Swagger)
- Metrics: `GET /metrics` (Prometheus)
- Health: `GET /health`
- Global validation pipe: `whitelist: true, forbidNonWhitelisted: true`

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
5. Using `TenantGuard` on admin routes (use `SessionGuard`)
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
