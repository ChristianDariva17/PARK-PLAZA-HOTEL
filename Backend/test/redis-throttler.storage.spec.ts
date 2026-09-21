import { describe, expect, it, vi } from 'vitest';
import { RedisThrottlerStorage } from '../src/infrastructure/redis-throttler.storage.js';

describe('RedisThrottlerStorage', () => {
  it('maps the atomic Redis result to the Nest throttler record', async () => {
    const evaluate = vi.fn().mockResolvedValue([3, 57, 2_000, 1]);
    const storage = new RedisThrottlerStorage({
      getCommandClient: () => ({ eval: evaluate }),
    } as any);

    await expect(storage.increment('client-1', 60_000, 2, 2_000, 'default')).resolves.toEqual({
      totalHits: 3,
      timeToExpire: 57,
      isBlocked: true,
      timeToBlockExpire: 2_000,
    });
    expect(evaluate).toHaveBeenCalledOnce();
    expect(evaluate.mock.calls[0][1]).toEqual({
      keys: ['park-plaza:throttle:default:client-1:counter', 'park-plaza:throttle:default:client-1:blocked'],
      arguments: ['60000', '2', '2000'],
    });
  });
});
