import type { ConfigService } from '@nestjs/config';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../src/audit/audit.service.js';
import type { CryptoService } from '../src/auth/crypto.service.js';
import { SessionService } from '../src/auth/session.service.js';
import type { Environment } from '../src/config/environment.js';
import type { Database } from '../src/database/database.module.js';

describe('SessionService account revocation', () => {
  it('acquires the account lock on the transaction before updating sessions', async () => {
    const calls: string[] = [];
    const execute = vi.fn<(query: SQL) => Promise<void>>(async () => { calls.push('lock'); });
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => {
      calls.push('update');
      return { set };
    });
    const transaction = { execute, update };
    const database = {
      transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    } as unknown as Database;
    const audit = { recordMany: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const service = new SessionService(
      database,
      {} as ConfigService<Environment, true>,
      {} as CryptoService,
      audit,
    );

    await service.revokeAllForAccount('account-id', 'property-id', 'manual', {});

    expect(calls).toEqual(['lock', 'update']);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(new PgDialect().sqlToQuery(execute.mock.calls[0]![0]).params).toEqual(['account:account-id', 0]);
    expect(audit.recordMany).not.toHaveBeenCalled();
  });
});
