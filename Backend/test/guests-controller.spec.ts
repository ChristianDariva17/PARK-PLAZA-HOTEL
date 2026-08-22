import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import { GuestsController } from '../src/guests/guests.controller.js';
import type { GuestsService } from '../src/guests/guests.service.js';

const actor = { accountId: 'account-id', propertyId: 'property-id', roleKey: 'receptionist', email: 'user@example.com', permissions: ['guests.read', 'guests.create', 'guests.update'], sessionId: 'session-id', passwordChangeRequired: false } satisfies AuthenticatedAccount;
const request = { auth: actor, id: 'request-id', ip: '127.0.0.1', headers: { 'user-agent': 'test-agent' } };
const createBody = { firstName: 'Ada', lastName: 'Lovelace', primaryDocument: { type: 'passport', issuingCountry: 'GB', documentNumber: 'AB123' } };

describe('GuestsController property authority', () => {
  it('derives list scope exclusively from the authenticated account', async () => {
    const service = { list: vi.fn().mockResolvedValue([]) } as unknown as GuestsService;
    await new GuestsController(service).list(actor);
    expect(service.list).toHaveBeenCalledWith('property-id');
  });

  it('forwards actor and request context while rejecting request-provided scope', async () => {
    const service = { create: vi.fn().mockResolvedValue({ id: 'guest-id' }) } as unknown as GuestsService;
    const controller = new GuestsController(service);
    await controller.create(createBody, actor, request as never);
    expect(service.create).toHaveBeenCalledWith(actor, createBody, { requestId: 'request-id', ipAddress: '127.0.0.1', userAgent: 'test-agent' });
    expect(() => controller.create({ ...createBody, propertyId: 'other-property' }, actor, request as never)).toThrow('Invalid request body');
    expect(service.create).toHaveBeenCalledTimes(1);
  });

  it('parses the route UUID before invoking update', () => {
    const service = { update: vi.fn() } as unknown as GuestsService;
    const controller = new GuestsController(service);
    expect(() => controller.update('not-a-uuid', { firstName: 'Grace' }, actor, request as never)).toThrow('Invalid guest ID');
    expect(service.update).not.toHaveBeenCalled();
  });
});
