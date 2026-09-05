import { describe, expect, it, vi } from 'vitest';
import { DocumentsController } from '../src/documents/documents.controller.js';
import type { DocumentsService } from '../src/documents/documents.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';

const actor = {
  accountId: 'account-id',
  propertyId: 'property-id',
  roleKey: 'administrator',
  email: 'admin@example.com',
  permissions: ['audit.read'],
  sessionId: 'session-id',
  passwordChangeRequired: false,
} satisfies AuthenticatedAccount;

describe('DocumentsController audit endpoint', () => {
  it('forwards authenticated property and all filters to the service', async () => {
    const service = {
      listAuditEvents: vi.fn().mockResolvedValue({ items: [{ id: 'event-id' }], total: 51 }),
    } as unknown as DocumentsService;
    const query = {
      page: 2,
      limit: 25,
      eventType: 'contract.created',
      subjectType: 'contract',
      subjectId: 'contract-id',
      actorAccountId: '550e8400-e29b-41d4-a716-446655440000',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
      search: 'contract',
    };

    const response = await new DocumentsController(service).listAuditEvents(actor, query);

    expect(service.listAuditEvents).toHaveBeenCalledWith('property-id', 2, 25, query);
    expect(response).toEqual({
      data: [{ id: 'event-id' }],
      total: 51,
      page: 2,
      limit: 25,
      hasNextPage: true,
    });
  });

  it('uses safe defaults and reports the last page', async () => {
    const service = {
      listAuditEvents: vi.fn().mockResolvedValue({ items: [], total: 10 }),
    } as unknown as DocumentsService;

    const response = await new DocumentsController(service).listAuditEvents(actor, {});

    expect(service.listAuditEvents).toHaveBeenCalledWith('property-id', 1, 50, {});
    expect(response).toMatchObject({ data: [], total: 10, page: 1, limit: 50, hasNextPage: false });
  });
});
