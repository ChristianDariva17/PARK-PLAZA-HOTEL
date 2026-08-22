import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../src/auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import { StaysController } from '../src/stays/stays.controller.js';
import type { StaysService } from '../src/stays/stays.service.js';

const actor = {
  accountId: 'account-id', propertyId: 'property-id', roleKey: 'receptionist', email: 'reception@example.invalid',
  permissions: ['stays.read', 'stays.check_in', 'stays.check_out', 'cleaning.progress'], sessionId: 'session-id', passwordChangeRequired: false,
} satisfies AuthenticatedAccount;
const request = { auth: actor, id: 'request-id', ip: '127.0.0.1', headers: { 'user-agent': 'test-agent' } };
const key = '6ba7b811-9dad-41d1-80b4-00c04fd430c8';
const roomId = '550e8400-e29b-41d4-a716-446655440000';
const guestId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

describe('StaysController authority and command contracts', () => {
  it('derives check-in and cleaning scope from the authenticated account and request context', async () => {
    const service = {
      checkIn: vi.fn().mockResolvedValue({ id: 'stay-id' }), cleaningComplete: vi.fn().mockResolvedValue({ id: 'stay-id' }),
    } as unknown as StaysService;
    const controller = new StaysController(service);

    await controller.checkIn('reservation-id', {}, key, actor, request as never);
    await controller.cleaningComplete(roomId, key, actor, request as never);

    expect(service.checkIn).toHaveBeenCalledWith(actor, 'reservation-id', {}, key, { requestId: 'request-id', ipAddress: '127.0.0.1', userAgent: 'test-agent' });
    expect(service.cleaningComplete).toHaveBeenCalledWith(actor, roomId, key, { requestId: 'request-id', ipAddress: '127.0.0.1', userAgent: 'test-agent' });
  });

  it('parses strict walk-in input and forwards only a valid idempotency key', async () => {
    const service = { walkIn: vi.fn().mockResolvedValue({ id: 'stay-id' }) } as unknown as StaysService;
    const controller = new StaysController(service);
    const body = { roomId, primaryGuestId: guestId, guestIds: [guestId], checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-03-01T11:00:00.000Z', guestCount: 1 };

    await controller.walkIn(body, key, actor, request as never);

    expect(service.walkIn).toHaveBeenCalledWith(actor, body, key, { requestId: 'request-id', ipAddress: '127.0.0.1', userAgent: 'test-agent' });
    expect(() => controller.walkIn({ ...body, propertyId: 'foreign-property' }, key, actor, request as never)).toThrow('Invalid request body');
    expect(() => controller.walkIn(body, 'not-a-uuid', actor, request as never)).toThrow('Invalid Idempotency-Key');
  });

  it('declares the lifecycle permissions required by every route', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, StaysController.prototype.list)).toEqual(['stays.read']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, StaysController.prototype.checkIn)).toEqual(['stays.check_in']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, StaysController.prototype.walkIn)).toEqual(['stays.check_in']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, StaysController.prototype.checkOut)).toEqual(['stays.check_out']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, StaysController.prototype.cleaningComplete)).toEqual(['cleaning.progress']);
  });
});
