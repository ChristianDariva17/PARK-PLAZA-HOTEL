import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/database/database.module.js';
import { ParkingService } from '../src/parking/parking.service.js';
import { PetsService } from '../src/pets/pets.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440000';
const stayId = '550e8400-e29b-41d4-a716-446655440001';
const clientId = '550e8400-e29b-41d4-a716-446655440002';
const roomId = '550e8400-e29b-41d4-a716-446655440003';
const vehicle = { id: 'VEH-001', propertyId, stayId, clientId, roomId, fee: '10.00', status: 'Dentro' };
const pet = { id: 'PET-001', propertyId, stayId, clientId, charge: '5.00', originType: 'stay' };
const actor = { accountId: 'account', propertyId, email: 'user@example.invalid', permissions: [], roleKey: 'receptionist', sessionId: 'session', passwordChangeRequired: false } satisfies AuthenticatedAccount;

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

const parkingCreate = {
  id: 'VEH-002', stayId, clientId, roomId, plate: 'ABC-123', space: 'A1', fee: 10,
  vehicleType: 'Auto', brandModel: 'Sedan', entryResponsible: 'Ana',
};

describe('parking and pets service property predicates', () => {
  it('scopes both parking and pet lists to the authenticated property', async () => {
    const parkingFindMany = vi.fn().mockResolvedValue([]);
    const petsFindMany = vi.fn().mockResolvedValue([]);
    await new ParkingService({ query: { vehicleRegistrations: { findMany: parkingFindMany } } } as unknown as Database, {} as any).findAll(propertyId);
    await new PetsService({ query: { pets: { findMany: petsFindMany } } } as unknown as Database, {} as any).findAll(propertyId);
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
    const database = {
      transaction: vi.fn((callback: (transaction: any) => unknown) => callback({
        execute: vi.fn().mockResolvedValue(undefined),
        select: vi.fn(() => pendingQueries.shift()),
        insert,
        query: { vehicleRegistrations: { findFirst: vi.fn() } },
      })),
      select: vi.fn(() => pendingQueries.shift()),
      insert,
      query: { vehicleRegistrations: { findFirst: vi.fn() } },
    } as unknown as Database;
    await expect(new ParkingService(database, {} as any).create(actor, parkingCreate, {})).rejects.toBeInstanceOf(BadRequestException);
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
    const folios = { appendAncillaryChargeLocked: vi.fn().mockResolvedValue({ id: 'entry-id' }), assertParkingChargeReference: vi.fn().mockResolvedValue({ id: 'entry-id' }) };
    const tx = { execute: vi.fn(), select: vi.fn(() => queryResult([vehicle])), update: vi.fn(() => exited) };
    const database = {
      query: { vehicleRegistrations: { findFirst: vi.fn().mockResolvedValue(vehicle) } },
      select: vi.fn(() => linkQueries.shift()),
      update: vi.fn().mockReturnValueOnce(updated).mockReturnValueOnce(archived),
      transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as Database;
    const service = new ParkingService(database, folios as any);
    await service.update(vehicle.id, propertyId, { plate: 'DEF-456' });
    await service.archive(vehicle.id, propertyId, 'History');
    await service.exit(vehicle.id, actor, { exitResponsible: 'Ana' }, {});
    for (const where of [updated.where, archived.where, exited.where]) {
      expect(new PgDialect().sqlToQuery(where.mock.calls[0]![0]).params).toEqual([vehicle.id, propertyId]);
    }
  });

  it('updates descriptive pet fields without altering canonical charge fields', async () => {
    const current = { ...pet, chargeId: 'entry-id', chargeApplied: true };
    const updated = mutation([current]);
    const database = { query: { pets: { findFirst: vi.fn().mockResolvedValue(current) } }, update: vi.fn(() => updated) } as unknown as Database;
    const folios = { appendAncillaryChargeLocked: vi.fn() };
    await new PetsService(database, folios as any).update(pet.id, propertyId, { name: 'Milo' });
    expect(updated.set.mock.calls[0]![0]).toMatchObject({ name: 'Milo' });
    expect(updated.set.mock.calls[0]![0]).not.toHaveProperty('charge');
    expect(updated.set.mock.calls[0]![0]).not.toHaveProperty('chargeApplied');
    expect(updated.set.mock.calls[0]![0]).not.toHaveProperty('chargeId');
    expect(folios.appendAncillaryChargeLocked).not.toHaveBeenCalled();
  });

  it.each(['stayId', 'clientId', 'charge'])('rejects an update that changes pet %s', async (field) => {
    const database = { query: { pets: { findFirst: vi.fn() } } } as unknown as Database;
    await expect(new PetsService(database, {} as any).update(pet.id, propertyId, { [field]: field === 'charge' ? 10 : stayId } as any)).rejects.toBeInstanceOf(BadRequestException);
    expect(database.query.pets.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['positive fee', '10.00', 'entry-id'],
    ['zero fee', '0.00', null],
  ])('scenario: Parking exit %s commits the matching ancillary reference', async (_scenario, fee, expectedChargeId) => {
    const exited = mutation([{ ...vehicle, fee, status: 'Fuera', chargeId: expectedChargeId }]);
    const tx = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn(() => queryResult([{ ...vehicle, fee }])), update: vi.fn(() => exited) };
    const database = { transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } as unknown as Database;
    const folios = { appendAncillaryChargeLocked: vi.fn().mockResolvedValue({ id: 'entry-id' }) };

    await expect(new ParkingService(database, folios as any).exit(vehicle.id, actor, { exitResponsible: 'Ana' }, { requestId: 'exit-request' })).resolves.toMatchObject({ status: 'Fuera', chargeId: expectedChargeId });

    expect(folios.appendAncillaryChargeLocked).not.toHaveBeenCalled();
    expect(exited.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'Fuera' }));
  });

  it('scenario: Parking exit retry verifies the canonical entry without appending another charge', async () => {
    const exited = { ...vehicle, status: 'Fuera', chargeId: 'entry-id' };
    const tx = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn(() => queryResult([exited])) };
    const database = { transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } as unknown as Database;
    const folios = { read: vi.fn().mockResolvedValue({ settlement: 'open' }), appendAncillaryChargeLocked: vi.fn(), assertParkingChargeReference: vi.fn().mockResolvedValue({ id: 'entry-id' }) };

    await expect(new ParkingService(database, folios as any).exit(vehicle.id, actor, { exitResponsible: 'Ana' }, {})).resolves.toEqual(exited);
    expect(folios.assertParkingChargeReference).toHaveBeenCalledWith(tx, actor, { stayId, sourceId: vehicle.id, amount: vehicle.fee, chargeId: 'entry-id' });
    expect(folios.appendAncillaryChargeLocked).not.toHaveBeenCalled();
  });

  it('scenario: Attached pet creation retry returns the canonical entry without appending another charge', async () => {
    const existing = { ...pet, charge: '5.00', chargeApplied: true, chargeId: 'entry-id', status: 'Activa' };
    const queries = [[{ id: clientId }], [{ id: stayId, status: 'active' }], [{ guestId: clientId }], [existing]];
    const tx = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn(() => queryResult(queries.shift() ?? [])) };
    const database = { transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } as unknown as Database;
    const folios = { read: vi.fn().mockResolvedValue({ settlement: 'open' }), appendAncillaryChargeLocked: vi.fn(), assertAncillaryChargeReference: vi.fn().mockResolvedValue({ id: 'entry-id' }) };

    await expect(new PetsService(database, folios as any).create(actor, { ...pet, charge: 5 } as any, {})).resolves.toEqual(existing);
    expect(folios.assertAncillaryChargeReference).toHaveBeenCalledWith(tx, actor, { stayId, sourceType: 'pet_charge', sourceId: pet.id, amount: '5.00', chargeId: 'entry-id' });
    expect(folios.appendAncillaryChargeLocked).not.toHaveBeenCalled();
  });

  it.each([
    ['attached positive charge', { ...pet, charge: 5 }, true, 'entry-id'],
    ['zero-value pet', { ...pet, charge: 0 }, false, null],
  ])('scenario: Pet creation %s posts only when eligible', async (_scenario, input, charged, expectedChargeId) => {
    const created = { ...input, charge: input.charge.toFixed(2), chargeApplied: charged, chargeId: expectedChargeId, status: 'Activa' };
    const queries = [[{ id: clientId }], [{ id: stayId, status: 'active' }], [{ guestId: clientId }], []];
    const inserted: unknown[] = [];
    const tx = {
      execute: vi.fn().mockResolvedValue(undefined),
      select: vi.fn(() => queryResult(queries.shift() ?? [])),
      insert: vi.fn(() => ({ values: vi.fn((value: unknown) => { inserted.push(value); return { returning: vi.fn().mockResolvedValue([created]) }; }) })),
    };
    const database = { transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } as unknown as Database;
    const folios = { read: vi.fn().mockResolvedValue({ settlement: 'open' }), appendAncillaryChargeLocked: vi.fn().mockResolvedValue({ id: 'entry-id' }) };

    await expect(new PetsService(database, folios as any).create(actor, input as any, { requestId: 'pet-request' })).resolves.toMatchObject({ chargeApplied: charged, chargeId: expectedChargeId });
    if (charged) {
      expect(folios.appendAncillaryChargeLocked).toHaveBeenCalledWith(tx, actor, { stayId, sourceType: 'pet_charge', sourceId: pet.id, amount: '5.00', reason: 'Pet lodging charge' }, { requestId: 'pet-request' });
    } else {
      expect(folios.appendAncillaryChargeLocked).not.toHaveBeenCalled();
    }
    expect(inserted).toContainEqual(expect.objectContaining({ chargeApplied: charged, chargeId: expectedChargeId }));
  });

  it('rejects a missing or inactive stay before creating a pet', async () => {
    const missingQueries = [[{ id: clientId }], [], []];
    const missingStay = { transaction: vi.fn((callback: (transaction: any) => unknown) => callback({ execute: vi.fn(), select: vi.fn(() => queryResult(missingQueries.shift() ?? [])) })) } as unknown as Database;
    await expect(new PetsService(missingStay, { read: vi.fn() } as any).create(actor, { ...pet, stayId } as any, {})).rejects.toBeInstanceOf(BadRequestException);

    const queries = [[{ id: clientId }], [{ id: stayId, status: 'checked_out' }], [{ guestId: clientId }]];
    const inactiveStay = { transaction: vi.fn((callback: (transaction: any) => unknown) => callback({ execute: vi.fn(), select: vi.fn(() => queryResult(queries.shift() ?? [])) })) } as unknown as Database;
    await expect(new PetsService(inactiveStay, { read: vi.fn() } as any).create(actor, { ...pet, charge: 0 } as any, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects pet creation when the active stay folio is not open', async () => {
    const queries = [[{ id: clientId }], [{ id: stayId, status: 'active' }], [{ guestId: clientId }]];
    const tx = { execute: vi.fn(), select: vi.fn(() => queryResult(queries.shift() ?? [])) };
    const database = { transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)) } as unknown as Database;
    await expect(new PetsService(database, { read: vi.fn().mockResolvedValue({ settlement: 'settled' }) } as any).create(actor, { ...pet, charge: 0 } as any, {})).rejects.toMatchObject({ status: 409 });
  });

  it('scopes every pet mutation write by record and property', async () => {
    const updated = mutation([pet]);
    const archived = mutation([pet]);
    const reactivated = mutation([pet]);
    const database = { query: { pets: { findFirst: vi.fn().mockResolvedValue(pet) } }, update: vi.fn().mockReturnValueOnce(updated).mockReturnValueOnce(archived).mockReturnValueOnce(reactivated) } as unknown as Database;
    const service = new PetsService(database, {} as any);
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
    await expect(new ParkingService(parkingDb, {} as any).update('VEH-foreign', propertyId, { plate: 'ABC' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(new PetsService(petsDb, {} as any).update('PET-foreign', propertyId, { name: 'Milo' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
