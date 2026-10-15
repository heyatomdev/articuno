import { BadRequestException, ConflictException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { postWebhook, WebhookUrlError } from '@heyatom/nest-common/webhooks';
import { WebhooksService } from './webhooks.service';

jest.mock('@heyatom/nest-common/webhooks', () => ({
  ...jest.requireActual('@heyatom/nest-common/webhooks'),
  postWebhook: jest.fn(),
}));

describe('WebhooksService resend vs. claim lease', () => {
  const prisma = {
    webhookEvent: { findFirst: jest.fn(), updateMany: jest.fn() },
  };
  const service = new WebhooksService(
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

describe('WebhooksService.send', () => {
  const post = jest.mocked(postWebhook);
  const service = (allowPrivate = false) =>
    new WebhooksService({} as any, { get: () => allowPrivate } as any);

  beforeEach(() => post.mockReset());

  it.each([
    'http://example.com/hook',
    'https://127.0.0.1/hook',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/hook',
    'https://user:pass@example.com/hook',
    'https://localhost/hook',
  ])('refuses %s without sending', async (url) => {
    expect(await service().send(url, 's', 'e1', {})).toBe('blocked');
    expect(post).not.toHaveBeenCalled();
  });

  it('signs the exact body with Standard Webhooks headers', async () => {
    post.mockResolvedValue({ status: 204, body: '' });

    expect(
      await service().send('https://example.com/hook', 'secret', 'e1', {
        a: 1,
      }),
    ).toBe('sent');
    const [url, body, headers, opts] = post.mock.calls[0];
    expect(url).toBe('https://example.com/hook');
    expect(body).toBe('{"a":1}');
    expect(headers['webhook-id']).toBe('e1');
    const ts = headers['webhook-timestamp'];
    expect(Math.abs(Number(ts) - Date.now() / 1000)).toBeLessThan(5);
    expect(headers['webhook-signature']).toBe(
      `v1,${createHmac('sha256', 'secret').update(`e1.${ts}.{"a":1}`).digest('base64')}`,
    );
    expect(headers['x-webhook-signature']).toBeUndefined();
    expect(opts).toEqual({
      timeoutMs: 5000,
      policy: { allowPrivate: false },
    });
  });

  it('retries a non-2xx answer (a 3xx is never followed)', async () => {
    post.mockResolvedValue({ status: 307, body: '' });

    expect(
      await service().send('https://example.com/hook', 's', 'e1', {}),
    ).toBe('failed');
  });

  it('treats a connect-time refusal (DNS to a private address) as terminal', async () => {
    post.mockRejectedValue(new WebhookUrlError('DNS_NON_PUBLIC'));

    expect(
      await service().send('https://example.com/hook', 's', 'e1', {}),
    ).toBe('blocked');
  });

  it('retries a transient DNS failure and ordinary network errors', async () => {
    post.mockRejectedValueOnce(new WebhookUrlError('DNS_TRANSIENT'));
    post.mockRejectedValueOnce(new Error('ECONNRESET'));

    const send = () =>
      service().send('https://example.com/hook', 's', 'e1', {});
    expect(await send()).toBe('failed');
    expect(await send()).toBe('failed');
  });

  it('admits private http targets only with WEBHOOK_ALLOW_PRIVATE_TARGETS', async () => {
    post.mockResolvedValue({ status: 200, body: '' });

    expect(
      await service(true).send('http://localhost:8000/h', 's', 'e1', {}),
    ).toBe('sent');
    expect(post.mock.calls[0][3].policy).toEqual({ allowPrivate: true });
  });
});
