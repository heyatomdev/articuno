# Articuno Agent Guide

## Architecture Overview

**Articuno** is a multi-tenant CMS microservice built on **NestJS + Prisma + PostgreSQL**. Each tenant is completely isolated via `tenantId` fields across all models.

### Core Entities & Data Flow
- **Tenants**: Root containers with API keys (SHA-256 hashed), webhook URLs, banned word lists, and optional FileHarbor image-storage config (`fileharborEndpoint`, `fileharborApiKey`)
- **Articles/Comments**: Content with `ContentStatus` (DRAFT, PUBLISHED, UNDER_REVIEW, HIDDEN, BANNED, VISIBLE)
- **Users**: External user references with `UserStatus` (ACTIVE, BANNED, SHADOW_BANNED) and `UserRole` (TENANT_ADMIN, SUPER_MODERATOR, EDITOR, MODERATOR, MEMBER)
- **AdminCredentials**: Bcrypt-hashed password + TOTP, account lockout after 5 failed attempts (15-min lockout). One-to-one with `User`.
- **SessionStorage**: Server-side session records (7-day TTL, `sessionId` cookie). Used exclusively by the Admin panel.
- **ApiKey**: Scoped API keys with `scopes[]`, soft-delete via `revokedAt`.
- **AuditLog**: Immutable audit trail for all admin actions. Keyed by `tenantId + actorUserId + action + resourceType`.
- **WebhookEvent**: Outbox pattern for async delivery (exactly-once semantics)
- **Reports**: Polymorphic reports (ARTICLE/COMMENT/USER) with report count thresholds that trigger auto-moderation
- **Like / Bookmark / Notification**: Interaction models — `@@unique([articleId, userId])` prevents duplicates; `tenantId` denormalized for fast analytics queries.

**Critical Rule**: Every database query must filter by `tenantId` for isolation. Use pattern: `where: { id, tenantId }`.

### Multi-Tenant Pattern
```typescript
// Service method example - ALWAYS scope queries
await this.prisma.article.findFirst({ 
  where: { id: articleId, tenantId } 
});
```

## Cross-Service Communication & Moderation

### Moderation Policy (Single Responsibility)
`ModerationPolicyService` centralizes all moderation logic:
- **User status checks**: Returns `isAllowed`, `userStatus`, `suggestedCommentStatus` 
- **Banned word scanning**: Uses `BannedWordsService.checkText()` against tenant-specific word lists
- **Auto-moderation triggers**: Shadow bans hide content automatically; report thresholds transition content status
- **State validation**: `isValidModerationTransition()` enforces content status FSM

### Webhook Events (Outbox Pattern)
`WebhookEventPublisher` enqueues events for async delivery:
- Created as database records with `sentAt`, `attempts`, `nextRetryAt` tracking
- Published on moderator actions: `comment.moderated`, `article.flagged`, `article.status_changed`
- Signed with HMAC using tenant's `webhookSecret` (client validates signature)
- Webhook delivery is separate concern (not in this service - check webhook module)

## Request Flow & Authentication

Two separate authentication systems coexist:

### Public API (x-api-key)
1. **TenantMiddleware** extracts `x-api-key` header (exception: GET /health excluded)
2. Queries tenant by hashed API key: `{ apiKey, enabled: true }`
3. Attaches `tenant` object to `req['tenant']` for entire request scope
4. Use `@GetTenant()` decorator in controllers to access: `constructor(private readonly tenantService: TenantService) {}`

```typescript
// Controller pattern
@Post('articles')
@UseGuards(TenantGuard)
async create(
  @GetTenant() tenant: Tenant,
  @Body() createArticleDto: CreateArticleDto,
) {
  // tenant.id available here
}
```

### Admin Panel (session cookie)
1. Admin posts credentials to `POST /admin/auth/login` → `AuthService` validates bcrypt password + lockout state
2. `SessionStorage` record created; `sessionId` set as HTTP-only cookie (7-day TTL)
3. `SessionGuard` validates cookie on every `/admin/*` request, updates `lastAccessedAt`
4. Use `@GetSession()` decorator to access session data (includes `tenantId`, `userRole`, `externalId`)
5. `AuthJob` runs scheduled cleanup: expired sessions hourly, inactive sessions daily

```typescript
// Admin controller pattern
@Controller('admin/articles')
@UseGuards(SessionGuard)
export class AdminArticlesController {
  @Get()
  findAll(@GetSession() session: SessionStorage) {
    return this.articlesService.findAll(session.tenantId);
  }
}
```

| Aspect | Public API | Admin API |
|---|---|---|
| Path prefix | `/articles`, `/tags`, … | `/admin/articles`, `/admin/tags`, … |
| Auth header/cookie | `X-API-Key` header | `sessionId` cookie |
| Guard | `TenantGuard` | `SessionGuard` |
| Tenant source | SHA-256 hashed API key | Session record |

## Critical Workflows for Development

### Content Creation with Moderation
1. Check user status: `moderationPolicy.checkUserModeration(tenantId, externalUserId)`
2. Check banned words: `moderationPolicy.checkBannedWords(tenantId, content)`
3. Apply creation policy: Returns `finalStatus` (VISIBLE for normal, HIDDEN for violations)
4. Publish webhook if auto-moderated: `webhookPublisher.publishCommentModerationEvent(...)`

### Report & Auto-Moderation
- When `reportCount >= THRESHOLD` (5 for comments, 10 for articles):
  - Comments: Auto-transition to HIDDEN status
  - Articles: Transition to UNDER_REVIEW status
  - Trigger webhook: `publishArticleFlaggedEvent()` or `publishCommentHiddenEvent()`

### Article Translation Handling
- Articles have `ArticleTranslation` (per language per tenant)
- Slug uniqueness: `@@unique([tenantId, slug])` prevents collisions across translations
- Always include translations in responses: `include: { translations: { orderBy: { languageCode: 'asc' } } }`

### Audit Logging (Fire-and-Forget)
`AuditLoggerService.log()` writes to `AuditLog` and **never throws** — a failed write logs a warning but does not abort the main request flow.

```typescript
// Always call after successful state-changing admin operations
await this.auditLogger.log({
  tenantId, actorUserId: session.externalId, actorRole: session.userRole,
  action: AuditAction.ARTICLE_STATUS_CHANGED,
  resourceType: AuditResourceType.ARTICLE,
  resourceId: article.id,
  resourceName: article.translations[0]?.title,
  changeSummary: `Status: ${before} → ${after}`,
});
```

### FileHarbor Image Uploads
Tenant-level config (`fileharborEndpoint`, `fileharborApiKey`) enables per-tenant image storage. Pass the `FileHarborConfig` object to `FileHarborService` methods — the service is stateless.

```typescript
const config: FileHarborConfig = { endpoint: tenant.fileharborEndpoint, apiKey: tenant.fileharborApiKey };
const url = await this.fileHarborService.uploadImageIfProvided(file, 'article', externalId, config, existingUrl);
```
- Allowed types: JPEG, PNG, GIF, WebP (max 10 MB)
- `deleteImageSafely()` silently ignores 404s (already-deleted files)

## Key File Locations & Patterns

| Concept                  | Location                                                    | Key Insight                                     |
|--------------------------|-------------------------------------------------------------|-------------------------------------------------|
| Multi-tenant setup       | `src/modules/tenants/`                                      | Middleware + Guard + Decorator                  |
| Moderation logic         | `src/modules/moderation/moderation-policy.service.ts`       | Central policy enforcer                         |
| Webhook events           | `src/modules/moderation/webhook-event-publisher.service.ts` | Outbox pattern for consistency                  |
| Article/Comment services | `src/modules/articles/` & `src/modules/comments/`           | Use ModerationPolicyService for creation        |
| Banned words             | `src/modules/banned-words/`                                 | Tenant-scoped word lists                        |
| Prisma schema            | `prisma/schema.prisma`                                      | All models have tenantId + enums at bottom      |
| Database setup           | Package.json scripts: `db:seed`, `prisma:generate`          | Use `pnpm run db:studio` for visual exploration |
| Admin auth               | `src/modules/auth/`                                         | Session-based login, `AuthJob` for cleanup      |
| Admin panel controllers  | `src/modules/admin/controllers/`                            | Reuse existing services via `SessionGuard`      |
| Session guard/decorator  | `src/modules/auth/guards/session.guard.ts`, `src/modules/auth/decorators/get-session.decorator.ts` | Cookie-based admin auth |
| Audit logging            | `src/modules/audits/audit-logger.service.ts`                | Fire-and-forget; import `AuditsModule`          |
| Image uploads            | `src/modules/fileharbor/fileharbor.service.ts`              | Stateless; pass `FileHarborConfig` per call     |
| Interactions             | `src/modules/interactions/`                                 | Like/bookmark toggle; idempotent upsert         |
| Analytics                | `src/modules/analytics/`                                    | `DailyStats` aggregation; cron via `AnalyticsJob` |
| Reports                  | `src/modules/reports/`                                      | Polymorphic targets; threshold auto-moderation  |

## Testing & Debugging

### Local Development
```bash
pnpm run start:dev        # Watch mode with hot reload
pnpm run test             # Unit tests (jest.config rootDir: "src")
pnpm run test:e2e         # E2E tests
pnpm run db:studio        # Prisma visual query explorer (run separately via npx prisma studio)
pnpm run db:seed          # Seed database via prisma/seed.ts
pnpm run prisma:generate  # Regenerate Prisma client after schema changes
```

### Common Debugging
- **401 Unauthorized (public API)**: Check x-api-key header and tenant.enabled = true
- **401 Unauthorized (admin)**: Check `sessionId` cookie exists, session not expired, `AdminCredentials.disabledAt` is null
- **Account locked out**: `AdminCredentials.isLockedOut = true` + `lockedUntil` in future — auto-unlocks after 15 min
- **Data isolation issues**: Verify tenantId is filtered in WHERE clause
- **Webhook not sent**: Check WebhookEvent records in db:studio (nextRetryAt, attempts)
- **Content stuck in HIDDEN**: Check if user has SHADOW_BANNED status or banned words detected
- **Image upload failing**: Verify `tenant.fileharborEndpoint` and `tenant.fileharborApiKey` are populated; check file is JPEG/PNG/GIF/WebP ≤ 10 MB

## Module Structure

Each domain module follows pattern:
```
modules/{domain}/
  ├── {domain}.controller.ts    # HTTP endpoints
  ├── {domain}.service.ts        # Business logic
  ├── {domain}.module.ts         # NestJS module definition
  └── dto/                       # DTOs with class-validator decorators
```

All controllers use class-validator pipes with `whitelist: true, forbidNonWhitelisted: true` (strict DTO validation).

## Important Configuration

- **PORT**: Defaults to 3000 (env: PORT)
- **DATABASE_URL**: PostgreSQL connection string (migrations in `prisma/migrations/`)
- **CORS_ORIGIN**: Env var (default: '*'), allowedHeaders include x-api-key, x-user-id
- **Throttling**: Configured in AppModule with TTL & request limits
- **Scheduling**: ScheduleModule enabled for cron jobs (see `analytics.job.ts`, `auth.job.ts`)
- **FileHarbor**: Configured per-tenant (`fileharborEndpoint` / `fileharborApiKey` columns on `Tenant`)
- **Cookie parser**: `cookie-parser` middleware configured in `main.ts`; CORS set to `credentials: true`

## Anti-Patterns to Avoid

1. **DO NOT** query without tenantId filter - you'll leak data across tenants
2. **DO NOT** store plain API keys - always hash with SHA-256
3. **DO NOT** bypass ModerationPolicyService - all content mutations should check banned words
4. **DO NOT** skip webhook enqueue - events ensure recipient systems stay in sync
5. **DO NOT** forget Content Status FSM - invalid transitions should be rejected by `isValidModerationTransition()`
6. **DO NOT** throw from `AuditLoggerService.log()` callers on audit failure - it is fire-and-forget by design
7. **DO NOT** hardcode FileHarbor credentials - always read `tenant.fileharborEndpoint` / `tenant.fileharborApiKey` at runtime
8. **DO NOT** use `TenantGuard` on admin routes - use `SessionGuard` instead; the two auth paths are completely separate
