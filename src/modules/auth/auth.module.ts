import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/prisma/prisma.module';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthJob } from '@/modules/auth/auth.job';
import { PasswordService } from '@/modules/utils/password.service';
import { SessionGuard } from '@/modules/auth/guards/session.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionGuard, AuthJob],
  exports: [SessionGuard],
})
export class AuthModule {}
