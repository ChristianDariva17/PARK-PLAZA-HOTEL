import { BadRequestException, ConflictException, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { z } from 'zod';
import { DATABASE, type Database } from '../database/database.module.js';
import type { AuthenticatedAccount, AuthenticatedRequest } from '../auth/auth.types.js';
import { CurrentAccount } from '../auth/decorators/current-account.decorator.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { getRequestContext } from '../auth/request-context.js';
import { AuditService } from './audit.service.js';
import { isOutboxStatus, OutboxService, type OutboxMutationExecutor, type OutboxStatus } from './outbox.service.js';

@Controller('audit/outbox')
export class OutboxController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('audit.read')
  list(
    @CurrentAccount() actor: AuthenticatedAccount,
    @Query('status') statusValue?: string,
    @Query('limit') limitValue?: string,
    @Query('offset') offsetValue?: string,
  ) {
    const status = parseStatus(statusValue);
    const limit = parseInteger(limitValue, 50, 1, 100, 'limit');
    const offset = parseInteger(offsetValue, 0, 0, Number.MAX_SAFE_INTEGER, 'offset');
    return this.outbox.listEvents(actor.propertyId, status, limit, offset);
  }

  @Get(':id')
  @RequirePermissions('audit.read')
  async get(@CurrentAccount() actor: AuthenticatedAccount, @Param('id') id: string) {
    const event = await this.outbox.getEvent(actor.propertyId, parseUuidParam(id));
    if (!event) throw new NotFoundException('Outbox event not found in the authenticated property.');
    return event;
  }

  @Post(':id/requeue')
  @RequirePermissions('audit.manage')
  requeue(
    @CurrentAccount() actor: AuthenticatedAccount,
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const eventId = parseUuidParam(id);
    return this.database.transaction(async (tx) => {
      const event = await this.outbox.requeueDeadLetter(tx as unknown as OutboxMutationExecutor, actor.propertyId, eventId);
      if (!event) throw new ConflictException('Outbox event is not dead-lettered in the authenticated property.');

      await this.audit.record({
        eventType: 'outbox.dead_letter.requeued',
        actorAccountId: actor.accountId,
        subjectType: 'outbox_event',
        subjectId: eventId,
        propertyId: actor.propertyId,
        ...getRequestContext(request),
        metadata: { eventType: event.eventType },
      }, tx);
      return event;
    });
  }
}

function parseStatus(value?: string): OutboxStatus | undefined {
  if (value === undefined) return undefined;
  if (!isOutboxStatus(value)) throw new BadRequestException('Invalid outbox status.');
  return value;
}

function parseUuidParam(value: unknown): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new BadRequestException('Invalid ID.');
  return result.data;
}

function parseInteger(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) throw new BadRequestException(`Invalid ${name} parameter.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new BadRequestException(`Invalid ${name} parameter.`);
  return parsed;
}
