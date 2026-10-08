import { ExecutionContext, Injectable } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminThrottlerGuard } from './admin-throttler.guard';
import { PUBLIC_THROTTLER } from './throttler.constants';

/**
 * Global (APP_GUARD) rate limit for the public API. Applies only the `public`
 * throttler, bucketed per tenant and IP (`req.tenant` is set by
 * TenantMiddleware, which runs before guards). The public API is
 * server-to-server, so one bucket is roughly one tenant backend: hence its own,
 * higher limit. Routes that use `AdminThrottlerGuard` (class or method) are
 * skipped so admin requests are counted once, per Bastion user.
 * Opt out with `@SkipThrottle({ public: true })`.
 */
@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter(
      (t) => t.name === PUBLIC_THROTTLER,
    );
  }

  protected async shouldSkip(ctx: ExecutionContext): Promise<boolean> {
    return [ctx.getHandler(), ctx.getClass()].some((target) =>
      (
        (Reflect.getMetadata(GUARDS_METADATA, target) ?? []) as unknown[]
      ).includes(AdminThrottlerGuard),
    );
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.tenant?.id
      ? `tenant:${req.tenant.id}:${req.ip}`
      : `ip:${req.ip}`;
  }
}
