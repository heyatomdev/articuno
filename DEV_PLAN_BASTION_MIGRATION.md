# DEV_PLAN: Migrate Articuno Admin Auth to Bastion JWT (RS256)

> Status: DRAFT — for review before implementation
> Scope: `/admin/*` routes only. Public API (`X-API-Key` / `TenantMiddleware`) is unchanged.
> Reference implementations:
> - `docs/BASTION_INTEGRATION.md` (general Bastion integration guide)
> - `gatherly/src/modules/bastion/*` (production reference — this is the pattern we follow)

---

## 0. Executive Summary

Articuno's admin panel currently authenticates via a fully local system: `AdminCredentials` (email/password/bcrypt/TOTP secret) + `SessionStorage` (httpOnly `sessionId` cookie, 7-day TTL, DB-backed). This plan replaces it with **Bastion-issued RS256 JWTs**, validated locally via JWKS (no per-request call to Bastion), following the exact pattern already proven in Gatherly: a `BastionModule` with a `BastionJwksService` (JWKS fetch/cache/verify) and a `BastionAdminGuard` that protects all `/admin/*` controllers, rejecting machine (`service_client`) tokens and requiring an accepted `appSlug` + role.

Public API routes keep `TenantMiddleware` + `X-API-Key` untouched.

The migration is staged so each phase ships independently and the system can run in a **dual-guard mode** (session OR Bastion) controlled by an environment flag, giving an instant rollback path without a redeploy.

---

## 1. Current State

### 1.1 Auth module (`src/modules/auth/`)
- `auth.controller.ts` — `POST /admin/auth/login` (public), `DELETE /admin/auth/logout`, `POST /admin/auth/refresh`, `GET /admin/auth/me`, `PATCH /admin/auth/email`, `PATCH /admin/auth/password` — all but `login` behind `SessionGuard`.
- `auth.service.ts` — bcrypt password check against `AdminCredentials`, lockout after 5 failed attempts (15 min), creates/refreshes `SessionStorage` rows, 7-day TTL.
- `guards/session.guard.ts` — reads `sessionId` cookie, loads `SessionStorage` + `user`, checks expiry, updates `lastAccessedAt`, attaches `request.session = { id, userId, tenantId, userRole, externalId, expiresAt, ... }`.
- `decorators/get-session.decorator.ts` — `@GetSession()` returns `request.session`.
- `auth.job.ts` — cron: hourly cleanup of expired `SessionStorage` rows, daily cleanup of sessions inactive >30 days.
- No Bastion module exists. No `jose`/`jsonwebtoken` dependency.

### 1.2 Controllers protected by `SessionGuard` (12 total)
8 in `src/modules/admin/controllers/`: `admin-articles`, `admin-tags`, `admin-categories`, `admin-banned-words`, `admin-reports`, `admin-audits`, `admin-users`, `admin-comments`.
3 outside `admin/`: `webhooks.controller.ts`, `notifications.controller.ts`, `analytics.controller.ts`.
Plus `auth.controller.ts` itself (5 of 6 endpoints).

All use `@GetSession() session` and read `session.tenantId`, `session.userId`, `session.userRole`, `session.externalId`.

### 1.3 Prisma models affected
- `AdminCredentials` (1:1 with `User`): email/password hash/TOTP secret/lockout — **to be removed**.
- `SessionStorage` (`@@map("sessions")`): cookie-backed sessions — **to be removed**.
- `User`: stays. Has `externalId` + `tenantId` (compound unique), `role: UserRole`, is FK target for `Article.authorId`, `Comment`, `Report.moderatedBy`, `Notification`, etc.
- `AuditLog`: `actorUserId: String` (= `User.externalId`, not FK) + `actorRole: UserRole`. No schema change needed.
- `Tenant`: unchanged. Has unique `slug` — join key against Bastion's `tenantSlug` claim.

### 1.4 No role-based authorization exists
No `RolesGuard`/`@Roles()` decorator anywhere. `userRole` is used **only** for audit-trail annotation, never for gating actions. This significantly narrows migration blast radius.

---

## 2. Target Architecture

```
Admin browser
  └─► logs into Bastion (via Meridian or direct) — OUTSIDE Articuno
        └─► gets Bastion-issued RS256 JWT (human user token, no `type` field)
  └─► Authorization: Bearer <jwt>  ──►  Articuno  /admin/*
                                          └─► BastionAdminGuard
                                                ├─ verifies signature via JWKS (local, cached 1h)
                                                ├─ rejects `type === 'service_client'`
                                                ├─ checks payload.appSlug ∈ ADMIN_ACCEPTED_APP_SLUGS
                                                ├─ checks payload.role ∈ ADMIN_ACCEPTED_ROLES
                                                ├─ resolves Tenant by payload.tenantSlug
                                                ├─ JIT-upserts local User (externalId = payload.sub)
                                                └─ attaches request.adminSession (same shape as old session)
```

No Bastion HTTP call on hot path — JWKS cached. Faster than current SessionGuard DB lookup.

---

## 3. Design Decisions

### 3.1 New `BastionModule` structure (mirrors Gatherly)

```
src/modules/bastion/
  bastion.module.ts
  bastion-jwks.service.ts       # JWKS fetch + cache + RS256 verify (jose)
  bastion.types.ts              # JwtPayload interface
  guards/
    bastion-admin.guard.ts      # equivalent to Gatherly's BastionUserGuard
  decorators/
    get-admin-session.decorator.ts
```

Not needed initially: `bastion.service.ts` (service-client flow), `bastion-audit.service.ts`. Only required if centralized audit writes to Bastion become a requirement.

### 3.2 `BastionAdminGuard`

Modeled on Gatherly's `bastion-user.guard.ts`. Key difference: Gatherly resolves `Client` by `tenantId`; Articuno resolves `Tenant` by `slug` and JIT-upserts a local `User`.

Output: `request.adminSession` with same shape as old `request.session`:
```typescript
{ id, userId, tenantId, userRole, externalId, expiresAt }
```

This means **12 controllers need only two mechanical swaps each**: guard import + decorator name. Zero business logic changes.

### 3.3 JIT-provisioning of local `User` rows

```typescript
prisma.user.upsert({
  where: { externalId_tenantId: { externalId: payload.sub, tenantId } },
  update: { role: mapBastionRole(payload.role) },
  create: { externalId: payload.sub, tenantId, username: payload.username ?? payload.email, role: mapBastionRole(payload.role), status: 'ACTIVE' },
})
```

Performance: consider 60s in-memory cache to avoid upsert on every request.

### 3.4 Role mapping

Bastion roles are coarse (`ADMIN`, `OWNER`, `SUPER_ADMIN`). Articuno's `UserRole` is finer (`TENANT_ADMIN`, `SUPER_MODERATOR`, `EDITOR`, `MODERATOR`, `MEMBER`) but currently used **only for audit annotation**.

**Recommended (Option A)**: map all accepted Bastion roles → `TENANT_ADMIN`. Preserves current "any admin can do everything" behavior 1:1. Fine-grained RBAC is a separate follow-up if needed.

### 3.5 `AuditLog` continuity

`actorUserId = session.externalId` → post-migration = JIT-provisioned `User.externalId` = `payload.sub` (Bastion UUID). Same shape, stable identifier. No controller changes.

### 3.6 No local login endpoints

Matches Gatherly exactly. `auth.controller.ts` shrinks to at most `GET /admin/auth/me` reading `request.adminSession`. Password/email/2FA management → Bastion directly.

### 3.7 Environment variables

```env
BASTION_URL=http://bastion:3001
BASTION_APP_SLUG=articuno
BASTION_JWKS_TTL_MS=3600000
ADMIN_ACCEPTED_APP_SLUGS=articuno,meridian
ADMIN_ACCEPTED_ROLES=ADMIN,OWNER,SUPER_ADMIN
```

---

## 4. Phased Implementation

### Phase 0 — Bastion-side prep (no Articuno code)
- Register `articuno` as App in Bastion.
- Configure `ADMIN_ACCEPTED_ROLES`.
- Confirm which console issues admin tokens (Meridian?).
- Confirm `BASTION_URL` reachable from Articuno runtime.
- **Deliverable**: test admin user with accepted role exists in Bastion.

### Phase 1 — Build `BastionModule`, deploy dormant
- `pnpm add jose`
- Create all files from §3.1.
- Unit tests for guard (mirror Gatherly's `bastion-user.guard.spec.ts`).
- Add env vars to config validation (optional at this phase).
- **Not wired into any controller.** Zero behavior change.

### Phase 2 — Dual-guard cutover switch
- Introduce `AdminAuthGuard` composite: delegates to `SessionGuard` or `BastionAdminGuard` based on `AUTH_MODE` env (`session` | `bastion` | `dual`).
- `dual` mode: try Bearer first, fall back to session cookie.
- Swap all 12 controllers: `SessionGuard` → `AdminAuthGuard`, `@GetSession()` → compatibility decorator.
- Deploy with `AUTH_MODE=session` — functionally identical.
- Flip to `dual` in staging, validate with real Bastion tokens.

### Phase 3 — Frontend cutover (external)
- Admin panel switches to Bastion Bearer tokens.
- Run `AUTH_MODE=dual` in production during transition.
- Monitor JWKS failures and guard rejection rates.

### Phase 4 — Full cutover
- Flip `AUTH_MODE=bastion` when 100% traffic uses Bearer.
- Session code path unreachable but present for rollback.
- Bake 1-2 weeks.

### Phase 5 — Cleanup (irreversible parts last)
- 5a. Remove `SessionGuard`, `AuthService` login/refresh/logout, `AuthJob`, `AdminAuthGuard` session branch, `AUTH_MODE` flag, `PasswordService` (if no other callers).
- 5b. Prisma migration: drop `AdminCredentials` + `SessionStorage` tables. **Full DB backup before this step.**
- Update Swagger config: drop `.addCookieAuth()`.
- Remove `bcrypt` dependency if unused.

### Phase 6 — Hardening (optional follow-ups)
- Fine-grained RBAC (§3.4 Option B).
- Admin-specific throttling.
- Centralized audit via service-client flow.

---

## 5. Data Migration (`AdminCredentials` → Bastion)

1. **Export**: `AdminCredentials JOIN User JOIN Tenant` → `{ email, tenantSlug, role, totpEnabled }`.
2. **Provision in Bastion**: create users via Bastion admin API, random initial password, assign role.
3. **Force password reset**: trigger Bastion invite/forgot-password flow. Communicate deadline.
4. **2FA re-enrollment**: TOTP secrets not portable. Admins with `totpEnabled=true` must re-enroll in Bastion.
5. **Verification**: confirm every active admin has logged in via Bastion before Phase 5b.
6. **No auto-delete**: `AdminCredentials` rows remain until Phase 5b backup + drop.

---

## 6. Rollback Strategy

| Failure point | Rollback |
|---|---|
| Phase 1 (dormant) | Revert deploy or delete files — zero impact |
| Phase 2-4 (dual mode) | Flip `AUTH_MODE=session` — instant, no deploy |
| Phase 5a (code removal) | `git revert` — tables still exist |
| Phase 5b (table drop) | Restore from pre-migration DB backup |
| Bastion outage post-cutover | JWKS cached up to TTL (1h default) — existing tokens keep working |

---

## 7. Open Questions

1. **Which app issues admin tokens?** Meridian? Direct Bastion login? Determines if Articuno needs proxy login endpoints.
2. **Role mapping**: Option A (coarse, recommended) vs Option B (fine-grained)?
3. **Service-client audit flow**: out of scope, but follow-up ticket wanted?
4. **JIT-provisioning cache**: acceptable staleness window? (proposed 60s)
5. **Bake period**: 1-2 weeks before Phase 5b — stakeholder sign-off needed.

---

## 8. Effort Estimate

| Phase | Effort | Risk |
|---|---|---|
| 0 — Bastion prep | 2h | Low (admin setup) |
| 1 — BastionModule | 4-6h | Low (additive, no behavior change) |
| 2 — Dual guard | 3-4h | Low (mechanical swap) |
| 3 — Frontend cutover | External | Depends on admin panel |
| 4 — Full cutover | 1h (env flip) | Medium (monitoring) |
| 5 — Cleanup | 3-4h | Medium (5b irreversible) |
| 6 — Hardening | Optional | — |

**Total Articuno-side: ~2 days code + 1-2 weeks bake.**
