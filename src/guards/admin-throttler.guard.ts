import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PUBLIC_THROTTLER } from './throttler.constants';

/** Admin routes: the `default` throttler (`THROTTLE_LIMIT`), per Bastion user. */
@Injectable()
export class AdminThrottlerGuard extends ThrottlerGuard {
  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = this.throttlers.filter(
      (t) => t.name !== PUBLIC_THROTTLER,
    );
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.adminUser?.sub) return `user:${req.adminUser.sub}`;
    return `ip:${req.ip}`;
  }
}
