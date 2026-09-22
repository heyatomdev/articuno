import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/modules/prisma/prisma.service';

import {
  BastionJwksService,
  isServiceClientToken,
} from '@heyatom/bastion-client/nest';
import { Tenant } from '@prisma/client';
import * as crypto from 'crypto';

/**
 * Authenticates the public API. Two accepted credentials, one outcome.
 *
 * - `X-API-Key: <key>` — the original path: SHA-256 of the key against `Tenant.apiKey`.
 * - `Authorization: Bearer <jwt>` — a Bastion **service-client** token, verified
 *   against the cached JWKS and resolved onto `Tenant.bastionTenantId`.
 *
 * Both produce the same `req.tenant`, so `TenantGuard`, `@GetTenant()` and every
 * controller below stay untouched.
 *
 * The branch is chosen on which header is present, never on whether a branch
 * succeeded: a Bearer that fails verification is a 401, not a reason to go and
 * try the API key. Falling back on error would turn any invalid token into a
 * free retry with the other credential, which is a bypass, not a convenience.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private prisma: PrismaService,
    private jwks: BastionJwksService,
    private config: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const auth = req.headers['authorization'];

    req['tenant'] = auth?.startsWith('Bearer ')
      ? await this.tenantFromServiceToken(auth.slice(7))
      : await this.tenantFromApiKey(req.headers['x-api-key'] as string);

    next();
  }

  private async tenantFromApiKey(apiKey?: string): Promise<Tenant> {
    if (!apiKey) {
      throw new UnauthorizedException('API Key mancante');
    }

    // Hash the incoming API key to match the stored hash
    const hashedApiKey = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    const tenant = await this.prisma.tenant.findFirst({
      where: { apiKey: hashedApiKey, enabled: true },
    });

    if (!tenant) {
      throw new UnauthorizedException(
        'API Key non valida o Tenant disattivato',
      );
    }

    return tenant;
  }

  private async tenantFromServiceToken(token: string): Promise<Tenant> {
    const payload = await this.jwks.verify(token);

    // Exactly the opposite set to BastionUserGuard, which rejects machine tokens:
    // the public API is machine-to-machine, so a *user* token must not open it.
    // A console admin holding a user-JWT has `/admin/*`; this surface is not that.
    if (!isServiceClientToken(payload)) {
      throw new UnauthorizedException('Token non di tipo service_client');
    }

    // Bastion signs one key for the whole fleet: without this check a machine token
    // minted for herald or beacon would authenticate here just as well.
    const expected = this.config.get<string>('BASTION_APP_SLUG') ?? 'articuno';
    if (payload.serviceSlug !== expected) {
      throw new UnauthorizedException('Token emesso per un altro servizio');
    }

    if (!payload.tenantId) {
      throw new UnauthorizedException('Tenant assente nel token');
    }

    // Same resolution as BastionUserGuard: on the Bastion tenant **uuid**, not the
    // slug. `bastionTenantId` is backfilled per environment; while it is null that
    // tenant simply has no Bearer path and keeps working on its API key.
    const tenant = await this.prisma.tenant.findUnique({
      where: { bastionTenantId: payload.tenantId },
    });

    if (!tenant || !tenant.enabled) {
      throw new UnauthorizedException(
        'Tenant non attivo o non mappato su Bastion',
      );
    }

    return tenant;
  }
}
