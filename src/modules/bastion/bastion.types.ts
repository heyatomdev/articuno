/** What `/admin/*` handlers read via `@GetSession()`: the local tenant id, not Bastion's. */
export interface AdminSession {
  tenantId: string;
  externalId: string;
  userRole: string;
}
