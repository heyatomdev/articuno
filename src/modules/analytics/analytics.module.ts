import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {AnalyticsService} from "@/modules/analytics/analytics.service";
import {AnalyticsJob} from "@/modules/analytics/analytics.job";

@Module({
  imports: [PrismaModule],
  providers: [AnalyticsService, AnalyticsJob],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
