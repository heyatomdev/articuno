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
 *
 * It is also re-exported, and that is not decoration. A controller-scoped
 * `@UseGuards(AdminAuthGuard)` is instantiated in the injector of the module that
 * declares the controller, not in this one — so `AdminModule` has to be able to
 * resolve every constructor argument of `AdminAuthGuard`, `SessionGuard` included.
 * Exporting the guard alone gets you a runtime UnknownDependenciesException that
 * neither `tsc` nor the specs can see. Re-exporting `AuthModule` keeps that detail
 * here, where the fallback lives, instead of making every consumer import a module
 * it has no other reason to know about.
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  providers: [BastionJwksService, BastionUserGuard, AdminAuthGuard],
  exports: [BastionJwksService, BastionUserGuard, AdminAuthGuard, AuthModule],
})
export class BastionModule {}
