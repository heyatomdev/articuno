import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ModerationModule } from '@/modules/moderation/moderation.module';
import { AuditsModule } from '@/modules/audits/audits.module';

@Module({
  imports: [PrismaModule, ModerationModule, AuditsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
