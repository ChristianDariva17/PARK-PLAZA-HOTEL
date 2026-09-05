import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/database/database.module.js';
import { ParkingService } from '../src/parking/parking.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440000';
const actor = {
  accountId: 'account-1',
  propertyId,
  roleKey: 'receptionist',
  email: 'admin@example.com',
  permissions: ['parking.create'],
  sessionId: 'session-1',
  passwordChangeRequired: false,
} satisfies AuthenticatedAccount;

function queryResult<T>(value: T) {
  const query: any = {};
  for (const method of ['from', 'where', 'limit', 'for']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve);
  return query;
}

describe('ParkingService external visitor creation', () => {
  it('allows creating vehicle for external client without stayId, clientId, or roomId', async () => {
    const visitorPayload = {
      id: 'VEH-999',
      originType: 'restaurant' as const,
      driverName: 'Carlos Gómez',
      driverPhone: '+51 987654321',
      vehicleColor: 'Rojo',
      keysLeft: true,
      entryNotes: 'Comensal en restaurante terraza',
      plate: 'EXT-999',
      space: 'E-05',
      fee: 0,
      vehicleType: 'Auto',
      brandModel: 'Kia Rio',
      entryResponsible: 'Recepcionista Turno Tarde',
    };

    const insertedVehicle = {
      ...visitorPayload,
      propertyId,
      stayId: null,
      clientId: null,
      roomId: null,
      status: 'Dentro',
      chargeId: null,
    };

    const tx = {
      execute: vi.fn(),
      query: {
        vehicleRegistrations: {
          findFirst: vi.fn().mockResolvedValue(null), // no collision
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedVehicle]),
        }),
      }),
    };

    const database = {
      transaction: vi.fn((cb: any) => cb(tx)),
    } as unknown as Database;

    const folios = {
      appendAncillaryChargeLocked: vi.fn(),
    };

    const service = new ParkingService(database, folios as any);

    const result = await service.create(actor, visitorPayload, {
      requestId: 'req-visitor',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(result).toEqual(insertedVehicle);
    expect(folios.appendAncillaryChargeLocked).not.toHaveBeenCalled();
  });
});
