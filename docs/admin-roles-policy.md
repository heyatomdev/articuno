# Central Admin: Decision and Operational Plan

## Objective
Have a single central admin for all 3 sites, with access limited to tenants linked to each account.

## Decision (Summary)
The central admin increases initial complexity, but reduces total complexity in the medium/long term.

- Immediate increase: access governance, roles, security checks.
- Later reduction: no triple implementation, fewer duplicated bugs, unified maintenance.
- Recommended direction: proceed with a simple role model and strict tenant isolation.

## Non-Negotiable Principles
- Multi-tenant is mandatory: every query must remain filtered by `tenantId`.
- `role` and `tenantId` are security data managed server-side.
- A `role` sent by the client is not a source of truth for authorization.
- Deny by default: if a role is not explicitly allowed, the action is denied.
- `MEMBER` must never call admin APIs (`/admin` surface).

## Chosen Model (Simple)
Reuse the existing `User` model and add only one `role` field.

Standard roles:
- `TENANT_ADMIN`
- `EDITOR`
- `MODERATOR`
- `MEMBER`

No granular permission system at this stage.

## Responsibility Matrix (Baseline)
| Area                          | TENANT_ADMIN | EDITOR      | MODERATOR | MEMBER |
|-------------------------------|--------------|-------------|-----------|--------|
| Tenant user/role management   | Yes          | No          | No        | No     |
| Articles/categories/tags CRUD | Yes          | Yes         | Optional  | No     |
| Reports/comments moderation   | Yes          | Optional    | Yes       | No     |
| Banned words management       | Yes          | No          | Yes       | No     |
| Admin dashboard/analytics     | Yes          | Yes (basic) | Yes       | No     |

## Adoption Steps in the App

### Step 1 - Data Schema
- Add a `UserRole` enum in `prisma/schema.prisma`.
- Add `role` to `User` with default `MEMBER`.
- Keep the `@@unique([externalId, tenantId])` constraint.

### Step 2 - User Sync from Client Apps
- Keep syncing `username` and `avatarUrl`.
- Accept `role` from the client only as a hint, never as authority.
- Resolve the effective role server-side only.

### Step 3 - User + Tenant Context
- For every admin request, resolve current user (`externalId`) and `tenantId`.
- Always apply tenant-scoped queries (`where: { ..., tenantId }`).

### Step 4 - Role Guard
- Introduce a simple role check (for example, decorator + guard).
- Apply role checks to sensitive admin modules.

### Step 5 - Endpoint Policy
- `TENANT_ADMIN`: full control on the tenant.
- `EDITOR`: editorial content write operations.
- `MODERATOR`: content and report moderation.
- `MEMBER`: no admin actions and no access to admin APIs.

### Step 5.1 - Admin API Scope
- Any endpoint exposed in the central admin application is part of the admin API surface.
- This rule applies even if current backend routes are not yet physically prefixed with `/admin`.
- Public endpoints for end users must be separated from admin endpoints in routing and guards.

### Step 6 - Minimum Audit
- Track admin actions: user, tenant, action, target, timestamp.
- Prioritize: article/comment status changes and moderation actions.

### Step 7 - Gradual Rollout
- Start with one pilot tenant.
- Verify no cross-tenant access.
- Expand progressively to other tenants.

## Main Risks and Mitigations
- Privilege escalation -> Never trust client-provided `role`.
- Cross-tenant leakage -> Enforce `tenantId` checks on every query and action.
- Policy drift -> Keep one centralized policy and role matrix.

## Completion Criteria
- All admin endpoints are protected by role + tenant checks.
- All `MEMBER` requests to admin API surface are rejected.
- No admin query runs without a `tenantId` filter.
- Audit logs are present for sensitive actions.
- Roles are applied consistently across the backend.

