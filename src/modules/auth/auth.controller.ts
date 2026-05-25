import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiBody,
} from '@nestjs/swagger';
import { AuthService } from '@/modules/auth/auth.service';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { UpdateEmailDto } from '@/modules/auth/dto/update-email.dto';
import { UpdatePasswordDto } from '@/modules/auth/dto/update-password.dto';
import { SessionGuard } from '@/modules/auth/guards/session.guard';
import { GetSession } from '@/modules/auth/decorators/get-session.decorator';

@ApiTags('Admin / Auth')
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin login',
    description:
      'Authenticates an admin user with email and password. On success, sets an HTTP-only `sessionId` cookie (7-day TTL) used to authenticate all subsequent admin requests.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful. `sessionId` cookie is set.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account locked.' })
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
  @ApiCookieAuth('sessionId')
  @ApiOperation({
    summary: 'Admin logout',
    description: 'Invalidates the current session and clears the `sessionId` cookie.',
  })
  @ApiResponse({ status: 200, description: 'Logout successful. `sessionId` cookie is cleared.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
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
  @ApiCookieAuth('sessionId')
  @ApiOperation({
    summary: 'Refresh session',
    description: 'Rotates the current session: issues a new `sessionId` cookie with a fresh 7-day TTL and invalidates the old one.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session refreshed. New `sessionId` cookie is set.',
    schema: { example: { ok: true, expiresAt: '2026-05-28T12:00:00.000Z' } },
  })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
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
  @ApiCookieAuth('sessionId')
  @ApiOperation({
    summary: 'Get current admin profile',
    description: 'Returns the profile and role information linked to the active session.',
  })
  @ApiResponse({ status: 200, description: 'Current admin user profile.' })
  @ApiResponse({ status: 401, description: 'Not authenticated – missing or expired session.' })
  async me(@GetSession() session: any) {
    return this.authService.getMe(session);
  }

  @Patch('email')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('sessionId')
  @ApiOperation({
    summary: 'Update admin email',
    description: 'Updates the email address of the currently authenticated admin. The current password must be provided for confirmation.',
  })
  @ApiBody({ type: UpdateEmailDto })
  @ApiResponse({ status: 200, description: 'Email updated successfully.' })
  @ApiResponse({ status: 401, description: 'Not authenticated or wrong password.' })
  async updateEmail(
    @GetSession() session: any,
    @Body() dto: UpdateEmailDto,
  ) {
    await this.authService.updateEmail(session, dto.newEmail, dto.password);
    return { ok: true };
  }

  @Patch('password')
  @UseGuards(SessionGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('sessionId')
  @ApiOperation({
    summary: 'Update admin password',
    description: 'Changes the password of the currently authenticated admin. Requires the current password and a matching new password pair (min 12 characters).',
  })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiResponse({ status: 200, description: 'Password updated successfully.' })
  @ApiResponse({ status: 401, description: 'Not authenticated or current password is wrong.' })
  @ApiResponse({ status: 400, description: 'New passwords do not match or fail validation.' })
  async updatePassword(
    @GetSession() session: any,
    @Body() dto: UpdatePasswordDto,
  ) {
    await this.authService.updatePassword(
      session,
      dto.currentPassword,
      dto.newPassword,
      dto.confirmPassword,
    );
    return { ok: true };
  }
}

