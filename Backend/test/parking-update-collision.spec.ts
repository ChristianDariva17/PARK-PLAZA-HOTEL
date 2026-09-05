import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/database/database.module.js';
import { ParkingService } from '../src/parking/parking.service.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440000';
const stayId = '550e8400-e29b-41d4-a716-446655440001';
const clientId = '550e8400-e29b-41d4-a716-446655440002';
const roomId = '550e8400-e29b-41d4-a716-446655440003';

function queryResult<T>(value: T) {
  const query: any = {};
  for (const method of ['from', 'where', 'limit', 'for']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve);
  return query;
}

function mutation(result: unknown[]) {
  const chain: any = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn().mockResolvedValue(result);
  return chain;
}

describe('ParkingService update collision prevention', () => {
  it('throws BadRequestException if updated space or plate is already occupied by another active vehicle', async () => {
    const currentVehicle = {
      id: 'VEH-001',
      propertyId,
      stayId,
      clientId,
      roomId,
      plate: 'ABC-123',
      space: 'E-01',
      status: 'Dentro',
    };

    const conflictingVehicle = {
      id: 'VEH-002',
      propertyId,
      plate: 'DEF-456',
      space: 'E-02',
      status: 'Dentro',
    };

    const linkQueries = [
      queryResult([{ id: stayId, roomId }]),
      queryResult([{ id: clientId }]),
      queryResult([{ id: roomId }]),
      queryResult([{ guestId: clientId }]),
    ];

    const findFirstMock = vi
      .fn()
      .mockResolvedValueOnce(currentVehicle) // first call: find current
      .mockResolvedValueOnce(conflictingVehicle); // second call: collision check returns conflicting vehicle

    const database = {
      query: {
        vehicleRegistrations: {
          findFirst: findFirstMock,
        },
      },
      select: vi.fn(() => linkQueries.shift()),
    } as unknown as Database;

    const service = new ParkingService(database, {} as any);

    await expect(
      service.update('VEH-001', propertyId, { space: 'E-02' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows update if new space is free or if collision query returns null', async () => {
    const currentVehicle = {
      id: 'VEH-001',
      propertyId,
      stayId,
      clientId,
      roomId,
      plate: 'ABC-123',
      space: 'E-01',
      status: 'Dentro',
    };

    const linkQueries = [
      queryResult([{ id: stayId, roomId }]),
      queryResult([{ id: clientId }]),
      queryResult([{ id: roomId }]),
      queryResult([{ guestId: clientId }]),
    ];

    const updatedVehicle = { ...currentVehicle, space: 'E-03' };
    const updatedMutation = mutation([updatedVehicle]);

    const findFirstMock = vi
      .fn()
      .mockResolvedValueOnce(currentVehicle)
      .mockResolvedValueOnce(null); // No collision!

    const database = {
      query: {
        vehicleRegistrations: {
          findFirst: findFirstMock,
        },
      },
      select: vi.fn(() => linkQueries.shift()),
      update: vi.fn().mockReturnValue(updatedMutation),
    } as unknown as Database;

    const service = new ParkingService(database, {} as any);

    const result = await service.update('VEH-001', propertyId, { space: 'E-03' });
    expect(result).toEqual(updatedVehicle);
    expect(updatedMutation.set).toHaveBeenCalledWith(
      expect.objectContaining({ space: 'E-03' }),
    );
  });
});
