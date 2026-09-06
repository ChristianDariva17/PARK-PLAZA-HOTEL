import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../auth/decorators/public.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import type { Environment } from '../config/environment.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { parseFirebaseExchangeDto } from './customer.dto.js';
import { CustomerSessionGuard } from './customer-session.guard.js';
import type { CustomerAuthenticatedRequest } from './customer.types.js';

@Public()
@Controller('customer/auth')
export class CustomerAuthController {
  constructor(private readonly sessions: CustomerAuthService, private readonly config: ConfigService<Environment, true>) {}

  @Post('session')
  @HttpCode(200)
  async exchange(@Body() body: unknown, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.sessions.exchange(parseFirebaseExchangeDto(body).idToken, getRequestContext(request));
    reply.setCookie(this.cookieName(), result.token, this.cookieOptions(result.expiresAt));
    return { customer: result.customer, expiresAt: result.expiresAt };
  }

  @Get('session')
  @UseGuards(CustomerSessionGuard)
  session(@Req() request: CustomerAuthenticatedRequest) {
    const customer = request.customer!;
    return { customer: { customerAccountId: customer.customerAccountId, email: customer.email, displayName: customer.displayName, photoUrl: customer.photoUrl } };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.sessions.revoke(request.cookies?.[this.cookieName()], getRequestContext(request));
    reply.clearCookie(this.cookieName(), this.cookieOptions());
  }

  private cookieName(): string {
    return this.config.get('CUSTOMER_COOKIE_NAME', { infer: true });
  }

  private cookieOptions(expires?: Date) {
    return { path: '/api', httpOnly: true, sameSite: 'strict' as const, secure: this.config.get('NODE_ENV', { infer: true }) === 'production', priority: 'high' as const, ...(expires ? { expires } : {}) };
  }
}
