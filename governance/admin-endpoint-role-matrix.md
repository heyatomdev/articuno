# Admin Endpoint Role Matrix

## Purpose
Define a practical endpoint-by-endpoint role matrix for central admin usage across real backend modules.

This document is the operational companion of `governance/admin-centrale-policy-ruoli.md`.

## Scope
- Modules covered: `articles`, `comments`, `reports`, `banned-words`, `analytics`.
- Roles: `TENANT_ADMIN`, `EDITOR`, `MODERATOR`, `MEMBER`.
- Rule model: role-based checks only (no granular permissions).

## Enforcement Rules
- All endpoints must enforce tenant context (`tenantId`) server-side.
- All endpoints are deny-by-default if a role is not explicitly listed.
- Client-provided `role` is never trusted as authorization truth.
- `MEMBER` is always `DENY` for admin API calls.
- If an endpoint is needed by end users, expose it on a separate public API surface (not admin).

## Legend
- `ALLOW`: role can execute endpoint.
- `DENY`: role cannot execute endpoint.

## Admin Surface Rule
- This matrix applies to admin API surface only.
- Even if current controller paths do not yet use a physical `/admin` prefix, these endpoints are treated as admin when consumed by the central admin app.

## Articles (`/articles`)
| Method | Path                                       | TENANT_ADMIN | EDITOR | MODERATOR | MEMBER | Notes                                       |
|--------|--------------------------------------------|--------------|--------|-----------|--------|---------------------------------------------|
| POST   | `/articles`                                | ALLOW        | ALLOW  | DENY      | DENY   | Create article                              |
| GET    | `/articles`                                | ALLOW        | ALLOW  | ALLOW     | DENY   | Admin listing/filtering                     |
| GET    | `/articles/:slug`                          | ALLOW        | ALLOW  | ALLOW     | DENY   | Admin detail by slug                        |
| PATCH  | `/articles/:id`                            | ALLOW        | ALLOW  | DENY      | DENY   | Update article metadata/status/content refs |
| DELETE | `/articles/:id`                            | ALLOW        | ALLOW  | DENY      | DENY   | Delete article                              |
| POST   | `/articles/:id/translations`               | ALLOW        | ALLOW  | DENY      | DENY   | Create translation                          |
| GET    | `/articles/:id/translations`               | ALLOW        | ALLOW  | ALLOW     | DENY   | List translations                           |
| GET    | `/articles/:id/translations/:languageCode` | ALLOW        | ALLOW  | ALLOW     | DENY   | Translation detail                          |
| PATCH  | `/articles/:id/translations/:languageCode` | ALLOW        | ALLOW  | DENY      | DENY   | Update translation                          |
| DELETE | `/articles/:id/translations/:languageCode` | ALLOW        | ALLOW  | DENY      | DENY   | Remove translation                          |

## Comments (`/comments`)
| Method | Path            | TENANT_ADMIN | EDITOR   | MODERATOR | MEMBER   | Notes                                                           |
|--------|-----------------|--------------|----------|-----------|----------|-----------------------------------------------------------------|
| POST   | `/comments`     | ALLOW        | OPTIONAL | ALLOW     | DENY     | If needed for end users, expose as public endpoint, not admin   |
| GET    | `/comments`     | ALLOW        | ALLOW    | ALLOW     | DENY     | Admin moderation list                                           |
| GET    | `/comments/:id` | ALLOW        | ALLOW    | ALLOW     | DENY     | Moderation/detail view                                          |
| PATCH  | `/comments/:id` | ALLOW        | DENY     | ALLOW     | DENY     | Moderation updates/status actions                               |
| DELETE | `/comments/:id` | ALLOW        | DENY     | ALLOW     | DENY     | Remove/hide comment                                             |

## Reports (`/reports`)
| Method | Path                  | TENANT_ADMIN | EDITOR | MODERATOR | MEMBER | Notes                              |
|--------|-----------------------|--------------|--------|-----------|--------|------------------------------------|
| POST   | `/reports`            | ALLOW        | ALLOW  | ALLOW     | DENY   | End-user reporting should be public API, not admin |
| GET    | `/reports`            | ALLOW        | DENY   | ALLOW     | DENY   | Moderation queue                   |
| PATCH  | `/reports/:id/status` | ALLOW        | DENY   | ALLOW     | DENY   | Resolve/review/dismiss workflow    |

## Banned Words (`/banned-words`)
| Method | Path                | TENANT_ADMIN | EDITOR | MODERATOR | MEMBER | Notes                    |
|--------|---------------------|--------------|--------|-----------|--------|--------------------------|
| POST   | `/banned-words`     | ALLOW        | DENY   | ALLOW     | DENY   | Add banned term          |
| GET    | `/banned-words`     | ALLOW        | DENY   | ALLOW     | DENY   | List tenant banned terms |
| DELETE | `/banned-words/:id` | ALLOW        | DENY   | ALLOW     | DENY   | Remove banned term       |

## Analytics (`/stats`)
| Method | Path               | TENANT_ADMIN | EDITOR | MODERATOR | MEMBER | Notes                       |
|--------|--------------------|--------------|--------|-----------|--------|-----------------------------|
| GET    | `/stats/dashboard` | ALLOW        | ALLOW  | ALLOW     | DENY   | Tenant dashboard statistics |

## Implementation Checklist
- Add role guard/decorator and apply it on all endpoints listed above.
- Keep `TenantGuard` and enforce `tenantId`-scoped queries in every service call.
- Log admin actions for write/moderation endpoints (`POST`, `PATCH`, `DELETE`).
- Start with one pilot tenant and validate no cross-tenant access.

## Open Policy Decisions
- Confirm if `EDITOR` can create comments in admin (`POST /comments`).
- Decide migration strategy to split admin/public routes: physical `/admin` prefix vs logical separation with dedicated guards.
- Confirm if article read endpoints under `/articles` should be exposed to `MEMBER` only on public API surface.

