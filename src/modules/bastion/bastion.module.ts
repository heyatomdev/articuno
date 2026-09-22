import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { BastionJwksService } from './bastion-jwks.service';
import { BastionUserGuard } from './guards/bastion-user.guard';

/**
 * Bastion user-JWT auth for `/admin/*`.
 *
 * Deliberately narrower than Gatherly's equivalent: no `BastionService`
 * (service-client flow) and no `BastionAuditService` — Articuno keeps its own
 * `AuditLog`, which carries resource columns that Bastion's `AuditEvent` does not
 * have, so nothing here needs a machine token towards Bastion.
 */
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [BastionJwksService, BastionUserGuard],
  exports: [BastionJwksService, BastionUserGuard],
})
export class BastionModule {}
