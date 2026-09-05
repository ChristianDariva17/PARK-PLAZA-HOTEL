import { z } from 'zod';

const serviceSelectionDto = z.object({
  code: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(1_000).default(1),
});

const bookingTimesDto = z.object({
  eventStartsAt: z.string().datetime(),
  eventEndsAt: z.string().datetime(),
}).refine((data) => new Date(data.eventStartsAt) < new Date(data.eventEndsAt), {
  message: 'eventEndsAt must be after eventStartsAt',
  path: ['eventEndsAt'],
});

export const createEventDto = z.object({
  spaceId: z.string().uuid(),
  guestId: z.string().uuid().optional(),
  customerAccountId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  timeKind: z.enum(['full_day', 'time_bound', 'multi_day']),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  timezone: z.string().min(1).max(64),
  attendees: z.number().int().min(1),
  estimatedAmount: z.number().min(0).optional(),
  eventStartsAt: z.string().datetime().optional(),
  eventEndsAt: z.string().datetime().optional(),
  services: z.array(serviceSelectionDto).max(50).optional(),
  idempotencyKey: z.string().min(1).max(255),
}).refine(data => {
  const start = new Date(data.startsAt);
  const end = new Date(data.endsAt);
  return start < end;
}, {
  message: 'startsAt must be before endsAt',
  path: ['endsAt'],
}).refine(data => {
  const hasGuest = !!data.guestId;
  const hasCustomer = !!data.customerAccountId;
  return hasGuest !== hasCustomer;
}, {
  message: 'Must provide exactly one of guestId or customerAccountId',
  path: ['guestId'],
});

export const updateEventDto = z.object({
  spaceId: z.string().uuid().optional(),
  guestId: z.string().uuid().nullable().optional(),
  customerAccountId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  timeKind: z.enum(['full_day', 'time_bound', 'multi_day']).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  timezone: z.string().min(1).max(64).optional(),
  attendees: z.number().int().min(1).optional(),
  estimatedAmount: z.number().min(0).optional(),
  eventStartsAt: z.string().datetime().optional(),
  eventEndsAt: z.string().datetime().optional(),
  services: z.array(serviceSelectionDto).max(50).optional(),
  expectedVersion: z.number().int().min(1),
  idempotencyKey: z.string().min(1).max(255),
}).refine(data => {
  if (data.startsAt && data.endsAt) {
    const start = new Date(data.startsAt);
    const end = new Date(data.endsAt);
    return start < end;
  }
  return true;
}, {
  message: 'startsAt must be before endsAt',
  path: ['endsAt'],
}).refine(data => {
  if (data.guestId && data.customerAccountId) return false;
  return true;
}, {
  message: 'Cannot provide both guestId and customerAccountId simultaneously',
  path: ['guestId'],
});

export const listEventsDto = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  spaceId: z.string().uuid().optional(),
  status: z.enum(['draft', 'tentative', 'confirmed', 'preparing', 'in_progress', 'cancelled', 'completed', 'archived']).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const eventCommandDto = z.object({
  expectedVersion: z.number().int().min(1),
  idempotencyKey: z.string().min(1).max(255),
});

export const confirmEventDto = eventCommandDto.extend({
  depositReceivedAmount: z.number().min(0),
  paymentMethod: z.string().max(64).optional(),
  notes: z.string().max(500).optional(),
});

export const checkAvailabilityDto = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  excludeEventId: z.string().uuid().optional(),
});

export const cancelEventDto = eventCommandDto.extend({
  reason: z.string().min(1).max(500),
});

export const resolveIdentityDto = z.object({
  resolutionType: z.enum(['guest', 'customerAccount']),
  selectedId: z.string().uuid(),
});

export const quoteEventDto = z.object({
  spaceId: z.string().uuid(),
  attendees: z.number().int().min(1),
  timezone: z.string().min(1).max(64),
  services: z.array(serviceSelectionDto).max(50).default([]),
}).and(bookingTimesDto);

export const customerCreateEventDto = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2_000).optional(),
  spaceId: z.string().uuid(),
  attendees: z.number().int().min(1),
  timezone: z.string().min(1).max(64),
  services: z.array(serviceSelectionDto).max(50).default([]),
}).and(bookingTimesDto);

export const updateSpacePolicyDto = z.object({
  capacity: z.number().int().min(1).optional(),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  setupMinutes: z.number().int().min(0).max(1_440).optional(),
  teardownMinutes: z.number().int().min(0).max(1_440).optional(),
  minimumDurationMinutes: z.number().int().min(1).max(10_080).optional(),
  baseRate: z.number().min(0).optional(),
  includedMinutes: z.number().int().min(0).max(10_080).optional(),
  extraMinuteRate: z.number().min(0).optional(),
  depositPercentage: z.number().min(0).max(100).optional(),
  guaranteeAmount: z.number().min(0).optional(),
  cleaningFee: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  rules: z.record(z.string(), z.unknown()).optional(),
  cancellationPolicy: z.record(z.string(), z.unknown()).optional(),
});

export const replaceSpaceServicesDto = z.array(z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  unitAmount: z.number().min(0),
  active: z.boolean().default(true),
})).max(100);
