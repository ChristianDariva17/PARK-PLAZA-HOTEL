import { describe, expect, it } from 'vitest';
import { adaptPetResponse, buildPetCreateDto, buildPetUpdateDto } from './petsModel.js';

describe('pet API mapping', () => {
  const input = { clientId: 'untrusted-client', stayId: 'stay-id', name: 'Milo', type: 'Perro', size: 'Mediano', lodgingPlace: 'Habitación', charge: '12.5', notes: ' Nota ', status: 'Activa', propertyId: 'untrusted' };
  const state = { pets: [{ id: 'PET-002' }], stays: [{ id: 'stay-id', reservationId: 'reservation-id', status: 'active' }], reservations: [{ id: 'reservation-id', primaryGuestId: 'linked-client' }] };

  it('projects strict create/update payloads without server or property fields', () => {
    const created = buildPetCreateDto(state, input);
    const updated = buildPetUpdateDto(input);
    expect(created).toEqual({
      id: 'PET-003',
      clientId: 'linked-client',
      stayId: 'stay-id',
      originType: 'stay',
      ownerName: null,
      ownerPhone: null,
      name: 'Milo',
      type: 'Perro',
      breed: null,
      size: 'Mediano',
      lodgingPlace: 'Habitación',
      charge: 12.5,
      vaccinationVerified: false,
      temperament: null,
      emergencyContact: null,
      welcomeKitDelivered: false,
      notes: 'Nota',
    });
    expect(created.clientId).not.toBe(input.clientId);
    expect(updated).not.toHaveProperty('propertyId');
    expect(updated).not.toHaveProperty('status');
    expect(updated).not.toHaveProperty('clientId');
    expect(updated).not.toHaveProperty('stayId');
    expect(updated).not.toHaveProperty('charge');
  });

  it('allows external visitor pet creation without active stays', () => {
    const visitorInput = {
      originType: 'restaurant',
      ownerName: 'Laura Vega',
      ownerPhone: '987654321',
      name: 'Simba',
      type: 'Gato',
      breed: 'Persa',
      size: 'Pequeño',
      lodgingPlace: 'Terraza',
      charge: 0,
      vaccinationVerified: true,
      welcomeKitDelivered: true,
      notes: 'Tranquilo',
    };
    const created = buildPetCreateDto({ ...state, stays: [] }, visitorInput);
    expect(created.id).toBe('PET-003');
    expect(created.stayId).toBeNull();
    expect(created.ownerName).toBe('Laura Vega');
    expect(created.vaccinationVerified).toBe(true);
    expect(created.welcomeKitDelivered).toBe(true);
  });

  it('requires an active stay with a linked guest for room stay creation', () => {
    expect(() => buildPetCreateDto({ ...state, stays: [] }, input)).toThrow('active stay');
  });

  it('adapts server charge values and boolean flags without fabricating success fields', () => {
    expect(adaptPetResponse({ id: 'PET-003', charge: '12.50', chargeApplied: true, vaccinationVerified: true })).toEqual({
      id: 'PET-003',
      charge: 12.5,
      chargeApplied: true,
      vaccinationVerified: true,
      welcomeKitDelivered: false,
    });
  });

  it('allows pet creation for an occupied room when state.stays is empty', () => {
    const occupiedState = {
      pets: [],
      stays: [],
      persistentStays: [],
      rooms: [
        { id: 'room-101-uuid', number: '101', status: 'Ocupada', guestId: 'client-maria' },
      ],
      clients: [
        { id: 'client-maria', name: 'María González' },
      ],
    };

    const petInput = {
      stayId: 'EST-101',
      name: 'Firulais',
      type: 'Perro',
      size: 'Pequeño',
      lodgingPlace: 'Habitación',
      charge: '0',
      vaccinationVerified: true,
    };

    const created = buildPetCreateDto(occupiedState, petInput);
    expect(created).toMatchObject({
      id: 'PET-001',
      stayId: 'EST-101',
      clientId: 'client-maria',
      originType: 'stay',
      name: 'Firulais',
    });
  });
});
