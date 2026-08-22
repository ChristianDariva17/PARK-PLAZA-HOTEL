import { describe, expect, it } from 'vitest';
import { adaptPetResponse, buildPetCreateDto, buildPetUpdateDto } from './petsModel.js';

describe('pet API mapping', () => {
  const input = { clientId: 'client-id', stayId: '', name: 'Milo', type: 'Perro', size: 'Mediano', lodgingPlace: 'Habitación', charge: '12.5', notes: ' Nota ', status: 'Activa', propertyId: 'untrusted' };

  it('projects strict create/update payloads without server or property fields', () => {
    const created = buildPetCreateDto({ pets: [{ id: 'PET-002' }] }, input);
    const updated = buildPetUpdateDto(input);
    expect(created).toEqual({ id: 'PET-003', clientId: 'client-id', stayId: null, name: 'Milo', type: 'Perro', size: 'Mediano', lodgingPlace: 'Habitación', charge: 12.5, notes: 'Nota' });
    expect(updated).not.toHaveProperty('propertyId');
    expect(updated).not.toHaveProperty('status');
  });

  it('adapts server charge values without fabricating success fields', () => {
    expect(adaptPetResponse({ id: 'PET-003', charge: '12.50', chargeApplied: true })).toEqual({ id: 'PET-003', charge: 12.5, chargeApplied: true });
  });
});
