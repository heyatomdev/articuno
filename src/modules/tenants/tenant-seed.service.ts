import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BannedWordsSeedService } from '@/modules/banned-worlds/banned-words-seed.service';
import * as crypto from 'crypto';

@Injectable()
export class TenantSeedService implements OnModuleInit {
  private readonly logger = new Logger(TenantSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bannedWordsSeed: BannedWordsSeedService,
    private readonly config: ConfigService,
  ) {}

  /** `SEED_DEFAULT_TENANT` defaults to false in production, true elsewhere. */
  async onModuleInit() {
    if (this.config.get<boolean>('SEED_DEFAULT_TENANT')) {
      await this.seedDefaultTenant();
    }
  }

  /**
   * Seeds a default tenant if it doesn't already exist
   * Default tenant credentials:
   * - Slug: "default"
   * - Domain: "localhost:3000"
   * - API Key (plain): Auto-generated random key, logged outside production only
   * - Webhook URL: `SEED_WEBHOOK_URL` (unset = no webhook)
   */
  private async seedDefaultTenant(): Promise<void> {
    try {
      const defaultSlug = 'default';

      // Check if default tenant already exists
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { slug: defaultSlug },
      });

      if (existingTenant) {
        this.logger.log('Default tenant already exists, skipping seed.');
      } else {
        // Generate a production-ready random API key (64 hex characters)
        const plainApiKey = this.generateApiKey();

        // Hash the API key (SHA-256)
        const hashedApiKey = this.hashApiKey(plainApiKey);

        // Create default tenant
        const defaultTenant = await this.prisma.tenant.create({
          data: {
            slug: defaultSlug,
            name: 'Default Tenant',
            description: 'Default tenant for development and testing',
            domain: 'localhost:3000',
            defaultLanguage: 'it',
            apiKey: hashedApiKey,
            enabled: true,
            webhookUrl: this.config.get<string>('SEED_WEBHOOK_URL') || null,
            webhookSecret: this.generateWebhookSecret(),
          },
        });

        this.logger.log(`Default tenant seeded successfully!`);
        this.logger.log(`   Tenant ID: ${defaultTenant.id}`);
        this.logger.log(`   Slug: ${defaultTenant.slug}`);
        this.logger.log(`   Domain: ${defaultTenant.domain}`);
        // Never in production: log shippers keep it forever. There the tenant
        // authenticates with a Bastion service-client token instead.
        if (this.config.get<string>('NODE_ENV') === 'production') {
          this.logger.warn(
            '   API key generated but not logged in production: use a Bastion service-client token',
          );
        } else {
          this.logger.log(`   Header to use: x-api-key: ${plainApiKey}`);
        }

        // Seed default banned words for the new tenant
        await this.bannedWordsSeed.seedDefaultBannedWords(defaultTenant.id);
      }
    } catch (error) {
      this.logger.error(`Error seeding default tenant: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate a production-ready random API key (64 hex characters)
   * @returns A random API key
   */
  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash an API key using SHA-256
   * @param apiKey The plain API key to hash
   * @returns The hashed API key
   */
  private hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Generate a random webhook secret for HMAC signing
   * @returns A random secret
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

