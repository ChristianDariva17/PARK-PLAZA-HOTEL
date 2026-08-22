import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/database/database.module.js';
import { ParkingService } from '../src/parking/parking.service.js';
import { PetsService } from '../src/pets/pets.service.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440000';
const stayId = '550e8400-e29b-41d4-a716-446655440001';
const clientId = '550e8400-e29b-41d4-a716-446655440002';
const roomId = '550e8400-e29b-41d4-a716-446655440003';
const vehicle = { id: 'VEH-001', propertyId, stayId, clientId, roomId, fee: '10.00' };
const pet = { id: 'PET-001', propertyId, stayId, clientId, charge: '5.00' };

function queryResult<T>(value: T) {
  const query: any = {};
  for (const method of ['from', 'where', 'limit']) query[method] = vi.fn(() => query);
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

const parkingCreate = {
  id: 'VEH-002', stayId, clientId, roomId, plate: 'ABC-123', space: 'A1', fee: 10,
  vehicleType: 'Auto', brandModel: 'Sedan', entryResponsible: 'Ana',
};

describe('parking and pets service property predicates', () => {
  it('scopes both parking and pet lists to the authenticated property', async () => {
    const parkingFindMany = vi.fn().mockResolvedValue([]);
    const petsFindMany = vi.fn().mockResolvedValue([]);
    await new ParkingService({ query: { vehicleRegistrations: { findMany: parkingFindMany } } } as unknown as Database).findAll(propertyId);
    await new PetsService({ query: { pets: { findMany: petsFindMany } } } as unknown as Database).findAll(propertyId);
    expect(new PgDialect().sqlToQuery(parkingFindMany.mock.calls[0]![0].where).params).toEqual([propertyId]);
    expect(new PgDialect().sqlToQuery(petsFindMany.mock.calls[0]![0].where).params).toEqual([propertyId]);
  });

  it.each([
    ['stay', [[], [{ id: clientId }], [{ id: roomId }], [{ guestId: clientId }]]],
    ['guest', [[{ id: stayId, roomId }], [], [{ id: roomId }], [{ guestId: clientId }]]],
    ['room', [[{ id: stayId, roomId }], [{ id: clientId }], [], [{ guestId: clientId }]]],
  ])('rejects parking creation when the linked %s is outside the property', async (_link, selections) => {
    const queries = selections.map((rows) => queryResult(rows));
    const pendingQueries = [...queries];
    const insert = vi.fn();
    const database = { select: vi.fn(() => pendingQueries.shift()), insert, query: { vehicleRegistrations: { findFirst: vi.fn() } } } as unknown as Database;
    await expect(new ParkingService(database).create(propertyId, parkingCreate)).rejects.toBeInstanceOf(BadRequestException);
    expect(insert).not.toHaveBeenCalled();
    for (const query of queries) {
      expect(new PgDialect().sqlToQuery(query.where.mock.calls[0]![0]).params).toContain(propertyId);
    }
  });

  it('validates parking links without bypassing them and scopes update, exit, and archive writes', async () => {
    const linkQueries = [
      queryResult([{ id: stayId, roomId }]), queryResult([{ id: clientId }]), queryResult([{ id: roomId }]), queryResult([{ guestId: clientId }]),
    ];
    const updated = mutation([vehicle]);
    const archived = mutation([vehicle]);
    const exited = mutation([vehicle]);
    const tx = { query: { vehicleRegistrations: { findFirst: vi.fn().mockResolvedValue(vehicle) } }, update: vi.fn(() => exited) };
    const database = {
      query: { vehicleRegistrations: { findFirst: vi.fn().mockResolvedValue(vehicle) } },
      select: vi.fn(() => linkQueries.shift()),
      update: vi.fn().mockReturnValueOnce(updated).mockReturnValueOnce(archived),
      transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as Database;
    const service = new ParkingService(database);
    await service.update(vehicle.id, propertyId, { plate: 'DEF-456' });
    await service.archive(vehicle.id, propertyId, 'History');
    await service.exit(vehicle.id, propertyId, { exitResponsible: 'Ana' });
    for (const where of [updated.where, archived.where, exited.where]) {
      expect(new PgDialect().sqlToQuery(where.mock.calls[0]![0]).params).toEqual([vehicle.id, propertyId]);
    }
  });

  it('rejects pet update when its guest or stay link is outside the property', async () => {
    const guestMismatch = { query: { pets: { findFirst: vi.fn().mockResolvedValue(pet) } }, select: vi.fn(() => queryResult([])), update: vi.fn() } as unknown as Database;
    await expect(new PetsService(guestMismatch).update(pet.id, propertyId, { name: 'Milo' })).rejects.toBeInstanceOf(BadRequestException);

    const selections = [queryResult([{ id: clientId }]), queryResult([]), queryResult([{ guestId: clientId }])];
    const stayMismatch = { query: { pets: { findFirst: vi.fn().mockResolvedValue(pet) } }, select: vi.fn(() => selections.shift()), update: vi.fn() } as unknown as Database;
    await expect(new PetsService(stayMismatch).update(pet.id, propertyId, { name: 'Milo' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes every pet mutation write by record and property after real link validation', async () => {
    const selections = [queryResult([{ id: clientId }]), queryResult([{ id: stayId }]), queryResult([{ guestId: clientId }])];
    const updated = mutation([pet]);
    const archived = mutation([pet]);
    const reactivated = mutation([pet]);
    const database = { query: { pets: { findFirst: vi.fn().mockResolvedValue(pet) } }, select: vi.fn(() => selections.shift()), update: vi.fn().mockReturnValueOnce(updated).mockReturnValueOnce(archived).mockReturnValueOnce(reactivated) } as unknown as Database;
    const service = new PetsService(database);
    await service.update(pet.id, propertyId, { name: 'Milo' });
    await service.archive(pet.id, propertyId, 'History');
    await service.reactivate(pet.id, propertyId, 'Return');
    for (const where of [updated.where, archived.where, reactivated.where]) {
      expect(new PgDialect().sqlToQuery(where.mock.calls[0]![0]).params).toEqual([pet.id, propertyId]);
    }
  });

  it('hides out-of-property parking and pet records as not found', async () => {
    const parkingDb = { query: { vehicleRegistrations: { findFirst: vi.fn().mockResolvedValue(undefined) } } } as unknown as Database;
    const petsDb = { query: { pets: { findFirst: vi.fn().mockResolvedValue(undefined) } } } as unknown as Database;
    await expect(new ParkingService(parkingDb).update('VEH-foreign', propertyId, { plate: 'ABC' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(new PetsService(petsDb).update('PET-foreign', propertyId, { name: 'Milo' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
