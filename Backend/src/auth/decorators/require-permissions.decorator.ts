import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiExtension } from '@nestjs/swagger';

export const REQUIRED_PERMISSIONS = 'auth:permissions';
export const RequirePermissions = (...permissions: string[]) => applyDecorators(
  SetMetadata(REQUIRED_PERMISSIONS, permissions),
  ApiExtension('x-required-permissions', permissions),
);
