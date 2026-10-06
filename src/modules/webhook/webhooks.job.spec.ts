import {
  CLAIM_BATCH_SIZE,
  CLAIM_LEASE_MINUTES,
  RETENTION_BATCH_SIZE,
  WebhooksJob,
} from './webhooks.job';
import { DEAD_LETTER_DATE } from './webhook.constants';

/** Flattens a Prisma.sql tagged-template call into one comparable string. */
const sqlOf = (call: any[]) =>
  (call[0] as string[]).join('?').replace(/\s+/g, ' ');

describe('WebhooksJob', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    webhookEvent: { findMany: jest.fn(), update: jest.fn() },
  };
  const webhooks = { send: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue(30) };
  const metrics = { webhookDeliveryAttempts: { inc: jest.fn() } };
  const job = new WebhooksJob(
    prisma as any,
    webhooks as any,
    config as any,
    metrics as any,
  );
  const inc = metrics.webhookDeliveryAttempts.inc;

  const tenant = { webhookUrl: 'https://t.test/hook', webhookSecret: 's' };
  const row = (over: object = {}) => ({
    id: 'e1',
    event: 'comment.moderated',
    payload: {},
    attempts: 0,
    tenant,
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ id: 'e1' }]);
  });

  describe('claimDue', () => {
    it('claims with UPDATE … FOR UPDATE SKIP LOCKED … RETURNING and a lease', async () => {
      prisma.webhookEvent.findMany.mockResolvedValue([row()]);
      const before = Date.now();

      await job.claimDue();

      const call = prisma.$queryRaw.mock.calls[0];
      const sql = sqlOf(call);
      expect(sql).toMatch(
        /^ UPDATE webhook_events SET "nextRetryAt" = \?, "claimedUntil" = \? WHERE id IN \(/,
      );
      expect(sql).toContain(
        'WHERE "sentAt" IS NULL AND ("nextRetryAt" IS NULL OR "nextRetryAt" <= ?)',
      );
      expect(sql).toContain('FOR UPDATE SKIP LOCKED');
      expect(sql).toContain('RETURNING id');

      const [, nextRetryAt, claimedUntil, now, limit] = call;
      const lease = CLAIM_LEASE_MINUTES * 60 * 1000;
      expect(nextRetryAt).toEqual(claimedUntil);
      expect(nextRetryAt.getTime() - now.getTime()).toBe(lease);
      expect(now.getTime()).toBeGreaterThanOrEqual(before);
      expect(limit).toBe(CLAIM_BATCH_SIZE);

      expect(prisma.webhookEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['e1'] } } }),
      );
    });

    it('returns nothing without a second query when no row was claimed', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      expect(await job.claimDue()).toEqual([]);
      expect(prisma.webhookEvent.findMany).not.toHaveBeenCalled();
    });

    it('two concurrent claims never return the same row', async () => {
      // Postgres hands disjoint row sets to concurrent SKIP LOCKED claims;
      // the job must deliver exactly what its own claim returned.
      prisma.$queryRaw
        .mockResolvedValueOnce([{ id: 'a' }])
        .mockResolvedValueOnce([{ id: 'b' }]);
      prisma.webhookEvent.findMany.mockImplementation(({ where }) =>
        Promise.resolve(where.id.in.map((id: string) => row({ id }))),
      );

      const [first, second] = await Promise.all([
        job.claimDue(),
        job.claimDue(),
      ]);

      expect(first.map((r) => r.id)).toEqual(['a']);
      expect(second.map((r) => r.id)).toEqual(['b']);
    });
  });

  describe('processPendingWebhooks', () => {
    it('only delivers claimed rows and marks success, releasing the lease', async () => {
      prisma.webhookEvent.findMany.mockResolvedValue([row()]);
      webhooks.send.mockResolvedValue(true);

      await job.processPendingWebhooks();

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(webhooks.send).toHaveBeenCalledWith(
        tenant.webhookUrl,
        tenant.webhookSecret,
        {},
      );
      expect(prisma.webhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { sentAt: expect.any(Date), lastError: null, claimedUntil: null },
      });
      expect(inc).toHaveBeenCalledTimes(1);
      expect(inc).toHaveBeenCalledWith({ result: 'success' });
    });

    it('records a failed attempt with backoff, replacing the lease', async () => {
      prisma.webhookEvent.findMany.mockResolvedValue([row({ attempts: 2 })]);
      webhooks.send.mockResolvedValue(false);
      const before = Date.now();

      await job.processPendingWebhooks();

      const { data } = prisma.webhookEvent.update.mock.calls[0][0];
      expect(data).toMatchObject({
        attempts: 3,
        lastError: 'Webhook delivery failed',
        claimedUntil: null,
      });
      const delay = data.nextRetryAt.getTime() - before;
      expect(delay).toBeGreaterThanOrEqual(8000);
      expect(delay).toBeLessThan(9000);
      expect(inc).toHaveBeenCalledTimes(1);
      expect(inc).toHaveBeenCalledWith({ result: 'failure' });
    });

    it('dead-letters at MAX_ATTEMPTS without sending', async () => {
      prisma.webhookEvent.findMany.mockResolvedValue([row({ attempts: 10 })]);

      await job.processPendingWebhooks();

      expect(webhooks.send).not.toHaveBeenCalled();
      expect(prisma.webhookEvent.update.mock.calls[0][0].data).toMatchObject({
        nextRetryAt: DEAD_LETTER_DATE,
        claimedUntil: null,
      });
      expect(inc).toHaveBeenCalledTimes(1);
      expect(inc).toHaveBeenCalledWith({ result: 'dead_lettered' });
    });

    it('counts an unconfigured tenant without sending', async () => {
      prisma.webhookEvent.findMany.mockResolvedValue([
        row({ tenant: { webhookUrl: null, webhookSecret: null } }),
      ]);

      await job.processPendingWebhooks();

      expect(webhooks.send).not.toHaveBeenCalled();
      expect(inc).toHaveBeenCalledTimes(1);
      expect(inc).toHaveBeenCalledWith({ result: 'unconfigured' });
    });

    it('does not count an outcome whose update failed', async () => {
      prisma.webhookEvent.findMany.mockResolvedValue([row()]);
      webhooks.send.mockResolvedValue(true);
      prisma.webhookEvent.update.mockRejectedValueOnce(new Error('db down'));

      await expect(job.processPendingWebhooks()).rejects.toThrow('db down');
      expect(inc).not.toHaveBeenCalled();
    });
  });

  describe('purgeDelivered', () => {
    it('deletes only delivered rows past the window, in SKIP LOCKED batches', async () => {
      prisma.$executeRaw
        .mockResolvedValueOnce(RETENTION_BATCH_SIZE)
        .mockResolvedValueOnce(7);
      const before = Date.now();

      expect(await job.purgeDelivered()).toBe(RETENTION_BATCH_SIZE + 7);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);

      const call = prisma.$executeRaw.mock.calls[0];
      const sql = sqlOf(call);
      expect(sql).toContain('DELETE FROM webhook_events WHERE id IN (');
      expect(sql).toContain('WHERE "sentAt" IS NOT NULL AND "sentAt" < ?');
      expect(sql).toContain('FOR UPDATE SKIP LOCKED');

      const [, cutoff, limit] = call;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(thirtyDays);
      expect(before - cutoff.getTime()).toBeLessThan(thirtyDays + 1000);
      expect(limit).toBe(RETENTION_BATCH_SIZE);
      expect(config.getOrThrow).toHaveBeenCalledWith(
        'WEBHOOK_EVENT_RETENTION_DAYS',
      );
    });

    it('retention cron swallows errors', async () => {
      prisma.$executeRaw.mockRejectedValue(new Error('db down'));
      await expect(job.retention()).resolves.toBeUndefined();
    });
  });
});
