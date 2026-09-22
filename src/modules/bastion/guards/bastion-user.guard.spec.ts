import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { BastionUserGuard } from './bastion-user.guard';
import { BastionJwksService } from '../bastion-jwks.service';
import { PrismaService } from '@/modules/prisma/prisma.service';

const mockJwks = { verify: jest.fn() };
const mockPrisma = {
  tenant: { findUnique: jest.fn() },
  user: { upsert: jest.fn() },
};
const mockConfig = {
  get: jest.fn((key: string) =>
    key === 'ADMIN_ACCEPTED_APP_SLUGS'
      ? 'articuno,meridian'
      : key === 'ADMIN_ACCEPTED_ROLES'
        ? 'SUPER_ADMIN,ADMIN,MODERATOR,AUTHOR'
        : undefined,
  ),
};

function makeCtx(headers: Record<string, string> = {}): ExecutionContext {
  const req = {
    headers,
    session: undefined,
    adminUser: undefined,
    adminTenant: undefined,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

// Real Bastion user token: no `type` field (only machine tokens set type:'service_client').
// `tenantId` is the Bastion tenant uuid, not its slug.
const validPayload = {
  sub: 'bastion-user-1',
  tenantId: '11111111-2222-3333-4444-555555555555',
  tenantSlug: 'dbd',
  email: 'admin@dbd-builds.it',
  username: 'admin',
  appSlug: 'articuno',
  role: 'ADMIN',
  iat: 0,
  exp: 9999999999,
};

const articunoTenant = {
  id: 'articuno-tenant-1',
  slug: 'default',
  enabled: true,
  bastionTenantId: validPayload.tenantId,
};

describe('BastionUserGuard', () => {
  let guard: BastionUserGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BastionUserGuard,
        { provide: BastionJwksService, useValue: mockJwks },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    guard = module.get(BastionUserGuard);
    jest.clearAllMocks();
    mockPrisma.user.upsert.mockResolvedValue({});
  });

  it('throws 401 when Authorization header missing', async () => {
    await expect(guard.canActivate(makeCtx())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws 401 when Authorization header is not Bearer', async () => {
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Basic abc' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws 401 when token is a machine token (type "service_client")', async () => {
    mockJwks.verify.mockResolvedValue({
      ...validPayload,
      type: 'service_client',
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws 403 when appSlug is not in the allowlist', async () => {
    mockJwks.verify.mockResolvedValue({
      ...validPayload,
      appSlug: 'other-app',
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('accepts the console app (appSlug "meridian"), which forwards its own user-JWT', async () => {
    mockJwks.verify.mockResolvedValue({ ...validPayload, appSlug: 'meridian' });
    mockPrisma.tenant.findUnique.mockResolvedValue(articunoTenant);
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).resolves.toBe(true);
  });

  it('throws 403 when the role is not accepted', async () => {
    mockJwks.verify.mockResolvedValue({ ...validPayload, role: 'VIEWER' });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 when the role is missing', async () => {
    mockJwks.verify.mockResolvedValue({ ...validPayload, role: undefined });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 without hitting the db when the token carries no tenantId', async () => {
    mockJwks.verify.mockResolvedValue({ ...validPayload, tenantId: undefined });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).rejects.toThrow(ForbiddenException);
    expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('resolves the tenant on the Bastion uuid, not the slug', async () => {
    mockJwks.verify.mockResolvedValue(validPayload);
    mockPrisma.tenant.findUnique.mockResolvedValue(articunoTenant);

    await guard.canActivate(makeCtx({ authorization: 'Bearer tok' }));

    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
      where: { bastionTenantId: validPayload.tenantId },
    });
  });

  it('throws 403 when no Articuno tenant is mapped to that Bastion tenant', async () => {
    mockJwks.verify.mockResolvedValue(validPayload);
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 when the mapped tenant is disabled', async () => {
    mockJwks.verify.mockResolvedValue(validPayload);
    mockPrisma.tenant.findUnique.mockResolvedValue({
      ...articunoTenant,
      enabled: false,
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer tok' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('populates req.session with the three fields every admin handler reads', async () => {
    mockJwks.verify.mockResolvedValue(validPayload);
    mockPrisma.tenant.findUnique.mockResolvedValue(articunoTenant);
    const ctx = makeCtx({ authorization: 'Bearer tok' });
    const req = ctx.switchToHttp().getRequest();

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(req.session).toEqual({
      tenantId: articunoTenant.id,
      externalId: validPayload.sub,
      userRole: 'ADMIN',
    });
    // AdminThrottlerGuard buckets on this
    expect(req.adminUser).toEqual(validPayload);
    expect(req.adminTenant).toEqual(articunoTenant);
  });

  // Report.reporterId / Report.moderatorId are real FKs onto users(externalId, tenantId)
  // and the admin handlers write session.externalId into them: without this row every
  // report moderation would fail with a foreign key violation.
  it('JIT-provisions the admin as a local User row, without writing a role', async () => {
    mockJwks.verify.mockResolvedValue(validPayload);
    mockPrisma.tenant.findUnique.mockResolvedValue(articunoTenant);

    await guard.canActivate(makeCtx({ authorization: 'Bearer tok' }));

    expect(mockPrisma.user.upsert).toHaveBeenCalledWith({
      where: {
        externalId_tenantId: {
          externalId: validPayload.sub,
          tenantId: articunoTenant.id,
        },
      },
      update: {},
      create: {
        externalId: validPayload.sub,
        tenantId: articunoTenant.id,
        username: 'admin',
        status: 'ACTIVE',
      },
    });
    expect(mockPrisma.user.upsert.mock.calls[0][0].create).not.toHaveProperty(
      'role',
    );
  });

  it('falls back to the email when the token carries no username', async () => {
    mockJwks.verify.mockResolvedValue({ ...validPayload, username: undefined });
    mockPrisma.tenant.findUnique.mockResolvedValue(articunoTenant);

    await guard.canActivate(makeCtx({ authorization: 'Bearer tok' }));

    expect(mockPrisma.user.upsert.mock.calls[0][0].create.username).toBe(
      validPayload.email,
    );
  });

  it('upserts once per admin within the cache window, not once per request', async () => {
    mockJwks.verify.mockResolvedValue(validPayload);
    mockPrisma.tenant.findUnique.mockResolvedValue(articunoTenant);

    await guard.canActivate(makeCtx({ authorization: 'Bearer tok' }));
    await guard.canActivate(makeCtx({ authorization: 'Bearer tok' }));
    await guard.canActivate(makeCtx({ authorization: 'Bearer tok' }));

    expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.tenant.findUnique).toHaveBeenCalledTimes(3);
  });

  it('upserts again for a different admin', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(articunoTenant);

    mockJwks.verify.mockResolvedValue(validPayload);
    await guard.canActivate(makeCtx({ authorization: 'Bearer tok' }));
    mockJwks.verify.mockResolvedValue({
      ...validPayload,
      sub: 'bastion-user-2',
    });
    await guard.canActivate(makeCtx({ authorization: 'Bearer tok2' }));

    expect(mockPrisma.user.upsert).toHaveBeenCalledTimes(2);
  });
});
