import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {TenantMiddleware} from "@/modules/tenants/middleware/tenant.middleware";

@Module({
    imports: [PrismaModule],
    providers: [TenantMiddleware],
    exports: [TenantMiddleware],
})
export class TenantModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(TenantMiddleware)
            .exclude({ path: 'health', method: RequestMethod.GET }) // Escludi health check
            .forRoutes('*'); // Applica a tutto il resto
    }
}
