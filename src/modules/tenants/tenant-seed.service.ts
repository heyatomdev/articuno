import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class TenantSeedService implements OnModuleInit {
  private readonly logger = new Logger(TenantSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultTenant();
  }

  /**
   * Seeds a default tenant if it doesn't already exist
   * Default tenant credentials:
   * - Slug: "default"
   * - Domain: "localhost:3000"
   * - API Key (plain): Auto-generated random key (production-ready)
   * - Webhook URL: "http://localhost:8000/webhook" (optional, for local development)
   */
  private async seedDefaultTenant(): Promise<void> {
    try {
      const defaultSlug = 'default';

      // Check if default tenant already exists
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { slug: defaultSlug },
      });

      if (existingTenant) {
        this.logger.log('✅ Default tenant already exists, skipping seed.');
        return;
      }

      // Generate a production-ready random API key (64 hex characters)
      const plainApiKey = this.generateApiKey();

      // Log the plain API key BEFORE hashing it
      this.logger.log('🔑 Generated API Key (save this securely):');
      this.logger.log(`   ${plainApiKey}`);

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
          webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:8000/webhook',
          webhookSecret: this.generateWebhookSecret(),
        },
      });

      this.logger.log(
        `🌱 Default tenant seeded successfully!`,
      );
      this.logger.log(`   Tenant ID: ${defaultTenant.id}`);
      this.logger.log(`   Slug: ${defaultTenant.slug}`);
      this.logger.log(`   Domain: ${defaultTenant.domain}`);
      this.logger.log(`   ⚠️  Header to use: x-api-key: ${plainApiKey}`);
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

