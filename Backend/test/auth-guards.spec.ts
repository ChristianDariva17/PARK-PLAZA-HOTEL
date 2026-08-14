import { ForbiddenException, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { Environment } from '../src/config/environment.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../src/auth/auth.types.js';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard.js';
import { SessionGuard } from '../src/auth/guards/session.guard.js';
import type { SessionService } from '../src/auth/session.service.js';

const account: AuthenticatedAccount = {
  accountId: 'account-id', propertyId: 'property-id', roleKey: 'receptionist',
  email: 'user@example.com', permissions: ['reservations.read'], sessionId: 'session-id', passwordChangeRequired: false,
};

function executionContext(request: Partial<AuthenticatedRequest> = {}): ExecutionContext {
  Object.assign(request, {
    id: request.id ?? 'request-id',
    ip: request.ip ?? '127.0.0.1',
    headers: request.headers ?? {},
    cookies: request.cookies ?? {},
  });
  return {
    getHandler: () => executionContext,
    getClass: () => SessionGuard,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  it('bypasses intentionally public handlers', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as unknown as Reflector;
    const sessions = { resolve: vi.fn() } as unknown as SessionService;
    const config = { get: vi.fn().mockReturnValue('pp_session') } as unknown as ConfigService<Environment, true>;
    await expect(new SessionGuard(reflector, sessions, config).canActivate(executionContext({ cookies: {} }))).resolves.toBe(true);
    expect(sessions.resolve).not.toHaveBeenCalled();
  });

  it('rejects a missing session cookie', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const sessions = { resolve: vi.fn() } as unknown as SessionService;
    const config = { get: vi.fn().mockReturnValue('pp_session') } as unknown as ConfigService<Environment, true>;
    await expect(new SessionGuard(reflector, sessions, config).canActivate(executionContext({ cookies: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the resolved account to the request', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const sessions = { resolve: vi.fn().mockResolvedValue(account) } as unknown as SessionService;
    const config = { get: vi.fn().mockReturnValue('pp_session') } as unknown as ConfigService<Environment, true>;
    const request = { id: 'request-id', ip: '127.0.0.1', headers: {}, cookies: { pp_session: 'opaque-token' } } as unknown as AuthenticatedRequest;
    await expect(new SessionGuard(reflector, sessions, config).canActivate(executionContext(request))).resolves.toBe(true);
    expect(request.auth).toEqual(account);
    expect(sessions.resolve).toHaveBeenCalledWith('opaque-token', { requestId: 'request-id', ipAddress: '127.0.0.1' });
  });

  it('blocks ordinary handlers while a password change is required', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const sessions = { resolve: vi.fn().mockResolvedValue({ ...account, passwordChangeRequired: true }) } as unknown as SessionService;
    const config = { get: vi.fn().mockReturnValue('pp_session') } as unknown as ConfigService<Environment, true>;
    await expect(new SessionGuard(reflector, sessions, config).canActivate(executionContext({ cookies: { pp_session: 'opaque-token' } }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an explicitly marked password-change handler', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true) } as unknown as Reflector;
    const sessions = { resolve: vi.fn().mockResolvedValue({ ...account, passwordChangeRequired: true }) } as unknown as SessionService;
    const config = { get: vi.fn().mockReturnValue('pp_session') } as unknown as ConfigService<Environment, true>;
    await expect(new SessionGuard(reflector, sessions, config).canActivate(executionContext({ cookies: { pp_session: 'opaque-token' } }))).resolves.toBe(true);
  });
});

describe('PermissionsGuard', () => {
  it('allows an account with every required permission', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['reservations.read']) } as unknown as Reflector;
    expect(new PermissionsGuard(reflector).canActivate(executionContext({ auth: account }))).toBe(true);
  });

  it('rejects an account missing any required permission', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(['reservations.manage']) } as unknown as Reflector;
    expect(() => new PermissionsGuard(reflector).canActivate(executionContext({ auth: account }))).toThrow(ForbiddenException);
  });
});
