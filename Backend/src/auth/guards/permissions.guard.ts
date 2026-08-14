import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../auth.types.js';
import { REQUIRED_PERMISSIONS } from '../decorators/require-permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS, [context.getHandler(), context.getClass()]) ?? [];
    const granted = context.switchToHttp().getRequest<AuthenticatedRequest>().auth?.permissions ?? [];
    if (!required.every((permission) => granted.includes(permission))) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
