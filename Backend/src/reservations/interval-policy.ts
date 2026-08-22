import { BadRequestException } from '@nestjs/common';

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?Z$/;

export interface PropertyIntervalPolicy {
  timezone: string;
  dayUseStart: string;
  dayUseEnd: string;
  dayUseMinimumMinutes: number;
  reservationIntervalMinutes: number;
}

export interface IntervalInput { checkInAt: string; checkOutAt: string; }

function localParts(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

function localDateOf(date: Date, timezone: string): string { return localParts(date, timezone).slice(0, 10); }
function localTimeOf(date: Date, timezone: string): string { return localParts(date, timezone).slice(11); }

/** Resolves exactly one UTC instant for the supplied local minute; gaps and folds fail closed. */
export function resolveLocalMinute(localDateTime: string, timezone: string): Date {
  if (!LOCAL_DATE_TIME.test(localDateTime)) throw new BadRequestException('Invalid local interval boundary');
  const nominal = Date.parse(`${localDateTime}:00.000Z`);
  if (Number.isNaN(nominal)) throw new BadRequestException('Invalid local interval boundary');
  const matches: Date[] = [];
  for (let minutes = -14 * 60; minutes <= 14 * 60; minutes += 30) {
    const candidate = new Date(nominal - minutes * 60_000);
    if (localParts(candidate, timezone) === localDateTime) matches.push(candidate);
  }
  if (matches.length !== 1) throw new BadRequestException('Local interval boundary is ambiguous or does not exist');
  return matches[0]!;
}

export function assertUtcBoundary(value: string): Date {
  if (!UTC_TIMESTAMP.test(value)) throw new BadRequestException('Interval boundaries must be UTC timestamps with millisecond precision');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) throw new BadRequestException('Invalid UTC interval boundary');
  return parsed;
}

export function assertInterval(policy: PropertyIntervalPolicy, input: IntervalInput): { checkInAt: Date; checkOutAt: Date; minutes: number; checkInDate: string; checkOutDate: string } {
  const checkInAt = assertUtcBoundary(input.checkInAt);
  const checkOutAt = assertUtcBoundary(input.checkOutAt);
  const minutes = (checkOutAt.getTime() - checkInAt.getTime()) / 60_000;
  if (!Number.isInteger(minutes) || minutes <= 0) throw new BadRequestException('Check-out must be after check-in');
  if (minutes % policy.reservationIntervalMinutes !== 0) throw new BadRequestException('Interval must align to the property interval');
  const checkInLocal = localParts(checkInAt, policy.timezone);
  const checkOutLocal = localParts(checkOutAt, policy.timezone);
  if (Number(checkInLocal.slice(14)) % policy.reservationIntervalMinutes !== 0 || Number(checkOutLocal.slice(14)) % policy.reservationIntervalMinutes !== 0) {
    throw new BadRequestException('Interval must align to the property local interval');
  }
  const sameLocalDay = localDateOf(checkInAt, policy.timezone) === localDateOf(checkOutAt, policy.timezone);
  if (sameLocalDay && (localTimeOf(checkInAt, policy.timezone) < policy.dayUseStart || localTimeOf(checkOutAt, policy.timezone) > policy.dayUseEnd || minutes < policy.dayUseMinimumMinutes)) {
    throw new BadRequestException('Day-use interval is outside the property policy');
  }
  return { checkInAt, checkOutAt, minutes, checkInDate: localDateOf(checkInAt, policy.timezone), checkOutDate: localDateOf(checkOutAt, policy.timezone) };
}

export function assertEligibleEarlyCheckIn(policy: PropertyIntervalPolicy, reservationStart: Date, requestedStart: Date): void {
  if (requestedStart >= reservationStart) return;
  const reservationDate = localDateOf(reservationStart, policy.timezone);
  const earliest = resolveLocalMinute(`${reservationDate}T00:00`, policy.timezone);
  const earliestAllowed = new Date(earliest.getTime() - 24 * 60 * 60_000);
  if (requestedStart < earliestAllowed) throw new BadRequestException('Early check-in may be at most one property-local day early');
}

export function proratedAmount(nightlyRate: string, minutes: number): string {
  const match = /^(\d{1,12})\.(\d{2})$/.exec(nightlyRate);
  if (!match) throw new BadRequestException('Invalid stored nightly rate');
  const cents = BigInt(match[1]!) * 100n + BigInt(match[2]!);
  const numerator = cents * BigInt(minutes);
  const rounded = (numerator + 720n) / 1440n;
  if (rounded > 99_999_999_999_999n) throw new BadRequestException('Reservation total exceeds supported amount');
  return `${rounded / 100n}.${(rounded % 100n).toString().padStart(2, '0')}`;
}
