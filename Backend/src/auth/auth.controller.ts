import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Environment } from '../config/environment.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { Public } from './decorators/public.decorator.js';
import { parseLoginDto } from './dto/login.dto.js';
import { parseChangePasswordDto } from './dto/change-password.dto.js';
import { AllowPasswordChangeRequired } from './decorators/allow-password-change-required.decorator.js';
import { getRequestContext } from './request-context.js';
import { SessionService } from './session.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: SessionService, private readonly config: ConfigService<Environment, true>) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.login(parseLoginDto(body), getRequestContext(request));
    reply.setCookie(this.cookieName(), result.token, this.cookieOptions(result.expiresAt));
    return { account: result.account, expiresAt: result.expiresAt };
  }

  @Get('session')
  @AllowPasswordChangeRequired()
  session(@Req() request: AuthenticatedRequest) {
    const auth = request.auth!;
    return { account: { id: auth.accountId, propertyId: auth.propertyId, email: auth.email, role: auth.roleKey }, permissions: auth.permissions, passwordChangeRequired: auth.passwordChangeRequired };
  }

  @Post('change-password')
  @AllowPasswordChangeRequired()
  @HttpCode(204)
  async changePassword(@Body() body: unknown, @Req() request: AuthenticatedRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.auth.changePassword(request.auth!, parseChangePasswordDto(body), getRequestContext(request));
    reply.clearCookie(this.cookieName(), this.cookieOptions());
  }

  @Post('logout')
  @Public()
  @AllowPasswordChangeRequired()
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.sessions.revoke(request.cookies?.[this.cookieName()], 'logout', getRequestContext(request));
    reply.clearCookie(this.cookieName(), this.cookieOptions());
  }

  private cookieName(): string { return this.config.get('AUTH_COOKIE_NAME', { infer: true }); }
  private cookieOptions(expires?: Date) {
    return { path: '/api', httpOnly: true, sameSite: 'strict' as const, secure: this.config.get('NODE_ENV', { infer: true }) === 'production', priority: 'high' as const, ...(expires ? { expires } : {}) };
  }
}
