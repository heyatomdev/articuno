import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';

@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, {
      ipAddress: res.req.ip,
      userAgent: res.req.get('user-agent') ?? undefined,
    });

    res.cookie('sessionId', result.sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: result.expiresAt,
      path: '/',
    });

    return { ok: true };
  }

  @Delete('logout')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@GetSession() session: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(session.id);

    res.clearCookie('sessionId', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return { ok: true };
  }

  @Post('refresh')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(@GetSession() session: any, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.refreshSession(session.id);

    res.cookie('sessionId', result.sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: result.expiresAt,
      path: '/',
    });

    return {
      ok: true,
      expiresAt: result.expiresAt,
    };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@GetSession() session: any) {
    return this.authService.getMe(session);
  }
}

