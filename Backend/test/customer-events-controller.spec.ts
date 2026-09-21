import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Environment } from '../src/config/environment.js';
import { CustomerEventsController } from '../src/customer/customer-events.controller.js';
import type { EventsService } from '../src/events/events.service.js';

describe('CustomerEventsController', () => {
  it('rejects an invalid event space ID before querying PostgreSQL', () => {
    const events = { getSpacePolicy: vi.fn() } as unknown as EventsService;
    const config = { get: vi.fn().mockReturnValue('property-id') } as unknown as ConfigService<Environment, true>;
    const controller = new CustomerEventsController(events, config);

    expect(() => controller.spacePolicy('id')).toThrow(BadRequestException);
    expect(events.getSpacePolicy).not.toHaveBeenCalled();
  });
});
