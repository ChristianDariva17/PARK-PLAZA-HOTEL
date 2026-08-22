import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../src/auth/decorators/require-permissions.decorator.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import { ReservationsController } from '../src/reservations/reservations.controller.js';
import type { ReservationsService } from '../src/reservations/reservations.service.js';

const actor = {
  accountId: 'account-id', propertyId: 'property-id', roleKey: 'receptionist', email: 'user@example.com',
  permissions: ['reservations.read', 'reservations.create'], sessionId: 'session-id', passwordChangeRequired: false,
} satisfies AuthenticatedAccount;
const request = { auth: actor, id: 'request-id', ip: '127.0.0.1', headers: { 'user-agent': 'test-agent' } };
const input = {
  roomId: '550e8400-e29b-41d4-a716-446655440000',
  primaryGuestId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-03-01T11:00:00.000Z', guestCount: 2,
};

describe('ReservationsController property authority', () => {
  it('derives list and availability scope only from the authenticated account', async () => {
    const service = { list: vi.fn().mockResolvedValue([]), availability: vi.fn().mockResolvedValue({ rooms: [] }) } as unknown as ReservationsService;
    const controller = new ReservationsController(service);
    await controller.list(actor);
    await controller.availability({ checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: '2' }, actor);
    expect(service.list).toHaveBeenCalledWith(actor.propertyId);
    expect(service.availability).toHaveBeenCalledWith(actor.propertyId, { checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: 2 });
    expect(() => controller.availability({ checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: '2', propertyId: 'other' }, actor)).toThrow('Invalid availability query');
  });

  it('parses strict create input and forwards actor plus request context', async () => {
    const service = { create: vi.fn().mockResolvedValue({ id: 'reservation-id' }) } as unknown as ReservationsService;
    const controller = new ReservationsController(service);
    await controller.create(input, actor, request as never);
    expect(service.create).toHaveBeenCalledWith(actor, input, { requestId: 'request-id', ipAddress: '127.0.0.1', userAgent: 'test-agent' });
    expect(() => controller.create({ ...input, propertyId: 'other' }, actor, request as never)).toThrow('Invalid request body');
  });

  it('declares authoritative permissions on every route', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, ReservationsController.prototype.list)).toEqual(['reservations.read']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, ReservationsController.prototype.availability)).toEqual(['reservations.create']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, ReservationsController.prototype.create)).toEqual(['reservations.create']);
  });
});
