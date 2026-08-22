import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import { RoomsController } from '../src/rooms/rooms.controller.js';
import type { RoomsService } from '../src/rooms/rooms.service.js';

const roomId = '550e8400-e29b-41d4-a716-446655440000';
const actor = { accountId: 'account-id', propertyId: 'property-id', roleKey: 'receptionist', email: 'user@example.com', permissions: ['rooms.read', 'rooms.update', 'rooms.block'], sessionId: 'session-id', passwordChangeRequired: false } satisfies AuthenticatedAccount;
const request = { auth: actor, id: 'request-id', ip: '127.0.0.1', headers: { 'user-agent': 'test-agent' } };

describe('RoomsController property authority', () => {
  it('derives list scope exclusively from the authenticated account', async () => {
    const service = { list: vi.fn().mockResolvedValue({ rooms: [], categories: [] }) } as unknown as RoomsService;
    await new RoomsController(service).list(actor);
    expect(service.list).toHaveBeenCalledWith(actor.propertyId);
  });

  it('forwards actor and request context without accepting property scope', async () => {
    const service = { update: vi.fn().mockResolvedValue({ id: roomId }) } as unknown as RoomsService;
    const controller = new RoomsController(service);
    await controller.update(roomId, { number: '204' }, actor, request as never);
    expect(service.update).toHaveBeenCalledWith(actor, roomId, { number: '204' }, { requestId: 'request-id', ipAddress: '127.0.0.1', userAgent: 'test-agent' });
    expect(() => controller.update(roomId, { number: '204', propertyId: 'other' }, actor, request as never)).toThrow('Invalid request body');
  });

  it('parses UUID and block DTO before invoking the service', () => {
    const service = { setBlocked: vi.fn() } as unknown as RoomsService;
    const controller = new RoomsController(service);
    expect(() => controller.setBlocked('invalid', { blocked: true, reason: 'Inspection' }, actor, request as never)).toThrow('Invalid room ID');
    expect(() => controller.setBlocked(roomId, { blocked: true, reason: '' }, actor, request as never)).toThrow('Invalid request body');
    expect(service.setBlocked).not.toHaveBeenCalled();
  });
});
