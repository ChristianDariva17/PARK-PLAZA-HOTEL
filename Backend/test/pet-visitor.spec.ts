import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/database/database.module.js';
import { PetsService } from '../src/pets/pets.service.js';
import type { AuthenticatedAccount, RequestContext } from '../src/auth/auth.types.js';
import { FolioService } from '../src/folios/folio.service.js';
import { parseCreatePetDto } from '../src/pets/pets.dto.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440000';
const actor = {
  accountId: 'account-1',
  propertyId,
  roleKey: 'receptionist',
  email: 'admin@example.com',
  permissions: ['pets.create'],
  sessionId: 'session-1',
  passwordChangeRequired: false,
} satisfies AuthenticatedAccount;

const context: RequestContext = {
  requestId: 'req-pet-1',
  propertyId,
  actorAccountId: actor.accountId,
  impersonatorAccountId: null,
};

function queryResult<T>(value: T) {
  const query: any = {};
  for (const method of ['from', 'where', 'limit', 'for']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve);
  return query;
}

describe('PetsService external visitor creation', () => {
  it('allows creating pet for external client without stayId or clientId', async () => {
    const visitorPayload = {
      id: 'PET-VIS-001',
      originType: 'restaurant' as const,
      ownerName: 'María Fernández',
      ownerPhone: '+51 987654321',
      name: 'Max',
      type: 'Perro',
      breed: 'Golden Retriever',
      size: 'Grande',
      lodgingPlace: 'Restaurante / Terraza',
      charge: 0,
      vaccinationVerified: true,
      temperament: 'Sociable',
      emergencyContact: 'Veterinaria San Borja (+51 988776655)',
      welcomeKitDelivered: true,
      notes: 'Mascota tranquila en terraza',
    };

    const parsedDto = parseCreatePetDto(visitorPayload);

    const insertedPet = {
      ...parsedDto,
      propertyId,
      stayId: null,
      clientId: null,
      charge: '0.00',
      chargeId: null,
      chargeApplied: false,
      status: 'Activa',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const txMock: any = {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => queryResult([])),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([insertedPet]),
        })),
      })),
    };

    const dbMock = {
      transaction: vi.fn(async (callback: any) => callback(txMock)),
      query: {
        pets: {
          findMany: vi.fn().mockResolvedValue([insertedPet]),
        },
      },
    } as unknown as Database;

    const foliosMock = {
      read: vi.fn(),
      appendAncillaryChargeLocked: vi.fn(),
      assertAncillaryChargeReference: vi.fn(),
    } as unknown as FolioService;

    const service = new PetsService(dbMock, foliosMock);
    const result = await service.create(actor, parsedDto, context);

    expect(result).toBeDefined();
    expect(result.id).toBe('PET-VIS-001');
    expect(result.stayId).toBeNull();
    expect(result.ownerName).toBe('María Fernández');
    expect(result.vaccinationVerified).toBe(true);
    expect(result.welcomeKitDelivered).toBe(true);
    expect(foliosMock.read).not.toHaveBeenCalled();
    expect(foliosMock.appendAncillaryChargeLocked).not.toHaveBeenCalled();
  });

  it('validates that stay pets still require stayId and clientId', () => {
    expect(() => {
      parseCreatePetDto({
        id: 'PET-STAY-001',
        originType: 'stay',
        name: 'Rocky',
        type: 'Perro',
        size: 'Mediano',
        lodgingPlace: 'Habitación',
        charge: 35,
      });
    }).toThrow();
  });
});
