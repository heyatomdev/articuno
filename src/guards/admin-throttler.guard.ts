import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Admin routes only (`THROTTLE_LIMIT`), per Bastion user. The public API is
 * not throttled: it is server-to-server and, inside Docker, every tenant
 * backend reaches Articuno from the same IP.
 */
@Injectable()
export class AdminThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.adminUser?.sub) return `user:${req.adminUser.sub}`;
    return `ip:${req.ip}`;
  }
}
