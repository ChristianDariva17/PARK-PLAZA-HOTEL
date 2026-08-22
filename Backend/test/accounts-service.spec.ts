import { ConflictException, ForbiddenException } from '@nestjs/common';
import { type SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { AccountsService } from '../src/accounts/accounts.service.js';
import type { AuditService } from '../src/audit/audit.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import type { CryptoService } from '../src/auth/crypto.service.js';
import type { PasswordPolicyService } from '../src/auth/password-policy.service.js';
import type { Database } from '../src/database/database.module.js';
import {
  acquireAccountTransactionLock,
  acquirePropertyThenAccountTransactionLocks,
  acquirePropertyTransactionLock,
} from '../src/database/transaction-policy.js';

const actor = { accountId: '550e8400-e29b-41d4-a716-446655440000', propertyId: 'property-id', roleKey: 'administrator', email: 'admin@example.com', permissions: ['accounts.manage'], sessionId: 'session-id', passwordChangeRequired: false } satisfies AuthenticatedAccount;
const current = { id: actor.accountId, roleId: 'role-id', roleKey: 'administrator', status: 'active', email: 'admin@example.com' } as const;

function queryResult<T>(value: T) {
  const query: Record<string, unknown> = {};
  for (const method of ['from', 'innerJoin', 'where', 'limit', 'for']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve);
  return query;
}

function serviceForUpdate(activeAdministrators = [{ id: actor.accountId }]) {
  const select = vi.fn()
    .mockReturnValueOnce(queryResult([current]))
    .mockReturnValueOnce(queryResult(activeAdministrators));
  const accountUpdate = { set: vi.fn(() => accountUpdate), where: vi.fn().mockResolvedValue(undefined) };
  const sessionUpdate = { set: vi.fn(() => sessionUpdate), where: vi.fn(() => sessionUpdate), returning: vi.fn().mockResolvedValue([{ id: 'session-id' }]) };
  const update = vi.fn().mockReturnValueOnce(accountUpdate).mockReturnValueOnce(sessionUpdate);
  const insert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
  const tx = { execute: vi.fn().mockResolvedValue(undefined), select, update, insert };
  const database = { transaction: vi.fn((callback) => callback(tx)) } as unknown as Database;
  const audit = { record: vi.fn().mockResolvedValue(undefined), recordMany: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  const service = new AccountsService(database, {} as CryptoService, {} as PasswordPolicyService, audit);
  const list = vi.spyOn(service, 'list').mockResolvedValue({ accounts: [{ id: actor.accountId }], roles: [], personnel: [] } as never);
  return { service, tx, accountUpdate, sessionUpdate, audit, list };
}

function serviceWithTransactionError(error: unknown) {
  const database = { transaction: vi.fn().mockRejectedValue(error) } as unknown as Database;
  return new AccountsService(
    database,
    {} as CryptoService,
    {} as PasswordPolicyService,
    {} as AuditService,
  );
}

describe('PostgreSQL transaction lock policy', () => {
  it('uses parameterized, namespaced keys for the real property and account scopes', async () => {
    const execute = vi.fn<(query: SQL) => Promise<void>>().mockResolvedValue(undefined);
    const dialect = new PgDialect();

    await acquirePropertyTransactionLock({ execute }, 'property-input');
    await acquireAccountTransactionLock({ execute }, 'account-input');

    const propertyQuery = dialect.sqlToQuery(execute.mock.calls[0]![0]);
    const accountQuery = dialect.sqlToQuery(execute.mock.calls[1]![0]);
    expect(propertyQuery.sql).toContain('pg_advisory_xact_lock(hashtextextended($1, $2))');
    expect(propertyQuery.params).toEqual(['property:property-input', 0]);
    expect(accountQuery.params).toEqual(['account:account-input', 0]);
    expect(propertyQuery.sql).not.toContain('property-input');
    expect(accountQuery.sql).not.toContain('account-input');
  });

  it('acquires property before account when both scopes are required', async () => {
    const execute = vi.fn<(query: SQL) => Promise<void>>().mockResolvedValue(undefined);
    const dialect = new PgDialect();

    await acquirePropertyThenAccountTransactionLocks({ execute }, 'property-id', 'account-id');

    expect(execute).toHaveBeenCalledTimes(2);
    expect(dialect.sqlToQuery(execute.mock.calls[0]![0]).params).toEqual(['property:property-id', 0]);
    expect(dialect.sqlToQuery(execute.mock.calls[1]![0]).params).toEqual(['account:account-id', 0]);
  });
});

describe('AccountsService security-sensitive updates', () => {
  it('rejects self-disable through the locked production service path', async () => {
    const { service, tx } = serviceForUpdate();
    await expect(service.update(actor, actor.accountId, { status: 'disabled' }, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('revokes sessions atomically when the normalized email actually changes', async () => {
    const { service, tx, sessionUpdate, audit } = serviceForUpdate([{ id: actor.accountId }, { id: 'other-admin' }]);
    await service.update(actor, actor.accountId, { email: 'new-admin@example.com' }, {});
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(sessionUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ revocationReason: 'email_changed' }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'account.updated' }), tx);
    expect(audit.recordMany).toHaveBeenCalledWith([expect.objectContaining({ eventType: 'auth.session.email_changed' })], tx);
  });

  it('does not revoke sessions when the normalized email is unchanged', async () => {
    const { service, tx, audit } = serviceForUpdate();
    await service.update(actor, actor.accountId, { email: current.email }, {});
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'account.updated' }), tx);
    expect(audit.recordMany).not.toHaveBeenCalled();
  });

  it('does not continue with session revocation or post-transaction work when auditing fails', async () => {
    const { service, audit, sessionUpdate, list } = serviceForUpdate([{ id: actor.accountId }, { id: 'other-admin' }]);
    vi.mocked(audit.record).mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(service.update(actor, actor.accountId, { email: 'new-admin@example.com' }, {})).rejects.toThrow('audit unavailable');

    expect(sessionUpdate.set).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });
});

describe('AccountsService PostgreSQL constraint mapping', () => {
  it('maps the known duplicate email constraint to conflict', async () => {
    const service = serviceWithTransactionError({ code: '23505', constraint: 'accounts_email_unique' });

    const result = service.update(actor, 'account-id', { email: 'used@example.com' }, {});

    await expect(result).rejects.toMatchObject({
      message: 'Email is already in use',
      status: 409,
    });
    await expect(result).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps the known occupied personnel constraint to conflict', async () => {
    const service = serviceWithTransactionError({ code: '23505', constraint: 'staff_account_id_key' });

    await expect(service.update(actor, 'account-id', { personnelId: 'personnel-id' }, {})).rejects.toMatchObject({
      message: 'Personnel record is unavailable or already linked',
      status: 409,
    });
  });

  it('propagates unknown unique violations by identity', async () => {
    const error = { code: '23505', constraint: 'some_future_unique_constraint' };
    const service = serviceWithTransactionError(error);

    await expect(service.update(actor, 'account-id', { email: 'used@example.com' }, {})).rejects.toBe(error);
  });

  it('propagates non-PostgreSQL errors by identity', async () => {
    const error = new Error('database unavailable');
    const service = serviceWithTransactionError(error);

    await expect(service.update(actor, 'account-id', { email: 'used@example.com' }, {})).rejects.toBe(error);
  });
});
