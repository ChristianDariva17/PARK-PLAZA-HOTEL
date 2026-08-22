import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../src/audit/audit.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import { GuestsService } from '../src/guests/guests.service.js';

const actor = { accountId: 'account-id', propertyId: 'property-id', roleKey: 'receptionist', email: 'user@example.com', permissions: ['guests.read', 'guests.create', 'guests.update'], sessionId: 'session-id', passwordChangeRequired: false } satisfies AuthenticatedAccount;
const createdAt = new Date('2026-08-14T12:00:00.000Z');
const row = {
  id: 'guest-id', firstName: 'Ada', lastName: 'Lovelace', birthDate: null, nationality: 'GB', email: null, phone: null,
  address: 'London', emergencyContact: null, notes: null, status: 'active' as const, createdAt, updatedAt: createdAt,
  documentId: 'document-id', documentType: 'passport' as const, issuingCountry: 'GB', documentNumber: 'AB123',
  documentExpiresOn: null, documentCreatedAt: createdAt,
};

function queryResult<T>(value: T) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (result: T) => unknown) => Promise<unknown>)> = {};
  for (const method of ['from', 'innerJoin', 'where', 'orderBy', 'limit', 'for']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve);
  return query;
}

function updateService(current: Omit<typeof row, 'status'> & { status: 'active' | 'archived' } = row) {
  const selected = queryResult([current]);
  const guestUpdate = { set: vi.fn(() => guestUpdate), where: vi.fn().mockResolvedValue(undefined) };
  const documentUpdate = { set: vi.fn(() => documentUpdate), where: vi.fn().mockResolvedValue(undefined) };
  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn(() => selected),
    update: vi.fn().mockReturnValueOnce(guestUpdate).mockReturnValueOnce(documentUpdate),
    insert: vi.fn(),
  };
  const database = { transaction: vi.fn((callback) => callback(tx)) } as unknown as Database;
  const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return { service: new GuestsService(database, audit), tx, selected, guestUpdate, documentUpdate, audit };
}

describe('GuestsService', () => {
  it('lists only the requested property in deterministic name and ID order', async () => {
    const selected = queryResult([row, { ...row, id: 'archived-guest-id', status: 'archived' as const }]);
    const database = { select: vi.fn(() => selected) } as unknown as Database;
    const service = new GuestsService(database, {} as AuditService);
    const result = await service.list('property-id');
    const dialect = new PgDialect();
    const where = vi.mocked(selected.where as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(dialect.sqlToQuery(where).params).toEqual(['property-id']);
    expect(selected.orderBy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(selected.orderBy as ReturnType<typeof vi.fn>).mock.calls[0]).toHaveLength(3);
    expect(result[0]).toEqual(expect.objectContaining({ id: 'guest-id', primaryDocument: expect.objectContaining({ id: 'document-id' }) }));
    expect(result.map((guest) => guest.status)).toEqual(['active', 'archived']);
  });

  it('creates guest, primary document, and PII-safe audit through the same transaction', async () => {
    const guest = { ...row, propertyId: actor.propertyId };
    const document = { id: row.documentId, guestId: row.id, propertyId: actor.propertyId, type: row.documentType, issuingCountry: row.issuingCountry, documentNumber: row.documentNumber, expiresOn: null, isPrimary: true, createdAt };
    const guestInsert = { values: vi.fn(() => guestInsert), returning: vi.fn().mockResolvedValue([guest]) };
    const documentInsert = { values: vi.fn(() => documentInsert), returning: vi.fn().mockResolvedValue([document]) };
    const tx = { execute: vi.fn().mockResolvedValue(undefined), insert: vi.fn().mockReturnValueOnce(guestInsert).mockReturnValueOnce(documentInsert) };
    const database = { transaction: vi.fn((callback) => callback(tx)) } as unknown as Database;
    const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const service = new GuestsService(database, audit);
    const input = { firstName: 'Ada', lastName: 'Lovelace', address: 'London', primaryDocument: { type: 'passport' as const, issuingCountry: 'GB', documentNumber: 'AB123' } };
    await service.create(actor, input, { requestId: 'request-id' });
    expect(Object.keys(guestInsert.returning.mock.calls[0]![0])).toEqual(['id', 'firstName', 'lastName', 'birthDate', 'nationality', 'email', 'phone', 'address', 'emergencyContact', 'notes', 'status', 'createdAt', 'updatedAt']);
    expect(Object.keys(documentInsert.returning.mock.calls[0]![0])).toEqual(['id', 'type', 'issuingCountry', 'documentNumber', 'expiresOn', 'createdAt']);
    expect(guestInsert.values).toHaveBeenCalledWith(expect.objectContaining({ propertyId: actor.propertyId, address: 'London' }));
    expect(documentInsert.values).toHaveBeenCalledWith(expect.objectContaining({ propertyId: actor.propertyId, guestId: row.id, isPrimary: true }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'guest.created', propertyId: actor.propertyId,
      metadata: { documentType: 'passport', issuingCountry: 'GB' },
    }), tx);
  });

  it('locks before mutation and audits changed field names without raw PII', async () => {
    const { service, tx, selected, guestUpdate, documentUpdate, audit } = updateService();
    await service.update(actor, row.id, { email: 'private@example.com', notes: 'private note', primaryDocument: { documentNumber: 'SECRET456' } }, {});
    expect(tx.execute.mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(selected.for as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]!);
    expect(selected.for).toHaveBeenCalledWith('update');
    const where = vi.mocked(selected.where as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(new PgDialect().sqlToQuery(where).params).toEqual([row.id, actor.propertyId]);
    expect(guestUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ email: 'private@example.com', notes: 'private note' }));
    expect(documentUpdate.set).toHaveBeenCalledWith({ documentNumber: 'SECRET456' });
    const event = vi.mocked(audit.record).mock.calls[0]![0];
    expect(event.metadata).toEqual({ fields: ['email', 'notes', 'primaryDocument.documentNumber'], documentType: 'passport', issuingCountry: 'GB' });
    expect(JSON.stringify(event.metadata)).not.toContain('private@example.com');
    expect(JSON.stringify(event.metadata)).not.toContain('private note');
    expect(JSON.stringify(event.metadata)).not.toContain('SECRET456');
  });

  it('returns an explicit no-op without mutation or audit', async () => {
    const { service, tx, audit } = updateService();
    const result = await service.update(actor, row.id, { firstName: row.firstName, primaryDocument: { documentNumber: row.documentNumber } }, {});
    expect(result.id).toBe(row.id);
    expect(tx.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects archived guests and hides missing or out-of-scope guests as not found', async () => {
    const archived = updateService({ ...row, status: 'archived' });
    await expect(archived.service.update(actor, row.id, { firstName: 'Grace' }, {})).rejects.toBeInstanceOf(BadRequestException);
    const missing = updateService(undefined as never);
    vi.mocked(missing.tx.select).mockReturnValueOnce(queryResult([]) as never);
    await expect(missing.service.update(actor, row.id, { firstName: 'Grace' }, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps only the verified document uniqueness constraint to conflict and preserves unknown errors', async () => {
    const known = { code: '23505', constraint: 'identity_documents_property_document_unique' };
    const knownService = new GuestsService({ transaction: vi.fn().mockRejectedValue(known) } as unknown as Database, {} as AuditService);
    await expect(knownService.update(actor, row.id, { firstName: 'Grace' }, {})).rejects.toBeInstanceOf(ConflictException);
    const unknown = { code: '23505', constraint: 'future_constraint' };
    const unknownService = new GuestsService({ transaction: vi.fn().mockRejectedValue(unknown) } as unknown as Database, {} as AuditService);
    await expect(unknownService.update(actor, row.id, { firstName: 'Grace' }, {})).rejects.toBe(unknown);
  });

  it('aborts post-audit work when audit insertion fails', async () => {
    const { service, audit } = updateService();
    const error = new Error('audit unavailable');
    vi.mocked(audit.record).mockRejectedValueOnce(error);
    await expect(service.update(actor, row.id, { firstName: 'Grace' }, {})).rejects.toBe(error);
  });
});
