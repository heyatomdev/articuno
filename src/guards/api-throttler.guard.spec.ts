import { ExecutionContext, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminThrottlerGuard } from './admin-throttler.guard';
import { ApiThrottlerGuard } from './api-throttler.guard';
import { PUBLIC_THROTTLER } from './throttler.constants';

@UseGuards(AdminThrottlerGuard)
class AdminController {
  handle() {}
}
class MixedController {
  @UseGuards(AdminThrottlerGuard)
  admin() {}
  open() {}
}

const ctxFor = (cls: any, handler: string) =>
  ({
    getClass: () => cls,
    getHandler: () => cls.prototype[handler],
  }) as unknown as ExecutionContext;

const throttlers = [
  { ttl: 60_000, limit: 100 },
  { name: PUBLIC_THROTTLER, ttl: 60_000, limit: 1000 },
];

describe('ApiThrottlerGuard', () => {
  const guard = new ApiThrottlerGuard(
    throttlers as any,
    {} as any,
    new Reflector(),
  ) as any;
  beforeAll(() => guard.onModuleInit());

  it('applies only the public throttler, with its own limit', () => {
    expect(guard.throttlers).toEqual([
      expect.objectContaining({ name: PUBLIC_THROTTLER, limit: 1000 }),
    ]);
  });

  it('skips routes throttled per admin user, at class or method level', async () => {
    await expect(
      guard.shouldSkip(ctxFor(AdminController, 'handle')),
    ).resolves.toBe(true);
    await expect(
      guard.shouldSkip(ctxFor(MixedController, 'admin')),
    ).resolves.toBe(true);
    await expect(
      guard.shouldSkip(ctxFor(MixedController, 'open')),
    ).resolves.toBe(false);
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

describe('AdminThrottlerGuard', () => {
  it('keeps the admin (default) limit and ignores the public one', async () => {
    const guard = new AdminThrottlerGuard(
      throttlers as any,
      {} as any,
      new Reflector(),
    ) as any;
    await guard.onModuleInit();
    expect(guard.throttlers).toEqual([
      expect.objectContaining({ name: 'default', limit: 100 }),
    ]);
  });
});
