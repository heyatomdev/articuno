import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { addMinutes } from 'date-fns';
import { PrismaService } from '@/modules/prisma/prisma.service';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { PasswordService } from '@/modules/utils/password.service';
import { MeResponseDto } from '@/modules/auth/dto/me-response.dto';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const SESSION_TTL_DAYS = 7;

interface LoginContext {
  ipAddress?: string;
  userAgent?: string;
}

interface AuthSessionContext {
  id: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain || localPart.length === 0) {
      return email; // fallback if email format is invalid
    }
    const firstChar = localPart[0];
    return `${firstChar}***@${domain}`;
  }

  async login(dto: LoginDto, context: LoginContext) {
    const now = new Date();
    const credentials = await this.prisma.adminCredentials.findUnique({
      where: { email: dto.email },
      include: { user: true },
    });

    // Do not reveal whether the account exists.
    if (!credentials || credentials.disabledAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (credentials.isLockedOut && credentials.lockedUntil && credentials.lockedUntil > now) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (credentials.isLockedOut && credentials.lockedUntil && credentials.lockedUntil <= now) {
      await this.prisma.adminCredentials.update({
        where: { id: credentials.id },
        data: {
          isLockedOut: false,
          lockedUntil: null,
          loginAttempts: 0,
        },
      });
    }

    const isPasswordValid = await this.passwordService.comparePassword(
      dto.password,
      credentials.password,
    );

    if (!isPasswordValid) {
      const nextAttempts = credentials.loginAttempts + 1;
      const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;

      await this.prisma.adminCredentials.update({
        where: { id: credentials.id },
        data: {
          loginAttempts: nextAttempts,
          isLockedOut: shouldLock,
          lockedUntil: shouldLock ? addMinutes(now, LOCKOUT_MINUTES) : null,
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.adminCredentials.update({
        where: { id: credentials.id },
        data: {
          loginAttempts: 0,
          isLockedOut: false,
          lockedUntil: null,
          lastLoginAt: now,
        },
      });

      return tx.sessionStorage.create({
        data: {
          userId: credentials.userId,
          tenantId: credentials.user.tenantId,
          userRole: credentials.user.role,
          externalId: credentials.user.externalId,
          expiresAt,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
    });

    return {
      sessionId: session.id,
      expiresAt,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.sessionStorage.delete({
      where: { id: sessionId },
    });
  }

  async refreshSession(sessionId: string) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const session = await this.prisma.sessionStorage.update({
      where: { id: sessionId },
      data: {
        expiresAt,
        lastAccessedAt: now,
      },
    });

    return {
      sessionId: session.id,
      expiresAt,
    };
  }

   async getMe(session: AuthSessionContext): Promise<MeResponseDto> {
     const user = await this.prisma.user.findFirst({
       where: {
         id: session.userId,
         tenantId: session.tenantId,
       },
       include: {
         tenant: true,
         adminCredentials: {
           select: {
             email: true,
             totpEnabled: true,
             lastLoginAt: true,
             lastPasswordChangeAt: true,
             createdAt: true,
             updatedAt: true,
           },
         },
       },
     });

     if (!user) {
       throw new NotFoundException('Utente non trovato');
     }

     if (!user.adminCredentials) {
       throw new ForbiddenException('Accesso admin non disponibile');
     }

     return {
       id: user.id,
       externalId: user.externalId,
       email: this.maskEmail(user.adminCredentials.email),
       role: user.role,
       status: user.status,
       language: user.language,
       username: user.username,
       avatarUrl: user.avatarUrl,
       totpEnabled: user.adminCredentials.totpEnabled,
       lastLoginAt: user.adminCredentials.lastLoginAt,
       lastPasswordChangeAt: user.adminCredentials.lastPasswordChangeAt,
       credentialsCreatedAt: user.adminCredentials.createdAt,
       credentialsUpdatedAt: user.adminCredentials.updatedAt,
       tenant: {
         id: user.tenantId,
         name: user.tenant.name,
         domain: user.tenant.domain,
         enabled: user.tenant.enabled,
       },
       session: {
         id: session.id,
         expiresAt: session.expiresAt,
       },
     };
   }

   async updateEmail(session: AuthSessionContext, newEmail: string, password: string): Promise<void> {
     const credentials = await this.prisma.adminCredentials.findUnique({
       where: {
         userId: session.userId,
       },
     });

     if (!credentials) {
       throw new NotFoundException('Credenziali admin non trovate');
     }

     const isPasswordValid = await this.passwordService.comparePassword(
       password,
       credentials.password,
     );

     if (!isPasswordValid) {
       throw new UnauthorizedException('Password non valida');
     }

     // Check if email is already in use
     const existingEmail = await this.prisma.adminCredentials.findUnique({
       where: { email: newEmail },
     });

     if (existingEmail && existingEmail.id !== credentials.id) {
       throw new ForbiddenException('Email già in uso');
     }

     await this.prisma.adminCredentials.update({
       where: { id: credentials.id },
       data: { email: newEmail },
     });
   }

   async updatePassword(
     session: AuthSessionContext,
     currentPassword: string,
     newPassword: string,
     confirmPassword: string,
   ): Promise<void> {
     if (newPassword !== confirmPassword) {
       throw new ForbiddenException('Le password non corrispondono');
     }

     const credentials = await this.prisma.adminCredentials.findUnique({
       where: {
         userId: session.userId,
       },
     });

     if (!credentials) {
       throw new NotFoundException('Credenziali admin non trovate');
     }

     const isPasswordValid = await this.passwordService.comparePassword(
       currentPassword,
       credentials.password,
     );

     if (!isPasswordValid) {
       throw new UnauthorizedException('Password attuale non valida');
     }

     const passwordStrength = this.passwordService.validatePasswordStrength(newPassword);
     if (!passwordStrength.isValid) {
       throw new ForbiddenException(passwordStrength.errors.join(', '));
     }

     const hashedPassword = await this.passwordService.hashPassword(newPassword);

     await this.prisma.adminCredentials.update({
       where: { id: credentials.id },
       data: {
         password: hashedPassword,
         lastPasswordChangeAt: new Date(),
       },
     });
   }
 }
