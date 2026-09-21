import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service.js';

type ThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

const INCREMENT_SCRIPT = `
local blocked_ttl = redis.call('PTTL', KEYS[2])
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if blocked_ttl > 0 then
  return { current, math.max(redis.call('PTTL', KEYS[1]), 0), blocked_ttl, 1 }
end

local total = redis.call('INCR', KEYS[1])
if total == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local counter_ttl = math.max(redis.call('PTTL', KEYS[1]), 0)
if total > tonumber(ARGV[2]) then
  local block_duration = tonumber(ARGV[3])
  if block_duration > 0 then
    redis.call('SET', KEYS[2], '1', 'PX', block_duration)
    return { total, counter_ttl, block_duration, 1 }
  end
  return { total, counter_ttl, -1, 1 }
end
return { total, counter_ttl, -1, 0 }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const namespace = `park-plaza:throttle:${throttlerName}:${key}`;
    const result = await this.redis.getCommandClient().eval(INCREMENT_SCRIPT, {
      keys: [`${namespace}:counter`, `${namespace}:blocked`],
      arguments: [String(ttl), String(limit), String(blockDuration)],
    });
    const [totalHits, timeToExpire, timeToBlockExpire, blocked] = result as number[];
    return {
      totalHits: Number(totalHits),
      timeToExpire: Number(timeToExpire),
      isBlocked: Number(blocked) === 1,
      timeToBlockExpire: Number(timeToBlockExpire),
    };
  }
}
