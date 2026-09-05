import { describe, expect, it } from 'vitest';
import { adaptGuestResponse, buildGuestCreateDto, buildGuestPatchDto } from './guestModel.js';

const response = {
  id: 'guest-1', firstName: 'Ana', lastName: 'Torres', birthDate: null, nationality: null, email: null, phone: '999', address: null, emergencyContact: null, notes: null, status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-02',
  primaryDocument: { id: 'document-1', type: 'dni', issuingCountry: 'PE', documentNumber: '12345678', expiresOn: null, createdAt: '2026-01-01', updatedAt: '2026-01-02' },
};

const form = {
  firstName: ' Ana ', lastName: ' Torres ', nationality: 'pe', email: '', phone: '999', address: '', emergencyContact: '', notes: '',
  primaryDocument: { type: 'dni', issuingCountry: 'gb', documentNumber: '12345678' },
};

describe('guest response adapter', () => {
  it('maps backend enums and preserves only supported local compatibility values', () => {
    const guest = adaptGuestResponse(response, { visits: 4, propertyId: 'must-not-leak' });
    expect(guest).toMatchObject({ name: 'Ana Torres', documentType: 'DNI', status: 'Activo', visits: 4 });
    expect(guest).not.toHaveProperty('propertyId');
    expect(adaptGuestResponse({ ...response, status: 'archived', primaryDocument: { ...response.primaryDocument, type: 'passport' } })).toMatchObject({ documentType: 'Pasaporte', status: 'Archivado' });
  });
});

describe('guest DTO builders', () => {
  it('builds a strict normalized create DTO without compatibility fields', () => {
    const dto = buildGuestCreateDto({ ...form, visits: 99, id: 'local-id', propertyId: 'property-id' });
    expect(dto).toEqual({
      firstName: 'Ana', lastName: 'Torres', nationality: null, email: null, phone: '999', address: null, emergencyContact: null, notes: null,
      primaryDocument: { type: 'dni', issuingCountry: 'PE', documentNumber: '12345678' },
    });
  });

  it('returns no patch when normalized API values did not change', () => {
    expect(buildGuestPatchDto(adaptGuestResponse(response), form)).toBeNull();
  });

  it('emits nullable clears and a complete document only when it changed', () => {
    const current = adaptGuestResponse({ ...response, email: 'ana@example.com' });
    const patch = buildGuestPatchDto(current, { ...form, primaryDocument: { ...form.primaryDocument, documentNumber: ' ab-9 ' } });
    expect(patch).toEqual({
      email: null,
      primaryDocument: { type: 'dni', issuingCountry: 'PE', documentNumber: 'AB-9' },
    });
    expect(patch.primaryDocument).not.toHaveProperty('id');
  });

  it('requires passport countries and ignores stale nationality for local documents', () => {
    expect(buildGuestCreateDto({ ...form, nationality: 'Peruana' }).nationality).toBeNull();
    const passport = { ...form, nationality: '', primaryDocument: { ...form.primaryDocument, type: 'passport', issuingCountry: 'GB' } };
    expect(() => buildGuestCreateDto(passport)).toThrow('ISO');
    expect(() => buildGuestCreateDto({ ...passport, nationality: 'GB', primaryDocument: { ...passport.primaryDocument, issuingCountry: '' } })).toThrow('ISO');
    expect(buildGuestCreateDto({ ...passport, nationality: 'gb' })).toMatchObject({
      nationality: 'GB',
      primaryDocument: { type: 'passport', issuingCountry: 'GB' },
    });
    expect(buildGuestCreateDto({
      ...form,
      nationality: 'GB',
      primaryDocument: { ...form.primaryDocument, type: 'other', issuingCountry: 'US' },
    })).toMatchObject({ nationality: null, primaryDocument: { type: 'other', issuingCountry: 'US' } });
  });
});
