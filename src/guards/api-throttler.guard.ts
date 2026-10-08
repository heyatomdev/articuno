import { ExecutionContext, Injectable } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminThrottlerGuard } from './admin-throttler.guard';

/**
 * Global (APP_GUARD) rate limit for the public API, bucketed per tenant and IP
 * (`req.tenant` is set by TenantMiddleware, which runs before guards).
 * Controllers that use `AdminThrottlerGuard` are skipped here so admin
 * requests are counted once, per Bastion user. `@SkipThrottle()` opts out.
 */
@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(ctx: ExecutionContext): Promise<boolean> {
    const guards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, ctx.getClass()) ?? [];
    return guards.includes(AdminThrottlerGuard);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.tenant?.id
      ? `tenant:${req.tenant.id}:${req.ip}`
      : `ip:${req.ip}`;
  }
}
