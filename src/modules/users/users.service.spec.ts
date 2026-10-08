import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { SYSTEM_REPORTER_ID } from './users.constants';

describe('UsersService hides the system reporter', () => {
  const prisma = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new UsersService(prisma as any);
  const notSystem = { externalId: { not: SYSTEM_REPORTER_ID } };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((ops) => Promise.all(ops));
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
  });

  it('excludes it from the admin list', async () => {
    await service.findAll('t1', { limit: 20, skip: 0 } as any);
    expect(prisma.user.findMany.mock.calls[0][0].where).toMatchObject({
      tenantId: 't1',
      ...notSystem,
    });
    expect(prisma.user.count.mock.calls[0][0].where).toMatchObject(notSystem);
  });

  it('404s on it by id', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.findOne('t1', 'sys-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.user.findFirst.mock.calls[0][0].where).toMatchObject(
      notSystem,
    );
  });

  it('refuses to sync or delete it through the public API', async () => {
    await expect(
      service.upsert('t1', { externalId: SYSTEM_REPORTER_ID } as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.deleteByExternalId('t1', SYSTEM_REPORTER_ID),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });
});
