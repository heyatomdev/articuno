import { BadRequestException } from '@nestjs/common';
import { ContentStatus } from '@prisma/client';
import { ArticlesService } from './articles.service';

describe('ArticlesService.update status FSM', () => {
  const prisma = {
    article: { findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const webhookPublisher = { publishArticleStatusChangedEvent: jest.fn() };
  const service = new ArticlesService(
    prisma as any,
    {} as any,
    {} as any,
    webhookPublisher as any,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((fn) => fn(prisma));
    prisma.article.update.mockImplementation(({ data }) => ({
      id: 'a1',
      ...data,
    }));
  });

  it('rejects an invalid transition without writing', async () => {
    prisma.article.findFirst.mockResolvedValue({
      id: 'a1',
      status: ContentStatus.BANNED,
    });
    await expect(
      service.update('t1', 'a1', { status: ContentStatus.PUBLISHED }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('allows a valid transition and enqueues the status webhook', async () => {
    prisma.article.findFirst.mockResolvedValue({
      id: 'a1',
      status: ContentStatus.DRAFT,
    });
    await service.update('t1', 'a1', { status: ContentStatus.PUBLISHED });
    expect(prisma.article.update).toHaveBeenCalled();
    expect(
      webhookPublisher.publishArticleStatusChangedEvent,
    ).toHaveBeenCalledWith(
      't1',
      'a1',
      ContentStatus.DRAFT,
      ContentStatus.PUBLISHED,
      undefined,
      undefined,
      prisma,
    );
  });
});

describe('ArticlesService.assertOwnCoverImage', () => {
  const prisma = { tenant: { findFirst: jest.fn() } };
  const service = new ArticlesService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    prisma.tenant.findFirst.mockResolvedValue({
      fileharborEndpoint: 'https://fileharbor.local/v2',
    });
  });

  it('accepts an image of the tenant FileHarbor and an absent cover', async () => {
    await expect(
      service.assertOwnCoverImage(
        't1',
        'https://fileharbor.local/v2/images/abc',
      ),
    ).resolves.toBeUndefined();
    await expect(
      service.assertOwnCoverImage('t1', null),
    ).resolves.toBeUndefined();
  });

  it('rejects any other URL', async () => {
    await expect(
      service.assertOwnCoverImage('t1', 'https://evil.example/v2/images/abc'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a cover when the tenant has no FileHarbor configured', async () => {
    prisma.tenant.findFirst.mockResolvedValue({ fileharborEndpoint: null });
    await expect(
      service.assertOwnCoverImage(
        't1',
        'https://fileharbor.local/v2/images/abc',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
