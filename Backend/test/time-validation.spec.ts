import { describe, expect, it } from 'vitest';
import { updateSpacePolicyDto } from '../src/events/events.dto.js';
import { settingsUpdateSchema } from '../src/settings/settings.controller.js';

describe('time-of-day validation', () => {
  it('rejects hours outside the 00:00 through 23:59 range', () => {
    expect(updateSpacePolicyDto.safeParse({ openingTime: '24:00' }).success).toBe(false);
    expect(updateSpacePolicyDto.safeParse({ closingTime: '29:59' }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ dayUseStart: '24:00' }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ dayUseEnd: '29:59' }).success).toBe(false);
  });

  it('accepts valid 24-hour times', () => {
    expect(updateSpacePolicyDto.safeParse({ openingTime: '00:00', closingTime: '23:59' }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ dayUseStart: '00:00', dayUseEnd: '23:59' }).success).toBe(true);
  });
});
