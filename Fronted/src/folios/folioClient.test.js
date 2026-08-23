import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/authClient.js', () => {
  class AuthRequestError extends Error { constructor(message, status) { super(message); this.status = status; } }
  return { AuthRequestError, authRequest: vi.fn() };
});

import { AuthRequestError, authRequest } from '../auth/authClient.js';
import { FolioRequestError, createFolioCharge, createFolioPayment, getFolio, reverseFolioEntry } from './folioClient.js';

beforeEach(() => vi.mocked(authRequest).mockReset().mockResolvedValue({ balance: '0.00', entries: [] }));

describe('folio request policy', () => {
  it('sends only server-authoritative stay paths with idempotency keys', async () => {
    await getFolio('stay-id');
    await createFolioCharge('stay-id', { amount: '2.00', description: 'Minibar' }, '00000000-0000-4000-8000-000000000001');
    await createFolioPayment('stay-id', { amount: '2.00', method: 'Tarjeta' }, '00000000-0000-4000-8000-000000000002');
    await reverseFolioEntry('stay-id', 'entry-id', { reason: 'Correction' }, '00000000-0000-4000-8000-000000000003');
    expect(authRequest).toHaveBeenNthCalledWith(1, '/api/stays/stay-id/folio', { signal: undefined });
    expect(authRequest).toHaveBeenNthCalledWith(2, '/api/stays/stay-id/folio/charges', expect.objectContaining({ headers: { 'Idempotency-Key': '00000000-0000-4000-8000-000000000001' } }));
    expect(authRequest).toHaveBeenNthCalledWith(3, '/api/stays/stay-id/folio/payments', expect.objectContaining({ body: JSON.stringify({ amount: '2.00', method: 'Tarjeta' }) }));
    expect(authRequest).toHaveBeenNthCalledWith(4, '/api/stays/stay-id/folio/entries/entry-id/reverse', expect.objectContaining({ method: 'POST' }));
  });
  it('normalizes authorization and ambiguous outcomes without exposing backend details', async () => {
    vi.mocked(authRequest).mockRejectedValueOnce(new AuthRequestError('private', 403));
    await expect(getFolio('stay-id')).rejects.toMatchObject({ name: 'FolioRequestError', message: 'You do not have permission for this folio action.' });
    vi.mocked(authRequest).mockRejectedValueOnce(new Error('socket detail'));
    await expect(getFolio('stay-id')).rejects.toMatchObject({ name: 'FolioRequestError', reloadRecommended: true });
    expect(FolioRequestError).toBeTypeOf('function');
  });
});
