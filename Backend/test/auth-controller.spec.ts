import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from '../src/auth/auth.controller.js';
import type { AuthService } from '../src/auth/auth.service.js';
import type { SessionService } from '../src/auth/session.service.js';
import type { Environment } from '../src/config/environment.js';

function controller(nodeEnv: Environment['NODE_ENV']) {
  const auth = { login: vi.fn(), changePassword: vi.fn().mockResolvedValue(undefined) } as unknown as AuthService;
  const sessions = { revoke: vi.fn().mockResolvedValue(undefined) } as unknown as SessionService;
  const config = { get: vi.fn((key: keyof Environment) => key === 'AUTH_COOKIE_NAME' ? 'pp_session' : nodeEnv) } as unknown as ConfigService<Environment, true>;
  return { instance: new AuthController(auth, sessions, config), auth, sessions };
}

describe('AuthController cookies', () => {
  it('sets the opaque token only in the hardened production cookie', async () => {
    const { instance, auth } = controller('production');
    const expiresAt = new Date('2030-01-01T00:00:00Z');
    vi.mocked(auth.login).mockResolvedValue({ token: 'opaque-token', sessionId: 'session-id', expiresAt, account: { id: 'account-id', propertyId: 'property-id', email: 'user@example.com', role: 'receptionist' } });
    const reply = { setCookie: vi.fn() };
    const request = { id: 'request-id', ip: '127.0.0.1', headers: {} };
    const response = await instance.login({ email: 'user@example.com', password: 'password' }, request as never, reply as never);
    expect(reply.setCookie).toHaveBeenCalledWith('pp_session', 'opaque-token', { path: '/api', httpOnly: true, sameSite: 'strict', secure: true, priority: 'high', expires: expiresAt });
    expect(response).not.toHaveProperty('token');
  });

  it('clears the cookie even when no session token is present', async () => {
    const { instance, sessions } = controller('development');
    const reply = { clearCookie: vi.fn() };
    const request = { id: 'request-id', ip: '127.0.0.1', headers: {}, cookies: {} };
    await instance.logout(request as never, reply as never);
    expect(sessions.revoke).toHaveBeenCalledWith(undefined, 'logout', { requestId: 'request-id', ipAddress: '127.0.0.1' });
    expect(reply.clearCookie).toHaveBeenCalledWith('pp_session', { path: '/api', httpOnly: true, sameSite: 'strict', secure: false, priority: 'high' });
  });

  it('clears the revoked session cookie after changing a password', async () => {
    const { instance, auth } = controller('development');
    const reply = { clearCookie: vi.fn() };
    const request = { auth: { accountId: 'account-id', propertyId: 'property-id' }, id: 'request-id', ip: '127.0.0.1', headers: {} };
    await instance.changePassword({ currentPassword: 'temporary password', newPassword: 'new secure password' }, request as never, reply as never);
    expect(auth.changePassword).toHaveBeenCalledWith(request.auth, { currentPassword: 'temporary password', newPassword: 'new secure password' }, { requestId: 'request-id', ipAddress: '127.0.0.1' });
    expect(reply.clearCookie).toHaveBeenCalledWith('pp_session', expect.objectContaining({ path: '/api', httpOnly: true }));
  });
});
