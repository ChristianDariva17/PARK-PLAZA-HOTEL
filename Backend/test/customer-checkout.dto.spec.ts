import { describe, expect, it } from 'vitest';
import { parseCustomerCancelOrderDto, parseCustomerCreateOrderDto, parseCustomerIdempotencyKey } from '../src/customer/customer.dto.js';

const id = '550e8400-e29b-41d4-a716-446655440000';

describe('customer checkout transport contracts', () => {
  it('normalizes a required note while preserving the empty canonical value', () => {
    expect(parseCustomerCreateOrderDto({ stayId: id, deliveryMode: 'Room', paymentMode: 'room_charge', items: [{ menuItemId: id, quantity: 1 }], note: '  kitchen note  ' }).note).toBe('kitchen note');
    expect(parseCustomerCreateOrderDto({ stayId: id, deliveryMode: 'Terraza', paymentMode: 'online', items: [{ menuItemId: id, quantity: 1 }], note: '   ' }).note).toBe('');
  });

  it('rejects malformed keys, unsupported delivery values, oversized notes, and free-form cancellation reasons', () => {
    expect(() => parseCustomerIdempotencyKey('not-a-uuid')).toThrow();
    expect(() => parseCustomerCreateOrderDto({ stayId: id, deliveryMode: 'Lobby', paymentMode: 'room_charge', items: [{ menuItemId: id, quantity: 1 }], note: '' })).toThrow();
    expect(() => parseCustomerCreateOrderDto({ stayId: id, deliveryMode: 'Room', paymentMode: 'room_charge', items: [{ menuItemId: id, quantity: 1 }], note: 'x'.repeat(401) })).toThrow();
    expect(() => parseCustomerCancelOrderDto({ reasonCode: 'customer text' })).toThrow();
  });
});
