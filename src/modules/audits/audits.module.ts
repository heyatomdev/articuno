import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { AuditsService } from '@/modules/audits/audits.service';

@Module({
  imports: [PrismaModule],
  providers: [AuditsService],
  exports: [AuditsService],
})
export class AuditsModule {}

