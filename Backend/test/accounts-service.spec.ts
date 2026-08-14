import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AccountsService } from '../src/accounts/accounts.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import type { CryptoService } from '../src/auth/crypto.service.js';
import type { PasswordPolicyService } from '../src/auth/password-policy.service.js';
import type { Database } from '../src/database/database.module.js';

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
  const service = new AccountsService(database, {} as CryptoService, {} as PasswordPolicyService);
  vi.spyOn(service, 'list').mockResolvedValue({ accounts: [{ id: actor.accountId }], roles: [], personnel: [] } as never);
  return { service, tx, accountUpdate, sessionUpdate };
}

describe('AccountsService security-sensitive updates', () => {
  it('rejects self-disable through the locked production service path', async () => {
    const { service, tx } = serviceForUpdate();
    await expect(service.update(actor, actor.accountId, { status: 'disabled' }, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('revokes sessions atomically when the normalized email actually changes', async () => {
    const { service, tx, sessionUpdate } = serviceForUpdate([{ id: actor.accountId }, { id: 'other-admin' }]);
    await service.update(actor, actor.accountId, { email: 'new-admin@example.com' }, {});
    expect(tx.update).toHaveBeenCalledTimes(2);
    expect(sessionUpdate.set).toHaveBeenCalledWith(expect.objectContaining({ revocationReason: 'email_changed' }));
    expect(tx.insert).toHaveBeenCalledTimes(2);
  });

  it('does not revoke sessions when the normalized email is unchanged', async () => {
    const { service, tx } = serviceForUpdate();
    await service.update(actor, actor.accountId, { email: current.email }, {});
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
  });
});
