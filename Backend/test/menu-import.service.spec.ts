import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { AuditService } from '../src/audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../src/auth/auth.types.js';
import type { Database } from '../src/database/database.module.js';
import { parseParkPlazaMenu } from '../src/restaurant/menu-import.parser.js';
import { MenuImportService } from '../src/restaurant/menu-import.service.js';

const source = readFileSync(new URL('../../menu_park_plaza.md', import.meta.url), 'utf8');
const actor = { accountId: 'account', propertyId: 'property', email: 'restaurant@example.invalid', permissions: [], roleKey: 'administrator', sessionId: 'session', passwordChangeRequired: false } satisfies AuthenticatedAccount;
const context: RequestContext = { requestId: 'request' };

function query(value: unknown) {
  const chain: any = {};
  for (const method of ['from', 'where', 'limit', 'for', 'orderBy']) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (result: unknown) => unknown) => Promise.resolve(value).then(resolve);
  return chain;
}

describe('MenuImportService preview', () => {
  it('reports an existing imported item as updated when its desired category must be created', async () => {
    const manifest = parseParkPlazaMenu(source);
    const desiredCategory = manifest.categories[0]!;
    const desiredItem = desiredCategory.items[0]!;
    const selections = [[], [{
      id: 'item', categoryId: null, sourceKey: desiredItem.sourceKey, sourceHash: desiredItem.sourceHash,
      name: desiredItem.name, category: desiredCategory.name, position: desiredItem.position,
      salePrice: desiredItem.variants[0]!.price, currency: 'PEN', preparationMinutes: null,
      status: 'active', isPublished: true, isAvailable: true,
    }], []];
    const tx = {
      select: vi.fn(() => query(selections.shift() ?? [])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
    };
    const database = {
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'run' }]) })) })),
      update: vi.fn(),
      transaction: vi.fn((run: (transaction: typeof tx) => unknown) => run(tx)),
    } as unknown as Database;
    const audit = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditService;

    const result = await new MenuImportService(database, audit).preview(actor, source, context);

    expect(result.categories.created).toBe(15);
    expect(result.items).toEqual(expect.objectContaining({ created: 81, updated: 1, unchanged: 0 }));
  });
});
