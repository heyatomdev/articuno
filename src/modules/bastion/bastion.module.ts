import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { BastionJwksService } from './bastion-jwks.service';
import { BastionUserGuard } from './guards/bastion-user.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';

/**
 * Bastion user-JWT auth for `/admin/*`.
 *
 * Deliberately narrower than Gatherly's equivalent: no `BastionService`
 * (service-client flow) and no `BastionAuditService` — Articuno keeps its own
 * `AuditLog`, which carries resource columns that Bastion's `AuditEvent` does not
 * have, so nothing here needs a machine token towards Bastion.
 *
 * `AuthModule` is imported only for the legacy `SessionGuard` that `AdminAuthGuard`
 * falls back on; both go away once the console cuts over.
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  providers: [BastionJwksService, BastionUserGuard, AdminAuthGuard],
  exports: [BastionJwksService, BastionUserGuard, AdminAuthGuard],
})
export class BastionModule {}
