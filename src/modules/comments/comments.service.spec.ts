import { BadRequestException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { CommentsService } from './comments.service';
import { SYSTEM_REPORTER_ID } from '@/modules/users/users.constants';

describe('CommentsService', () => {
  const prisma = {
    comment: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    article: { findFirst: jest.fn() },
    user: { upsert: jest.fn() },
    report: { create: jest.fn() },
    $transaction: jest.fn(),
    ensureUser: jest.fn(),
  };
  const moderationPolicy = {
    checkBannedWords: jest.fn(),
    checkUserModeration: jest.fn(),
    applyCreationPolicy: jest.fn(),
  };
  const webhookPublisher = { publishCommentModerationEvent: jest.fn() };
  const service = new CommentsService(
    prisma as any,
    moderationPolicy as any,
    webhookPublisher as any,
  );

  const current = (status: ContentStatus) =>
    prisma.comment.findFirst.mockResolvedValue({
      status,
      author: { externalId: 'ext-1' },
    });

  beforeEach(() => {
    jest.resetAllMocks();
    moderationPolicy.checkBannedWords.mockResolvedValue(false);
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.comment.update.mockImplementation(({ data }) => ({
      id: 'c1',
      ...data,
    }));
    prisma.comment.create.mockImplementation(({ data }) => ({
      id: 'new-comment',
      ...data,
    }));
    prisma.article.findFirst.mockResolvedValue({ id: 'a1' });
    prisma.ensureUser.mockResolvedValue({ id: 'u1', externalId: 'ext-1' });
    moderationPolicy.checkUserModeration.mockResolvedValue({ isAllowed: true });
  });

  it('rejects a transition out of BANNED', async () => {
    current(ContentStatus.BANNED);
    await expect(
      service.update('t1', 'c1', { status: ContentStatus.VISIBLE }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it('scopes the write to the tenant', async () => {
    current(ContentStatus.VISIBLE);
    await service.update('t1', 'c1', { status: ContentStatus.HIDDEN });
    expect(prisma.comment.update.mock.calls[0][0].where).toEqual({
      id: 'c1',
      tenantId: 't1',
    });
  });

  it('strips tags from the new content', async () => {
    current(ContentStatus.VISIBLE);
    await service.update('t1', 'c1', {
      content: 'ciao <script>alert(1)</script><b>mondo</b>',
    });
    expect(prisma.comment.update.mock.calls[0][0].data.content).toBe(
      'ciao mondo',
    );
  });

  it('rejects content that is empty once tags are gone', async () => {
    current(ContentStatus.VISIBLE);
    await expect(
      service.update('t1', 'c1', { content: '<img src=x onerror=alert(1)>' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('hides the comment and enqueues a webhook when the edit adds a banned word', async () => {
    current(ContentStatus.VISIBLE);
    moderationPolicy.checkBannedWords.mockResolvedValue(true);

    await service.update('t1', 'c1', { content: 'parolaccia' });

    expect(prisma.comment.update.mock.calls[0][0].data.status).toBe(
      ContentStatus.HIDDEN,
    );
    expect(webhookPublisher.publishCommentModerationEvent).toHaveBeenCalledWith(
      't1',
      'c1',
      'ext-1',
      ContentStatus.HIDDEN,
      'BANNED_WORD_DETECTED',
    );
  });

  it('lets an explicit moderator status win over the banned-word auto-hide', async () => {
    current(ContentStatus.HIDDEN);
    moderationPolicy.checkBannedWords.mockResolvedValue(true);

    await service.update('t1', 'c1', {
      content: 'parolaccia',
      status: ContentStatus.VISIBLE,
    });

    expect(prisma.comment.update.mock.calls[0][0].data.status).toBe(
      ContentStatus.VISIBLE,
    );
    expect(
      webhookPublisher.publishCommentModerationEvent,
    ).not.toHaveBeenCalled();
  });

  it('reports a banned-word edit as the system user, on the comment id', async () => {
    current(ContentStatus.VISIBLE);
    moderationPolicy.checkBannedWords.mockResolvedValue(true);

    await service.update('t1', 'c1', { content: 'parolaccia' });

    expect(prisma.report.create.mock.calls[0][0].data).toMatchObject({
      targetId: 'c1',
      reporterId: SYSTEM_REPORTER_ID,
      tenantId: 't1',
    });
  });

  describe('create with a banned word', () => {
    beforeEach(() => {
      moderationPolicy.applyCreationPolicy.mockResolvedValue({
        finalStatus: ContentStatus.HIDDEN,
        autoModerated: true,
        reason: 'BANNED_WORD_DETECTED',
        shouldCreateSystemReport: true,
      });
    });

    const create = () =>
      service.create('t1', {
        articleId: 'a1',
        content: 'parolaccia',
        authorExternalId: 'ext-1',
      });

    it('creates the comment first and reports it by comment id, not article id', async () => {
      await create();

      expect(prisma.comment.create).toHaveBeenCalled();
      expect(prisma.report.create.mock.calls[0][0].data).toMatchObject({
        targetType: 'COMMENT',
        targetId: 'new-comment',
        reporterId: SYSTEM_REPORTER_ID,
      });
      expect(prisma.comment.create.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.report.create.mock.invocationCallOrder[0],
      );
    });

    it('provisions the system reporter in the same tenant (FK onto users)', async () => {
      await create();

      expect(prisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            externalId_tenantId: {
              externalId: SYSTEM_REPORTER_ID,
              tenantId: 't1',
            },
          },
        }),
      );
    });

    it('runs comment and report in one transaction', async () => {
      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = { ...prisma, report: { create: jest.fn() } };
        tx.report.create.mockRejectedValue(new Error('fk'));
        return fn(tx);
      });
      await expect(create()).rejects.toThrow('fk');
      expect(
        webhookPublisher.publishCommentModerationEvent,
      ).not.toHaveBeenCalled();
    });
  });
});
