import { describe, expect, it, vi } from 'vitest';
import { auditClient } from './auditClient.js';
import { authRequest } from '../auth/authClient.js';

vi.mock('../auth/authClient.js', () => ({ authRequest: vi.fn() }));

describe('auditClient', () => {
  it('serializes audit filters and pagination into the active endpoint', async () => {
    authRequest.mockResolvedValue({ data: [] });

    await auditClient.listAuditEvents(2, 25, {
      eventType: 'contract.created',
      subjectType: 'contract',
      subjectId: 'contract id',
      actorAccountId: '550e8400-e29b-41d4-a716-446655440000',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
      search: 'created by admin',
    });

    expect(authRequest).toHaveBeenCalledWith(
      '/api/documents/audit?page=2&limit=25&eventType=contract.created&subjectType=contract&subjectId=contract+id&actorAccountId=550e8400-e29b-41d4-a716-446655440000&from=2026-01-01T00%3A00%3A00.000Z&to=2026-01-31T23%3A59%3A59.999Z&search=created+by+admin',
    );
  });
});
