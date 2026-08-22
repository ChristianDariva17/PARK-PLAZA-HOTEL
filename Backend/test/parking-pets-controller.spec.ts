import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import { REQUIRED_PERMISSIONS } from '../src/auth/decorators/require-permissions.decorator.js';
import { ParkingController } from '../src/parking/parking.controller.js';
import type { ParkingService } from '../src/parking/parking.service.js';
import { PetsController } from '../src/pets/pets.controller.js';
import type { PetsService } from '../src/pets/pets.service.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440000';
const actor = { accountId: 'account-id', propertyId, roleKey: 'receptionist', email: 'user@example.com', permissions: ['parking.read', 'parking.create', 'pets.read', 'pets.create'], sessionId: 'session-id', passwordChangeRequired: false } satisfies AuthenticatedAccount;
const linked = {
  stayId: '550e8400-e29b-41d4-a716-446655440001',
  clientId: '550e8400-e29b-41d4-a716-446655440002',
  roomId: '550e8400-e29b-41d4-a716-446655440003',
};

describe('parking and pets controller property authority', () => {
  it('derives list scope only from the authenticated account', async () => {
    const parking = { findAll: vi.fn().mockResolvedValue([]) } as unknown as ParkingService;
    const pets = { findAll: vi.fn().mockResolvedValue([]) } as unknown as PetsService;
    await new ParkingController(parking).findAll(actor);
    await new PetsController(pets).findAll(actor);
    expect(parking.findAll).toHaveBeenCalledWith(propertyId);
    expect(pets.findAll).toHaveBeenCalledWith(propertyId);
  });

  it('rejects caller-controlled property identity before invoking services', () => {
    const parking = { create: vi.fn() } as unknown as ParkingService;
    const pets = { create: vi.fn() } as unknown as PetsService;
    expect(() => new ParkingController(parking).create({ id: 'VEH-001', ...linked, plate: 'ABC-123', space: 'A1', fee: 10, vehicleType: 'Auto', brandModel: 'Sedan', entryResponsible: 'Ana', propertyId: 'other' }, actor)).toThrow('Invalid request body');
    expect(() => new PetsController(pets).create({ id: 'PET-001', stayId: linked.stayId, clientId: linked.clientId, name: 'Milo', type: 'Perro', size: 'Mediano', lodgingPlace: 'Habitación', charge: 0, propertyId: 'other' }, actor)).toThrow('Invalid request body');
    expect(parking.create).not.toHaveBeenCalled();
    expect(pets.create).not.toHaveBeenCalled();
  });

  it('passes authenticated scope separately from strict create payloads', async () => {
    const parking = { create: vi.fn().mockResolvedValue({ id: 'VEH-001' }) } as unknown as ParkingService;
    await new ParkingController(parking).create({ id: 'VEH-001', ...linked, plate: 'abc-123', space: 'a1', fee: '10.5', vehicleType: 'Auto', brandModel: 'Sedan', entryResponsible: 'Ana' }, actor);
    expect(parking.create).toHaveBeenCalledWith(propertyId, expect.objectContaining({ plate: 'ABC-123', space: 'A1', fee: 10.5 }));
    expect(vi.mocked(parking.create).mock.calls[0]![1]).not.toHaveProperty('propertyId');
  });

  it('derives mutation scope from the authenticated account for every route', async () => {
    const parking = { update: vi.fn(), exit: vi.fn(), archive: vi.fn() } as unknown as ParkingService;
    const pets = { update: vi.fn(), archive: vi.fn(), reactivate: vi.fn() } as unknown as PetsService;
    const parkingController = new ParkingController(parking);
    const petsController = new PetsController(pets);
    await parkingController.update('VEH-001', { plate: 'abc-123' }, actor);
    await parkingController.exit('VEH-001', { exitResponsible: 'Ana' }, actor);
    await parkingController.archive('VEH-001', { reason: 'History' }, actor);
    await petsController.update('PET-001', { name: 'Milo' }, actor);
    await petsController.archive('PET-001', { reason: 'History' }, actor);
    await petsController.reactivate('PET-001', { reason: 'Return' }, actor);
    expect(parking.update).toHaveBeenCalledWith('VEH-001', propertyId, { plate: 'ABC-123' });
    expect(parking.exit).toHaveBeenCalledWith('VEH-001', propertyId, { exitResponsible: 'Ana' });
    expect(parking.archive).toHaveBeenCalledWith('VEH-001', propertyId, 'History');
    expect(pets.update).toHaveBeenCalledWith('PET-001', propertyId, { name: 'Milo' });
    expect(pets.archive).toHaveBeenCalledWith('PET-001', propertyId, 'History');
    expect(pets.reactivate).toHaveBeenCalledWith('PET-001', propertyId, 'Return');
  });

  it('declares fail-closed permissions on every parking and pets route', () => {
    const expected = [
      [ParkingController.prototype.findAll, 'parking.read'],
      [ParkingController.prototype.create, 'parking.create'],
      [ParkingController.prototype.update, 'parking.update'],
      [ParkingController.prototype.exit, 'parking.exit'],
      [ParkingController.prototype.archive, 'parking.archive'],
      [PetsController.prototype.findAll, 'pets.read'],
      [PetsController.prototype.create, 'pets.create'],
      [PetsController.prototype.update, 'pets.update'],
      [PetsController.prototype.archive, 'pets.archive'],
      [PetsController.prototype.reactivate, 'pets.archive'],
    ] as const;
    for (const [handler, permission] of expected) {
      expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, handler)).toEqual([permission]);
    }
  });
});
