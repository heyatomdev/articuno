import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/modules/prisma/prisma.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const sessionId = request.cookies?.sessionId;

    if (!sessionId) {
      throw new UnauthorizedException('Sessione non trovata');
    }

    const session = await this.prisma.sessionStorage.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Sessione non valida');
    }

    const now = new Date();
    if (session.expiresAt < now) {
      throw new UnauthorizedException('Sessione scaduta');
    }

    if (session.user.tenantId !== session.tenantId) {
      throw new UnauthorizedException('Sessione non valida');
    }

    // Aggiorna lastAccessedAt
    await this.prisma.sessionStorage.update({
      where: { id: sessionId },
      data: { lastAccessedAt: now },
    });

    // Attach session to request
    request.session = session;

    return true;
  }
}

