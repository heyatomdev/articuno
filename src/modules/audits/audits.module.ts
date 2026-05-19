import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { AuditsService } from '@/modules/audits/audits.service';
import { AuditLoggerService } from '@/modules/audits/audit-logger.service';

@Module({
  imports: [PrismaModule],
  providers: [AuditsService, AuditLoggerService],
  exports: [AuditsService, AuditLoggerService],
})
export class AuditsModule {}

