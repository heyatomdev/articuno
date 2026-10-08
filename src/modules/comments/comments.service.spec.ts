import { BadRequestException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { CommentsService } from './comments.service';

describe('CommentsService.update', () => {
  const prisma = {
    comment: { findFirst: jest.fn(), update: jest.fn() },
  };
  const moderationPolicy = { checkBannedWords: jest.fn() };
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
    prisma.comment.update.mockImplementation(({ data }) => ({
      id: 'c1',
      ...data,
    }));
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
});
