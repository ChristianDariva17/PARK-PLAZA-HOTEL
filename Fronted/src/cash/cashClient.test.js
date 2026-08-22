import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/authClient.js', () => ({
  AuthRequestError: class AuthRequestError extends Error {},
  authRequest: vi.fn(),
}));

import { authRequest } from '../auth/authClient.js';
import { closeCashSession, countCashSession, createCashMovement, openCashSession } from './cashClient.js';

beforeEach(() => vi.mocked(authRequest).mockReset().mockResolvedValue({ id: 'result-id' }));

describe('cash client endpoint contract', () => {
  it('serializes open, count, close, and movement bodies to their actual endpoints', async () => {
    const signal = new AbortController().signal;
    await openCashSession({ openingAmount: 10, responsible: 'Ana', shift: 'Mañana' }, signal);
    await countCashSession('session-id', { countedAmount: 10 }, signal);
    await closeCashSession('session-id', { countedAmount: 10, note: 'Cierre' }, signal);
    await createCashMovement({ type: 'Ingreso', concept: 'Pago', amount: 10, method: 'Efectivo' }, signal);
    expect(authRequest).toHaveBeenNthCalledWith(1, '/api/cash/session/open', expect.objectContaining({ method: 'POST', body: JSON.stringify({ openingAmount: 10, responsible: 'Ana', shift: 'Mañana' }), signal }));
    expect(authRequest).toHaveBeenNthCalledWith(2, '/api/cash/session/count/session-id', expect.objectContaining({ body: JSON.stringify({ countedAmount: 10 }) }));
    expect(authRequest).toHaveBeenNthCalledWith(3, '/api/cash/session/close/session-id', expect.objectContaining({ body: JSON.stringify({ countedAmount: 10, note: 'Cierre' }) }));
    expect(authRequest).toHaveBeenNthCalledWith(4, '/api/cash/movements', expect.objectContaining({ body: JSON.stringify({ type: 'Ingreso', concept: 'Pago', amount: 10, method: 'Efectivo' }) }));
  });
});
