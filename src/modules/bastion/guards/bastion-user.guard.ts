import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BastionJwksService } from '../bastion-jwks.service';
import { AdminSession, JwtPayload } from '../bastion.types';
import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class BastionUserGuard implements CanActivate {
  private readonly acceptedAppSlugs: string[];
  private readonly acceptedRoles: string[];

  constructor(
    private readonly jwks: BastionJwksService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.acceptedAppSlugs = (
      this.config.get<string>('ADMIN_ACCEPTED_APP_SLUGS') ?? 'articuno'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // This list must include every Meridian console role (currently SUPER_ADMIN, ADMIN,
    // MODERATOR, AUTHOR) — adding a role in Bastion requires adding it here too.
    // Fine-grained permissions are enforced by Meridian's BFF, not here.
    this.acceptedRoles = (
      this.config.get<string>('ADMIN_ACCEPTED_ROLES') ??
      'SUPER_ADMIN,ADMIN,MODERATOR,AUTHOR'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers['authorization'];
    if (!auth?.startsWith('Bearer '))
      throw new UnauthorizedException('Token mancante');

    const payload = await this.jwks.verify(auth.slice(7));

    // Bastion user JWTs carry no `type` field — only machine tokens set `type: 'service_client'`.
    // Reject machine tokens; everything else is a user token.
    if (payload.type === 'service_client') {
      throw new UnauthorizedException('Token macchina non ammesso');
    }
    // The console (e.g. `meridian`) forwards its own user-JWT; its appSlug is not `articuno`.
    // Accept any allowlisted app since app-bound refresh tokens cannot be exchanged cross-app.
    if (!this.acceptedAppSlugs.includes(payload.appSlug)) {
      throw new ForbiddenException('App non autorizzata');
    }
    if (!this.acceptedRoles.includes(payload.role ?? '')) {
      throw new ForbiddenException('Ruolo insufficiente');
    }
    if (!payload.tenantId) {
      throw new ForbiddenException('Tenant assente nel token');
    }

    // Resolved on the Bastion tenant **uuid**, not the slug: the Articuno tenant
    // `default` corresponds to the Bastion tenant `dbd` (prod) / `dev` (local), so
    // the slugs do not match. `bastionTenantId` is backfilled per environment; while
    // it is null that tenant is simply not reachable from the console.
    const tenant = await this.prisma.tenant.findUnique({
      where: { bastionTenantId: payload.tenantId },
    });
    if (!tenant || !tenant.enabled) {
      throw new ForbiddenException(
        'Tenant non attivo o non mappato su Bastion',
      );
    }

    await this.ensureLocalUser(payload, tenant.id);

    const session: AdminSession = {
      tenantId: tenant.id,
      externalId: payload.sub,
      userRole: payload.role ?? '',
    };
    req.session = session;
    // AdminThrottlerGuard buckets on req.adminUser.sub.
    req.adminUser = payload;
    req.adminTenant = tenant;
    return true;
  }

  /**
   * JIT-provision the console admin as a local `User` row.
   *
   * Not cosmetic: `Report.reporterId` and `Report.moderatorId` are real foreign keys
   * onto `users(externalId, tenantId)`, and the admin handlers write
   * `session.externalId` into both. Without this row, every report moderation and
   * every admin-filed report fails with a foreign key violation.
   *
   * Known side effect, deliberate and not hidden: console admins therefore appear in
   * `GET /admin/users` alongside the tenant's real site users, with 0 articles and
   * 0 comments. Filtering them out is a product decision, not this guard's call.
   *
   * `role` is intentionally not written — the `UserRole` enum is on its way out and
   * the Bastion role does not map onto it. New rows keep the schema default.
   *
   * `createMany` rather than `upsert`, and with no in-process "already provisioned"
   * cache, for two reasons that turned out to be the same reason:
   *
   * - Prisma compiles this `createMany` to a single `INSERT ... ON CONFLICT DO
   *   NOTHING`, while `upsert` on this model emits SELECT-then-INSERT in a
   *   transaction. That is not atomic, and the console opens a page with several
   *   parallel fetches: on the first request after a restart they all miss, all
   *   insert, and every one but the winner takes a P2002 and answers 500.
   * - A cache keyed on time also lies when the row goes away — deleting the admin
   *   from `GET /admin/users` (where they now show up) left this guard convinced
   *   the row existed, and report moderation failed on the foreign key until the
   *   entry aged out.
   *
   * `skipDuplicates` gives exactly the intended semantics: the row only has to
   * exist. It never updates, so `username` stays the site's to own — it arrives
   * through `POST /users/sync` from the consuming app, and a read path must not
   * rewrite it. One no-op insert per admin request is cheaper than either bug.
   */
  private async ensureLocalUser(
    payload: JwtPayload,
    tenantId: string,
  ): Promise<void> {
    await this.prisma.user.createMany({
      data: {
        externalId: payload.sub,
        tenantId,
        username: payload.username ?? payload.email,
        status: 'ACTIVE',
      },
      skipDuplicates: true,
    });
  }
}
