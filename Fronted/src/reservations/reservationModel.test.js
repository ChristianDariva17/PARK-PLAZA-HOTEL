import { describe, expect, it } from 'vitest';
import { adaptReservationAvailabilityResponse, adaptReservationCommandResponse, adaptReservationCreateResponse, adaptReservationDetailResponse, adaptReservationListResponse, buildReservationAvailabilityQuery, buildReservationCreateDto, buildReservationLifecycleDto, ReservationContractError } from './reservationModel.js';

const roomId = '550e8400-e29b-41d4-a716-446655440000';
const categoryId = '550e8400-e29b-41d4-a716-446655440001';
const guestId = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const reservationId = '6ba7b811-9dad-41d1-80b4-00c04fd430c8';
const input = { roomId, primaryGuestId: guestId, checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: '2028-03-01T11:00:00.000Z', guestCount: 2 };
const reservation = { id: reservationId, ...input, status: 'pending', nightlyRate: '123.45', totalAmount: '102.88', createdAt: '2026-08-14T12:00:00.000Z', updatedAt: '2026-08-14T12:00:00.000Z' };
const availability = { checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, durationMinutes: 1200, guestCount: 2, policy: { timezone: 'America/Lima', dayUseStart: '09:00', dayUseEnd: '18:00', dayUseMinimumMinutes: 180, reservationIntervalMinutes: 30 }, rooms: [{ roomId, categoryId, number: '101', floor: 1, capacity: 2, operationalStatus: 'available', nightlyRate: '123.45', totalAmount: '102.88' }] };

describe('interval reservation frontend contract', () => {
  it('accepts exact UTC response contracts without a client money calculation', () => {
    expect(adaptReservationListResponse([reservation])).toEqual([reservation]);
    expect(adaptReservationCreateResponse(reservation, input)).toEqual(reservation);
    expect(adaptReservationAvailabilityResponse(availability)).toEqual(availability);
  });
  it('fails closed on shadow fields, local dates, unknown statuses, or cleaning rooms', () => {
    for (const malformed of [{ ...reservation, checkIn: '2028-02-28' }, { ...reservation, checkInAt: '2028-02-28T15:00:00Z' }, { ...reservation, status: 'future' }]) expect(() => adaptReservationListResponse([malformed])).toThrow(ReservationContractError);
    expect(() => adaptReservationAvailabilityResponse({ ...availability, rooms: [{ ...availability.rooms[0], operationalStatus: 'cleaning' }] })).toThrow(ReservationContractError);
  });
  it('builds only strict UTC request fields', () => {
    expect(buildReservationAvailabilityQuery({ checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: '2' })).toEqual({ checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: 2 });
    expect(buildReservationCreateDto({ ...input, guestCount: '2' })).toEqual(input);
    expect(() => buildReservationCreateDto({ ...input, propertyId: roomId })).toThrow();
  });
  it('preserves civil dates and accepts only server-authoritative lifecycle envelopes', () => {
    const detail = { id: reservationId, status: 'pending', checkIn: '2028-02-28', checkOut: '2028-03-01', checkInAt: input.checkInAt, checkOutAt: input.checkOutAt, guestCount: 2, nightlyRate: '123.45', totalAmount: '102.88', createdAt: '2026-08-14T12:00:00.000Z', updatedAt: '2026-08-14T12:00:00.000Z', lifecycle: { changedAt: null, reason: null }, room: { id: roomId, number: '101', floor: 1 }, primaryGuest: { id: guestId, name: 'Ada Lovelace', documentType: 'dni', documentNumber: '123' }, permittedActions: ['confirm', 'cancel', 'disposition'] };
    expect(adaptReservationDetailResponse(detail).checkIn).toBe('2028-02-28');
    expect(adaptReservationCommandResponse({ reservation: detail, replayed: true }).replayed).toBe(true);
    expect(buildReservationLifecycleDto('cancel', { reason: '  Requested  ' })).toEqual({ reason: 'Requested' });
    expect(() => buildReservationLifecycleDto('disposition', { reason: 'x', disposition: 'cancelled' })).toThrow();
  });
});
