import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { BastionUserGuard } from './bastion-user.guard';
import { SessionGuard } from '@/modules/auth/guards/session.guard';

/**
 * Transitional guard for `/admin/*`: Bastion user-JWT when the caller sends one,
 * legacy `sessionId` cookie otherwise.
 *
 * No `AUTH_MODE` env switch on purpose — the window is a few weeks, the rollback is
 * a `git revert`, and the cookie branch disappears entirely once the console cuts
 * over. Both branches populate `request.session` with the same three fields
 * (`tenantId`, `externalId`, `userRole`), so handlers cannot tell them apart.
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly bastion: BastionUserGuard,
    private readonly session: SessionGuard,
  ) {}

  canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.['authorization'];
    return auth?.startsWith('Bearer ')
      ? this.bastion.canActivate(ctx)
      : this.session.canActivate(ctx);
  }
}
