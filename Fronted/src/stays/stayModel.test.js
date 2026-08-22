import { describe, expect, it } from 'vitest';
import { adaptPersistentStayList, adaptStayCommandResponse, StayContractError } from './stayModel.js';

const stay = { id: '550e8400-e29b-41d4-a716-446655440000', reservationId: '550e8400-e29b-41d4-a716-446655440001', roomId: '550e8400-e29b-41d4-a716-446655440002', status: 'active', checkInAt: '2028-02-28T15:00:00.000Z', checkOutAt: null };
const response = { stay, folio: { id: '550e8400-e29b-41d4-a716-446655440003', stayId: stay.id, openingBalance: '0.00' }, reservation: { id: stay.reservationId, status: 'checked_in', checkInAt: stay.checkInAt, checkOutAt: '2028-03-01T11:00:00.000Z' }, room: { id: stay.roomId, status: 'occupied' } };

describe('stay response contract', () => {
  it('accepts the minimal zero-balance folio and authoritative lifecycle records', () => {
    expect(adaptStayCommandResponse(response)).toEqual(response);
    expect(adaptPersistentStayList([stay])).toEqual([stay]);
  });
  it('fails closed for payment data, non-zero folios, and invalid lifecycle transitions', () => {
    expect(() => adaptStayCommandResponse({ ...response, payment: {} })).toThrow(StayContractError);
    expect(() => adaptStayCommandResponse({ ...response, folio: { ...response.folio, openingBalance: '1.00' } })).toThrow(StayContractError);
    expect(() => adaptPersistentStayList([{ ...stay, status: 'checked_out', checkOutAt: null }])).toThrow(StayContractError);
  });
});
