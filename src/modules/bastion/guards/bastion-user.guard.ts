import {
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  BASTION_OPTIONS,
  BastionAuditService,
  BastionJwksService,
  BastionModuleOptions,
  BastionUserGuard as PackageUserGuard,
  UserJwtPayload,
} from '@heyatom/bastion-client/nest';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { AdminSession } from '../bastion.types';

/**
 * `/admin/*` guard. The package checks the user token (accepted apps and roles
 * from `BastionModule` options, i.e. `ADMIN_ACCEPTED_*`); what is Articuno's
 * alone is the mapping of Bastion's tenant **uuid** to a local `Tenant`
 * (`bastionTenantId`), the lazily provisioned local `User`, and the
 * `AdminSession` handlers read via `@GetSession()`.
 */
@Injectable()
export class BastionUserGuard extends PackageUserGuard {
  constructor(
    jwks: BastionJwksService,
    audit: BastionAuditService,
    @Inject(BASTION_OPTIONS) options: BastionModuleOptions,
    private readonly prisma: PrismaService,
  ) {
    super(jwks, audit, options);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    await super.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest();
    const payload = req.adminUser as UserJwtPayload;

    if (!payload.tenantId) {
      throw new ForbiddenException('Tenant assente nel token');
    }
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
    req.adminTenant = tenant;
    return true;
  }

  private async ensureLocalUser(
    payload: UserJwtPayload,
    tenantId: string,
  ): Promise<void> {
    await this.prisma.user.createMany({
      data: {
        externalId: payload.sub,
        tenantId,
        username: payload.username ?? payload.email ?? payload.sub,
        status: 'ACTIVE',
      },
      skipDuplicates: true,
    });
  }
}
