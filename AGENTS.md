# Articuno Agent Guide

## Architecture Overview

**Articuno** is a multi-tenant CMS microservice built on **NestJS + Prisma + PostgreSQL**. Each tenant is completely isolated via `tenantId` fields across all models.

### Core Entities & Data Flow
- **Tenants**: Root containers with API keys (SHA-256 hashed), webhook URLs, and banned word lists
- **Articles/Comments**: Content with `ContentStatus` (DRAFT, PUBLISHED, UNDER_REVIEW, HIDDEN, BANNED)
- **Users**: External user references with `UserStatus` (ACTIVE, BANNED, SHADOW_BANNED)
- **WebhookEvent**: Outbox pattern for async delivery (exactly-once semantics)
- **Reports**: Polymorphic reports (ARTICLE/COMMENT/USER) with report count thresholds that trigger auto-moderation

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

## Key File Locations & Patterns

| Concept                  | Location                                                    | Key Insight                                     |
|--------------------------|-------------------------------------------------------------|-------------------------------------------------|
| Multi-tenant setup       | `src/modules/tenants/`                                      | Middleware + Guard + Decorator                  |
| Moderation logic         | `src/modules/moderation/moderation-policy.service.ts`       | Central policy enforcer                         |
| Webhook events           | `src/modules/moderation/webhook-event-publisher.service.ts` | Outbox pattern for consistency                  |
| Article/Comment services | `src/modules/articles/` & `src/modules/comments/`           | Use ModerationPolicyService for creation        |
| Banned words             | `src/modules/banned-worlds/`                                | Tenant-scoped word lists                        |
| Prisma schema            | `prisma/schema.prisma`                                      | All models have tenantId + enums at bottom      |
| Database setup           | Package.json scripts: `db:migrate`, `db:push`, `db:studio`  | Use `pnpm run db:studio` for visual exploration |

## Testing & Debugging

### Local Development
```bash
pnpm run start:dev        # Watch mode with hot reload
pnpm run test             # Unit tests (jest.config rootDir: "src")
pnpm run test:e2e         # E2E tests
pnpm run db:studio        # Prisma visual query explorer
```

### Common Debugging
- **401 Unauthorized**: Check x-api-key header and tenant.enabled = true
- **Data isolation issues**: Verify tenantId is filtered in WHERE clause
- **Webhook not sent**: Check WebhookEvent records in db:studio (nextRetryAt, attempts)
- **Content stuck in HIDDEN**: Check if user has SHADOW_BANNED status or banned words detected

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
- **Scheduling**: ScheduleModule enabled for cron jobs (see analytics.job.ts)

## Anti-Patterns to Avoid

1. **DO NOT** query without tenantId filter - you'll leak data across tenants
2. **DO NOT** store plain API keys - always hash with SHA-256
3. **DO NOT** bypass ModerationPolicyService - all content mutations should check banned words
4. **DO NOT** skip webhook enqueue - events ensure recipient systems stay in sync
5. **DO NOT** forget Content Status FSM - invalid transitions should be rejected by `isValidModerationTransition()`

