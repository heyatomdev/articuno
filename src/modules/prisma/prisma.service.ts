import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const adapter = new PrismaPg({
      connectionString: config.get<string>('DATABASE_URL'),
      max: config.get<number>('DATABASE_POOL_MAX'),
      // pg's default is 0 = wait forever for a free connection; bound it so a
      // saturated pool fails the request instead of hanging it.
      connectionTimeoutMillis: config.get<number>('DATABASE_POOL_TIMEOUT_MS'),
    });
    super({ adapter });
  }

  /**
   * JIT `User` row for an external id. Prisma runs this upsert as
   * SELECT-then-INSERT, so a user's first two concurrent requests (a double
   * click) race on `users_externalId_tenantId_key`; the loser re-reads the row.
   */
  async ensureUser(tenantId: string, externalId: string) {
    const where = { externalId_tenantId: { externalId, tenantId } };
    try {
      return await this.user.upsert({
        where,
        update: {},
        create: { externalId, tenantId },
      });
    } catch (error) {
      if (error.code !== 'P2002') throw error;
      return this.user.findUniqueOrThrow({ where });
    }
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error(
        'Failed to connect to database',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Database disconnected successfully');
    } catch (error) {
      this.logger.error(
        'Failed to disconnect from database',
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
