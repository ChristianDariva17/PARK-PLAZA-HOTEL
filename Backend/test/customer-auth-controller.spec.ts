import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Environment } from '../src/config/environment.js';
import { CustomerAuthController } from '../src/customer/customer-auth.controller.js';
import type { CustomerAuthService } from '../src/customer/customer-auth.service.js';

describe('CustomerAuthController cookie boundary', () => {
  it('keeps the opaque token in a distinct hardened customer cookie', async () => {
    const expiresAt = new Date('2030-01-01T00:00:00.000Z');
    const sessions = { exchange: vi.fn().mockResolvedValue({ token: 'opaque-token', expiresAt, customer: { customerAccountId: 'customer-id', email: 'customer@example.com', displayName: null, photoUrl: null } }) } as unknown as CustomerAuthService;
    const config = { get: vi.fn((key: keyof Environment) => key === 'CUSTOMER_COOKIE_NAME' ? 'pp_customer_session' : 'production') } as unknown as ConfigService<Environment, true>;
    const controller = new CustomerAuthController(sessions, config);
    const reply = { setCookie: vi.fn() };
    const response = await controller.exchange({ idToken: 'firebase-token' }, { id: 'request-id', ip: '127.0.0.1', headers: {} } as never, reply as never);
    expect(reply.setCookie).toHaveBeenCalledWith('pp_customer_session', 'opaque-token', { path: '/api/customer', httpOnly: true, sameSite: 'strict', secure: true, priority: 'high', expires: expiresAt });
    expect(response).not.toHaveProperty('token');
    expect(response.customer).not.toHaveProperty('propertyId');
  });
});
