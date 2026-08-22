import { describe, expect, it } from 'vitest';
import { parseCreateGuestDto, parseGuestId, parseUpdateGuestDto } from '../src/guests/guests.dto.js';

const validCreate = {
  firstName: '  Ada ',
  lastName: ' Lovelace  ',
  birthDate: '',
  nationality: ' gb ',
  email: ' ADA@EXAMPLE.COM ',
  phone: '   ',
  address: ' London ',
  emergencyContact: '',
  notes: ' First programmer ',
  primaryDocument: { type: 'passport', issuingCountry: ' gb ', documentNumber: ' ab 123 ', expiresOn: '' },
};

describe('guest DTOs', () => {
  it('normalizes names, identity fields, countries, email, and blank nullable fields', () => {
    expect(parseCreateGuestDto(validCreate)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      birthDate: null,
      nationality: 'GB',
      email: 'ada@example.com',
      phone: null,
      address: 'London',
      emergencyContact: null,
      notes: 'First programmer',
      primaryDocument: { type: 'passport', issuingCountry: 'GB', documentNumber: 'AB 123', expiresOn: null },
    });
  });

  it('distinguishes omitted fields from explicit null and blank in patches', () => {
    expect(parseUpdateGuestDto({ phone: null })).toEqual({ phone: null });
    expect(parseUpdateGuestDto({ address: '   ' })).toEqual({ address: null });
    expect(parseUpdateGuestDto({ firstName: ' Grace ' })).toEqual({ firstName: 'Grace' });
  });

  it('rejects empty updates, empty nested document updates, and unexpected properties', () => {
    expect(() => parseUpdateGuestDto({})).toThrow('Invalid request body');
    expect(() => parseUpdateGuestDto({ primaryDocument: {} })).toThrow('Invalid request body');
    expect(() => parseCreateGuestDto({ ...validCreate, propertyId: 'must-not-pass' })).toThrow('Invalid request body');
  });

  it('validates UUIDs, ISO countries, ISO dates, and maximum lengths', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(parseGuestId(id)).toBe(id);
    expect(() => parseGuestId('not-a-uuid')).toThrow('Invalid guest ID');
    expect(() => parseCreateGuestDto({ ...validCreate, nationality: 'Peru' })).toThrow('Invalid request body');
    expect(() => parseCreateGuestDto({ ...validCreate, primaryDocument: { ...validCreate.primaryDocument, issuingCountry: 'USA' } })).toThrow('Invalid request body');
    expect(() => parseCreateGuestDto({ ...validCreate, birthDate: '2026-02-30' })).toThrow('Invalid request body');
    expect(() => parseCreateGuestDto({ ...validCreate, notes: 'x'.repeat(2001) })).toThrow('Invalid request body');
  });
});
