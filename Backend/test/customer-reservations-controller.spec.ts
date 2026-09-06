import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Environment } from '../src/config/environment.js';
import { CustomerReservationsController } from '../src/customer/customer-reservations.controller.js';
import type { ReservationsService } from '../src/reservations/reservations.service.js';
import type { RoomsService } from '../src/rooms/rooms.service.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440000';
const query = { checkInDate: '2028-02-28', checkOutDate: '2028-03-01', guestCount: '2' };
const idempotencyKey = '550e8400-e29b-41d4-a716-446655440099';

describe('CustomerReservationsController authority', () => {
  it('derives public availability property scope only from server configuration', async () => {
    const reservations = { customerAvailability: vi.fn().mockResolvedValue({ categories: [] }) } as unknown as ReservationsService;
    const config = { get: vi.fn().mockReturnValue(propertyId) } as unknown as ConfigService<Environment, true>;
    const controller = new CustomerReservationsController(reservations, {} as RoomsService, config);
    await controller.availability(query);
    expect(reservations.customerAvailability).toHaveBeenCalledWith(propertyId, { ...query, guestCount: 2 });
    expect(() => controller.availability({ ...query, propertyId: 'attacker-property' })).toThrow('Invalid availability query');
  });

  it('forwards the authenticated customer as booking owner', async () => {
    const reservations = { createForCustomer: vi.fn().mockResolvedValue({ id: 'reservation-id' }) } as unknown as ReservationsService;
    const config = { get: vi.fn().mockReturnValue(propertyId) } as unknown as ConfigService<Environment, true>;
    const controller = new CustomerReservationsController(reservations, {} as RoomsService, config);
    const customer = { customerAccountId: 'customer-id', propertyId, sessionId: 'session-id', email: 'customer@example.com', displayName: null, photoUrl: null };
    const body = {
      categoryCode: 'suite', checkInDate: query.checkInDate, checkOutDate: query.checkOutDate, guestCount: 2,
      guest: { firstName: 'Ada', lastName: 'Lovelace', nationality: 'gb', primaryDocument: { type: 'passport', issuingCountry: 'gb', documentNumber: 'ab123' } },
    };
    const request = { customer, id: 'request-id', ip: '127.0.0.1', headers: { 'user-agent': 'test' } };
    await controller.create(body, idempotencyKey, request as never);
    expect(reservations.createForCustomer).toHaveBeenCalledWith(customer, expect.objectContaining({ categoryCode: 'SUITE', guest: expect.objectContaining({ primaryDocument: expect.objectContaining({ issuingCountry: 'GB', documentNumber: 'AB123' }) }) }), idempotencyKey, { requestId: 'request-id', ipAddress: '127.0.0.1', userAgent: 'test' });
  });

  it('uses both authenticated owner and configured property for detail access', async () => {
    const reservations = { customerDetail: vi.fn().mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440001' }) } as unknown as ReservationsService;
    const config = { get: vi.fn().mockReturnValue(propertyId) } as unknown as ConfigService<Environment, true>;
    const controller = new CustomerReservationsController(reservations, {} as RoomsService, config);
    const customer = { customerAccountId: 'customer-id', propertyId, sessionId: 'session-id', email: 'customer@example.com', displayName: null, photoUrl: null };
    const reservationId = '550e8400-e29b-41d4-a716-446655440001';
    await controller.detail(reservationId, { customer } as never);
    expect(reservations.customerDetail).toHaveBeenCalledWith(customer, reservationId);
  });
});
