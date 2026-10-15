import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { of, throwError } from 'rxjs';
import { webhookAgent, WebhookUrlError } from '@heyatom/nest-common/webhooks';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService resend vs. claim lease', () => {
  const prisma = {
    webhookEvent: { findFirst: jest.fn(), updateMany: jest.fn() },
  };
  const service = new WebhooksService(
    {} as any,
    prisma as any,
    { get: () => false } as any,
  );
  const leaseFree = {
    OR: [{ claimedUntil: null }, { claimedUntil: { lte: expect.any(Date) } }],
  };

  beforeEach(() => jest.resetAllMocks());

  it('resendOne resets only an unsent, unleased row of the tenant', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue({ id: 'e1', sentAt: null });
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 1 });

    await service.resendOne('t1', 'e1');

    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', tenantId: 't1', sentAt: null, ...leaseFree },
      data: { attempts: 0, nextRetryAt: null, lastError: null },
    });
  });

  it('resendOne refuses a row a worker is delivering', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue({ id: 'e1', sentAt: null });
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.resendOne('t1', 'e1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('resendOne refuses a delivered row', async () => {
    prisma.webhookEvent.findFirst.mockResolvedValue({
      id: 'e1',
      sentAt: new Date(),
    });

    await expect(service.resendOne('t1', 'e1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.webhookEvent.updateMany).not.toHaveBeenCalled();
  });

  it('resendAllFailed skips leased rows', async () => {
    prisma.webhookEvent.updateMany.mockResolvedValue({ count: 4 });

    expect(await service.resendAllFailed('t1')).toEqual({ reset: 4 });
    expect(prisma.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', sentAt: null, ...leaseFree },
      data: { attempts: 0, nextRetryAt: null, lastError: null },
    });
  });
});

describe('WebhooksService.send SSRF guard', () => {
  const post = jest.fn();
  const service = (allowPrivate = false) =>
    new WebhooksService(
      { post } as any,
      {} as any,
      { get: () => allowPrivate } as any,
    );

  beforeEach(() => post.mockReset());

  it.each([
    'http://example.com/hook',
    'https://127.0.0.1/hook',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/hook',
    'https://user:pass@example.com/hook',
    'https://localhost/hook',
  ])('refuses %s without sending', async (url) => {
    expect(await service().send(url, 's', {})).toBe('blocked');
    expect(post).not.toHaveBeenCalled();
  });

  it('sends a public target through the pinned agent, signature unchanged', async () => {
    post.mockReturnValue(of({ status: 200 }));

    expect(
      await service().send('https://example.com/hook', 'secret', { a: 1 }),
    ).toBe('sent');
    const [, , opts] = post.mock.calls[0];
    expect(opts.httpsAgent).toBe(webhookAgent);
    expect(opts.maxRedirects).toBe(0);
    expect(opts.proxy).toBe(false);
    expect(opts.headers['x-webhook-signature']).toBe(
      createHmac('sha256', 'secret').update('{"a":1}').digest('hex'),
    );
  });

  it('treats a connect-time refusal (DNS to a private address) as terminal', async () => {
    const err = Object.assign(new Error('blocked'), {
      code: 'WEBHOOK_TARGET_BLOCKED',
      cause: new WebhookUrlError('DNS_NON_PUBLIC'),
    });
    post.mockReturnValue(throwError(() => err));

    expect(await service().send('https://example.com/hook', 's', {})).toBe(
      'blocked',
    );
  });

  it('retries ordinary network errors', async () => {
    post.mockReturnValue(throwError(() => new Error('ECONNRESET')));

    expect(await service().send('https://example.com/hook', 's', {})).toBe(
      'failed',
    );
  });

  it('admits private http targets only with WEBHOOK_ALLOW_PRIVATE_TARGETS', async () => {
    post.mockReturnValue(of({ status: 200 }));

    expect(await service(true).send('http://localhost:8000/h', 's', {})).toBe(
      'sent',
    );
  });
});
