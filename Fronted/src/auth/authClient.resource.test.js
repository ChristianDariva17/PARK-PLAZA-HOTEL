import { describe, expect, it } from 'vitest';
import { AuthRequestError, createKeyedCommand, createResourceRead, normalizeResourceError, serializeExactMoney } from './authClient.js';

describe('shared resource boundary', () => {
  it('requires exact money strings and exposes normalized response states', () => {
    expect(serializeExactMoney('12.50')).toBe('12.50');
    expect(() => serializeExactMoney(12.5)).toThrow(TypeError);
    expect(normalizeResourceError(new AuthRequestError('ignored', 403))).toEqual({ code: 'forbidden', status: 403, retry: false });
  });

  it('retains a supplied idempotency key across command retries', async () => {
    const command = createKeyedCommand(async (key) => ({ key }), 'request-key');
    await expect(command.run()).resolves.toEqual({ key: 'request-key' });
    await expect(command.run()).resolves.toEqual({ key: 'request-key' });
  });

  it('suppresses an obsolete read result', async () => {
    const resolvers = [];
    const read = createResourceRead(() => new Promise((resolve) => { resolvers.push(resolve); }));
    const first = read();
    const second = read();
    resolvers[0]({ stale: true });
    resolvers[1]({ current: true });
    await expect(first).resolves.toEqual({ status: 'superseded' });
    await expect(second).resolves.toEqual({ status: 'settled', value: { current: true } });
  });
});
