import { ExecutionContext, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminThrottlerGuard } from './admin-throttler.guard';
import { ApiThrottlerGuard } from './api-throttler.guard';

@UseGuards(AdminThrottlerGuard)
class AdminController {}
class PublicController {}

const ctxFor = (cls: object) =>
  ({ getClass: () => cls }) as unknown as ExecutionContext;

describe('ApiThrottlerGuard', () => {
  const guard = new ApiThrottlerGuard(
    { throttlers: [] } as any,
    {} as any,
    new Reflector(),
  ) as any;

  it('skips controllers already throttled per admin user', async () => {
    await expect(guard.shouldSkip(ctxFor(AdminController))).resolves.toBe(true);
    await expect(guard.shouldSkip(ctxFor(PublicController))).resolves.toBe(
      false,
    );
  });

  it('buckets per tenant and IP, falling back to IP alone', async () => {
    await expect(
      guard.getTracker({ tenant: { id: 't1' }, ip: '1.2.3.4' }),
    ).resolves.toBe('tenant:t1:1.2.3.4');
    await expect(guard.getTracker({ ip: '1.2.3.4' })).resolves.toBe(
      'ip:1.2.3.4',
    );
  });
});
