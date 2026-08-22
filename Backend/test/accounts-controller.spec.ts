import { describe, expect, it, vi } from 'vitest';
import { AccountsController } from '../src/accounts/accounts.controller.js';
import type { AccountsService } from '../src/accounts/accounts.service.js';
import type { AuthenticatedAccount } from '../src/auth/auth.types.js';

const actor = { accountId: 'account-id', propertyId: 'property-id', roleKey: 'administrator', email: 'admin@example.com', permissions: ['accounts.read', 'accounts.manage'], sessionId: 'session-id', passwordChangeRequired: false } satisfies AuthenticatedAccount;

describe('AccountsController property authority', () => {
  it('always obtains list scope from the authenticated account', async () => {
    const service = { list: vi.fn().mockResolvedValue({ accounts: [], roles: [], personnel: [] }) } as unknown as AccountsService;
    await new AccountsController(service).list(actor);
    expect(service.list).toHaveBeenCalledWith('property-id');
  });
  it('passes actor scope to updates instead of accepting property input', async () => {
    const service = { update: vi.fn().mockResolvedValue({ id: 'target-id' }) } as unknown as AccountsService;
    const request = { auth: actor, id: 'request-id', ip: '127.0.0.1', headers: {} };
    const accountId = '550e8400-e29b-41d4-a716-446655440000';
    await new AccountsController(service).update(accountId, { status: 'disabled' }, actor, request as never);
    expect(service.update).toHaveBeenCalledWith(actor, accountId, { status: 'disabled' }, { requestId: 'request-id', ipAddress: '127.0.0.1' });
  });
  it('rejects malformed account IDs before patch or reset reaches the service', () => {
    const service = { update: vi.fn(), resetPassword: vi.fn() } as unknown as AccountsService;
    const controller = new AccountsController(service);
    const request = { auth: actor, headers: {} };
    expect(() => controller.update('not-a-uuid', { status: 'active' }, actor, request as never)).toThrow('Invalid account ID');
    expect(() => controller.resetPassword('not-a-uuid', { temporaryPassword: 'temporary password' }, actor, request as never)).toThrow('Invalid account ID');
    expect(service.update).not.toHaveBeenCalled();
    expect(service.resetPassword).not.toHaveBeenCalled();
  });
});
