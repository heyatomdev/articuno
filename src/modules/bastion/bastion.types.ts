/**
 * Payload of a Bastion-issued RS256 JWT.
 *
 * `type` is present only on machine tokens (`service_client`); user tokens omit it.
 * `tenantId` is the Bastion tenant **uuid** — not the slug — and is what
 * `BastionUserGuard` resolves against `Tenant.bastionTenantId`.
 */
export interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  email?: string;
  username?: string;
  image?: string | null;
  preferredLocale?: string;
  appSlug: string;
  role?: string;
  permissions?: string[];
  type?: string;
  iat: number;
  exp: number;
}

/**
 * Shape attached to `request.session` and read by `@GetSession()`.
 *
 * Deliberately the three fields every `/admin/*` handler actually uses, so the
 * Bastion guard and the legacy cookie `SessionGuard` are interchangeable without
 * touching a single controller. The cookie guard attaches a full `SessionStorage`
 * row, which is a superset of this.
 */
export interface AdminSession {
  tenantId: string;
  externalId: string;
  userRole: string;
}
