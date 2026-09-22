import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantMiddleware } from '@/modules/tenants/middleware/tenant.middleware';
import { TenantSeedService } from '@/modules/tenants/tenant-seed.service';
import { BannedWordsModule } from '@/modules/banned-worlds/banned-words.module';

@Module({
  // BastionModule for BastionJwksService: TenantMiddleware accepts a Bastion
  // service-client Bearer alongside the X-API-Key.
  imports: [PrismaModule, BannedWordsModule],
  providers: [TenantMiddleware, TenantSeedService],
  exports: [TenantMiddleware],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      // Le probe di health e /status devono restare pubbliche: la voce
      // `health` da sola copriva solo il path nudo, non /health/live né
      // /health/ready, che rispondevano 401 "API Key mancante" a ogni
      // orchestratore e alla dashboard di Meridian.
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/{*path}', method: RequestMethod.GET },
        { path: 'status', method: RequestMethod.GET },
        { path: 'admin', method: RequestMethod.ALL },
        { path: 'admin/(.*)', method: RequestMethod.ALL },
      )
      .forRoutes('*'); // Applica a tutto il resto
  }
}
