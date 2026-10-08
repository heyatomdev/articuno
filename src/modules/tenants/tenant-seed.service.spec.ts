import { Logger } from '@nestjs/common';
import { configValidationSchema } from '@/configs/config.validation';
import { TenantSeedService } from './tenant-seed.service';

const base = { DATABASE_URL: 'postgres://x', BASTION_URL: 'http://bastion' };
const seedFlag = (env: Record<string, string>) =>
  configValidationSchema.validate({ ...base, ...env }).value
    .SEED_DEFAULT_TENANT;

describe('SEED_DEFAULT_TENANT', () => {
  it('defaults to off in production and on elsewhere', () => {
    expect(seedFlag({ NODE_ENV: 'production' })).toBe(false);
    expect(seedFlag({ NODE_ENV: 'development' })).toBe(true);
  });

  it('can be turned on explicitly in production', () => {
    expect(
      seedFlag({ NODE_ENV: 'production', SEED_DEFAULT_TENANT: 'true' }),
    ).toBe(true);
  });
});

describe('TenantSeedService', () => {
  const prisma = {
    tenant: { findUnique: jest.fn(), create: jest.fn() },
  };
  const bannedWordsSeed = { seedDefaultBannedWords: jest.fn() };
  const make = (env: Record<string, unknown>) =>
    new TenantSeedService(
      prisma as any,
      bannedWordsSeed as any,
      { get: (k: string) => env[k] } as any,
    );

  let logged: string[];
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.tenant.create.mockImplementation(({ data }) => ({
      id: 't1',
      ...data,
    }));
    logged = [];
    const capture = (msg: string) => void logged.push(msg);
    jest
      .spyOn((TenantSeedService as any).prototype, 'generateApiKey')
      .mockReturnValue('PLAINKEY');
    for (const level of ['log', 'warn'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(capture);
    }
  });

  it('does nothing when the flag is off', async () => {
    await make({ SEED_DEFAULT_TENANT: false }).onModuleInit();
    expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('never logs the plain API key in production', async () => {
    await make({
      SEED_DEFAULT_TENANT: true,
      NODE_ENV: 'production',
    }).onModuleInit();
    expect(prisma.tenant.create).toHaveBeenCalled();
    expect(logged.join('\n')).not.toContain('PLAINKEY');
  });

  it('logs the key in development and takes the webhook from config', async () => {
    await make({
      SEED_DEFAULT_TENANT: true,
      NODE_ENV: 'development',
      SEED_WEBHOOK_URL: 'http://hook.local/w',
    }).onModuleInit();
    expect(logged.join('\n')).toContain('PLAINKEY');
    expect(prisma.tenant.create.mock.calls[0][0].data.webhookUrl).toBe(
      'http://hook.local/w',
    );
  });
});
