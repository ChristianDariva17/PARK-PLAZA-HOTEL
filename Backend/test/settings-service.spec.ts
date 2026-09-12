import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../src/audit/audit.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import { SettingsService } from '../src/settings/settings.service.js';

const actor = {
  accountId: 'account-id',
  propertyId: 'property-id',
  roleKey: 'administrator',
  email: 'admin@example.com',
  permissions: ['settings.read', 'settings.manage'],
  sessionId: 'session-id',
  passwordChangeRequired: false,
} satisfies AuthenticatedAccount;

function queryResult<T>(value: T) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (result: T) => unknown) => Promise<unknown>)> = {};
  for (const method of ['from', 'where', 'limit']) query[method] = vi.fn(() => query);
  query.then = (resolve: (result: T) => unknown) => Promise.resolve(value).then(resolve);
  return query;
}

describe('SettingsService', () => {
  it('reads settings scoped to the authenticated property', async () => {
    const settings = { id: actor.propertyId, name: 'Park Plaza QA', currency: 'PEN' };
    const query = queryResult([settings]);
    const database = { select: vi.fn().mockReturnValue(query) } as unknown as Database;
    const result = await new SettingsService(database, {} as AuditService).getSettings(actor.propertyId);

    expect(result).toEqual(settings);
  });

  it('rejects a property without settings', async () => {
    const query = queryResult([]);
    const database = { select: vi.fn().mockReturnValue(query) } as unknown as Database;

    await expect(new SettingsService(database, {} as AuditService).getSettings(actor.propertyId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects empty updates before opening a transaction', async () => {
    const database = { transaction: vi.fn() } as unknown as Database;
    await expect(new SettingsService(database, {} as AuditService).updateSettings(actor, {}, {})).rejects.toThrow('No valid fields provided');
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
