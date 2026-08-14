import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Environment } from '../../config/environment.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { ALLOW_PASSWORD_CHANGE_REQUIRED } from '../decorators/allow-password-change-required.decorator.js';
import { getRequestContext } from '../request-context.js';
import { SessionService } from '../session.service.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly sessions: SessionService, private readonly config: ConfigService<Environment, true>) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[this.config.get('AUTH_COOKIE_NAME', { infer: true })];
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }
    const auth = await this.sessions.resolve(token, getRequestContext(request));
    if (!auth) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }
    request.auth = auth;
    const passwordChangeAllowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_REQUIRED, [context.getHandler(), context.getClass()]);
    if (auth.passwordChangeRequired && !passwordChangeAllowed) throw new ForbiddenException('Password change required');
    return true;
  }
}
