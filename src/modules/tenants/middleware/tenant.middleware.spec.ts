import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import * as crypto from 'crypto';
import { TenantMiddleware } from './tenant.middleware';

import { BastionJwksService } from '@heyatom/bastion-client/nest';
import { PrismaService } from '@/modules/prisma/prisma.service';

const mockJwks = { verify: jest.fn() };
const mockPrisma = {
  tenant: { findFirst: jest.fn(), findUnique: jest.fn() },
};
const mockConfig = {
  get: jest.fn((key: string) =>
    key === 'BASTION_APP_SLUG' ? 'articuno' : undefined,
  ),
};

const PLAIN_KEY = 'dev-plain-key';
const HASHED_KEY = crypto.createHash('sha256').update(PLAIN_KEY).digest('hex');

// A real service-client token: `type: 'service_client'`, a `serviceSlug`, and no
// `appSlug` at all. `tenantId` is the Bastion tenant uuid, not the slug.
const machinePayload = {
  sub: 'service-client-1',
  tenantId: '11111111-2222-3333-4444-555555555555',
  tenantSlug: 'dbd',
  clientName: 'dbdbuilds prod',
  serviceSlug: 'articuno',
  scopes: ['events.write'],
  type: 'service_client',
  iat: 0,
  exp: 9999999999,
};

const apiKeyTenant = { id: 'tenant-by-key', slug: 'default', enabled: true };
const bastionTenant = {
  id: 'tenant-by-bastion',
  slug: 'default',
  enabled: true,
  bastionTenantId: machinePayload.tenantId,
};

function makeReq(headers: Record<string, string> = {}) {
  return { headers } as unknown as Request;
}

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let next: NextFunction;
  const res = {} as Response;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TenantMiddleware,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BastionJwksService, useValue: mockJwks },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    middleware = module.get(TenantMiddleware);
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('X-API-Key (unchanged path)', () => {
    it('resolves the tenant on the SHA-256 of the key and calls next()', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(apiKeyTenant);
      const req = makeReq({ 'x-api-key': PLAIN_KEY });

      await middleware.use(req, res, next);

      expect(mockPrisma.tenant.findFirst).toHaveBeenCalledWith({
        where: { apiKey: HASHED_KEY, enabled: true },
      });
      expect(req['tenant']).toBe(apiKeyTenant);
      expect(next).toHaveBeenCalled();
      expect(mockJwks.verify).not.toHaveBeenCalled();
    });

    it('throws 401 with no credential at all', async () => {
      await expect(middleware.use(makeReq(), res, next)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('throws 401 when the key matches nothing enabled', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(null);
      await expect(
        middleware.use(makeReq({ 'x-api-key': 'nope' }), res, next),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Bearer (Bastion service-client)', () => {
    it('accepts a valid machine token and resolves on bastionTenantId', async () => {
      mockJwks.verify.mockResolvedValue(machinePayload);
      mockPrisma.tenant.findUnique.mockResolvedValue(bastionTenant);
      const req = makeReq({ authorization: 'Bearer tok' });

      await middleware.use(req, res, next);

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { bastionTenantId: machinePayload.tenantId },
      });
      expect(req['tenant']).toBe(bastionTenant);
      expect(next).toHaveBeenCalled();
    });

    // The opposite set to BastionUserGuard, which rejects machine tokens: a console
    // user-JWT must not open the public API.
    it('rejects a user token (no `type`)', async () => {
      mockJwks.verify.mockResolvedValue({
        sub: 'user-1',
        tenantId: machinePayload.tenantId,
        tenantSlug: 'dbd',
        appSlug: 'articuno',
        role: 'ADMIN',
        iat: 0,
        exp: 9999999999,
      });
      await expect(
        middleware.use(makeReq({ authorization: 'Bearer tok' }), res, next),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a machine token minted for another service', async () => {
      mockJwks.verify.mockResolvedValue({
        ...machinePayload,
        serviceSlug: 'herald',
      });
      await expect(
        middleware.use(makeReq({ authorization: 'Bearer tok' }), res, next),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.tenant.findUnique).not.toHaveBeenCalled();
    });

    it('rejects when no Articuno tenant is mapped to that Bastion tenant', async () => {
      mockJwks.verify.mockResolvedValue(machinePayload);
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(
        middleware.use(makeReq({ authorization: 'Bearer tok' }), res, next),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the mapped tenant is disabled', async () => {
      mockJwks.verify.mockResolvedValue(machinePayload);
      mockPrisma.tenant.findUnique.mockResolvedValue({
        ...bastionTenant,
        enabled: false,
      });
      await expect(
        middleware.use(makeReq({ authorization: 'Bearer tok' }), res, next),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('branch selection', () => {
    // The whole point of choosing on the header instead of the outcome: an
    // invalid Bearer is a 401, never a reason to retry with the other credential.
    it('does not fall back to a valid X-API-Key when the Bearer fails', async () => {
      mockJwks.verify.mockRejectedValue(
        new UnauthorizedException('Malformed token'),
      );
      mockPrisma.tenant.findFirst.mockResolvedValue(apiKeyTenant);
      const req = makeReq({
        authorization: 'Bearer garbage',
        'x-api-key': PLAIN_KEY,
      });

      await expect(middleware.use(req, res, next)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.tenant.findFirst).not.toHaveBeenCalled();
      expect(req['tenant']).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });

    it('lets the Bearer win when both credentials are present', async () => {
      mockJwks.verify.mockResolvedValue(machinePayload);
      mockPrisma.tenant.findUnique.mockResolvedValue(bastionTenant);
      const req = makeReq({
        authorization: 'Bearer tok',
        'x-api-key': PLAIN_KEY,
      });

      await middleware.use(req, res, next);

      expect(req['tenant']).toBe(bastionTenant);
      expect(mockPrisma.tenant.findFirst).not.toHaveBeenCalled();
    });

    // Not a Bearer: the header is ignored and the API key branch runs, exactly as
    // before this change.
    it('ignores a non-Bearer Authorization header', async () => {
      mockPrisma.tenant.findFirst.mockResolvedValue(apiKeyTenant);
      const req = makeReq({
        authorization: 'Basic abc',
        'x-api-key': PLAIN_KEY,
      });

      await middleware.use(req, res, next);

      expect(req['tenant']).toBe(apiKeyTenant);
      expect(mockJwks.verify).not.toHaveBeenCalled();
    });
  });
});
