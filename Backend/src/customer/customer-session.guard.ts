import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment.js';
import { getRequestContext } from '../auth/request-context.js';
import { CustomerAuthService } from './customer-auth.service.js';
import type { CustomerAuthenticatedRequest } from './customer.types.js';

@Injectable()
export class CustomerSessionGuard implements CanActivate {
  constructor(private readonly sessions: CustomerAuthService, private readonly config: ConfigService<Environment, true>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<CustomerAuthenticatedRequest>();
    const token = request.cookies?.[this.config.get('CUSTOMER_COOKIE_NAME', { infer: true })];
    if (!token) throw new UnauthorizedException('Customer authentication required');
    const customer = await this.sessions.resolve(token, getRequestContext(request));
    if (!customer) throw new UnauthorizedException('Customer authentication required');
    request.customer = customer;
    return true;
  }
}
