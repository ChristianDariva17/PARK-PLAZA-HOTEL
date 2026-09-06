import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import { and, eq, sql, gt, lt, lte, gte, or, ilike, desc, asc, inArray } from 'drizzle-orm';
import { DATABASE } from '../database/database.module.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import { AuditService } from '../audit/audit.service.js';
import { FolioService } from '../folios/folio.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { randomUUID } from 'crypto';

@Injectable()
export class EventsService {
  constructor(
    @Inject(DATABASE) private db: NodePgDatabase<typeof schema>,
    private auditService: AuditService,
    private folioService: FolioService,
    private realtime: RealtimeGateway,
  ) {}

  async listEvents(propertyId: string, params: { from?: string; to?: string; spaceId?: string; status?: string; q?: string; page: number; pageSize: number }) {
    const conditions = [
      eq(schema.events.propertyId, propertyId),
    ];

    if (params.spaceId) conditions.push(eq(schema.events.spaceId, params.spaceId));
    if (params.status) {
      conditions.push(eq(schema.events.status, params.status as any));
    } else {
      conditions.push(sql`${schema.events.status} != 'archived'`);
    }

    if (params.from && params.to) {
      // Overlap logic: event starts before range ends, and ends after range starts
      conditions.push(
        lt(schema.events.startsAt, new Date(params.to)),
        gt(schema.events.endsAt, new Date(params.from))
      );
    }

    if (params.q) {
      conditions.push(ilike(schema.events.title, `%${params.q}%`));
    }

    const offset = (params.page - 1) * params.pageSize;

    const [countResult] = await this.db.select({ count: sql<number>`count(*)::int` })
      .from(schema.events)
      .where(and(...conditions));

    const items = await this.db.query.events.findMany({
      where: and(...conditions),
      orderBy: [asc(schema.events.startsAt)],
      limit: params.pageSize,
      offset,
      with: {
        space: true,
        guest: true,
        services: true,
      }
    });

    return {
      items,
      total: countResult?.count ?? 0,
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  async getEvent(propertyId: string, eventId: string) {
    const event = await this.db.query.events.findFirst({
      where: and(eq(schema.events.propertyId, propertyId), eq(schema.events.id, eventId)),
      with: { space: true, guest: true, services: true },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async getSpaces(propertyId: string) {
    return this.db.query.eventSpaces.findMany({
      where: and(eq(schema.eventSpaces.propertyId, propertyId), eq(schema.eventSpaces.active, true)),
    });
  }

  async getSpacePolicy(propertyId: string, spaceId: string) {
    const space = await this.db.query.eventSpaces.findFirst({
      where: and(eq(schema.eventSpaces.propertyId, propertyId), eq(schema.eventSpaces.id, spaceId)),
    });
    if (!space) throw new NotFoundException('Event space not found');
    const services = await this.db.select().from(schema.eventSpaceServices).where(and(
      eq(schema.eventSpaceServices.propertyId, propertyId),
      eq(schema.eventSpaceServices.spaceId, spaceId),
      eq(schema.eventSpaceServices.active, true),
    ));
    return { ...space, services };
  }

  async updateSpacePolicy(propertyId: string, spaceId: string, data: any) {
    const [space] = await this.db.update(schema.eventSpaces).set({
      ...data,
      baseRate: data.baseRate === undefined ? undefined : String(data.baseRate),
      extraMinuteRate: data.extraMinuteRate === undefined ? undefined : String(data.extraMinuteRate),
      depositPercentage: data.depositPercentage === undefined ? undefined : String(data.depositPercentage),
      guaranteeAmount: data.guaranteeAmount === undefined ? undefined : String(data.guaranteeAmount),
      cleaningFee: data.cleaningFee === undefined ? undefined : String(data.cleaningFee),
      taxRate: data.taxRate === undefined ? undefined : String(data.taxRate),
      updatedAt: new Date(),
    }).where(and(eq(schema.eventSpaces.propertyId, propertyId), eq(schema.eventSpaces.id, spaceId))).returning();
    if (!space) throw new NotFoundException('Event space not found');
    return space;
  }

  async replaceSpaceServices(propertyId: string, spaceId: string, services: any[]) {
    return this.db.transaction(async (tx) => {
      const space = await tx.query.eventSpaces.findFirst({ where: and(eq(schema.eventSpaces.propertyId, propertyId), eq(schema.eventSpaces.id, spaceId)) });
      if (!space) throw new NotFoundException('Event space not found');
      await tx.delete(schema.eventSpaceServices).where(and(eq(schema.eventSpaceServices.propertyId, propertyId), eq(schema.eventSpaceServices.spaceId, spaceId)));
      if (services.length) await tx.insert(schema.eventSpaceServices).values(services.map((service) => ({
        propertyId, spaceId, code: service.code, name: service.name, unitAmount: String(service.unitAmount), active: service.active,
      })));
      const savedServices = await tx.select().from(schema.eventSpaceServices).where(and(
        eq(schema.eventSpaceServices.propertyId, propertyId),
        eq(schema.eventSpaceServices.spaceId, spaceId),
      ));
      return { ...space, services: savedServices };
    });
  }

  async quote(propertyId: string, data: any) {
    const policy = await this.getSpacePolicy(propertyId, data.spaceId);
    if (!policy.active) throw new ConflictException('Event space is inactive');
    if (policy.capacity && data.attendees > policy.capacity) throw new ConflictException('Attendee count exceeds the space capacity');
    const eventStartsAt = new Date(data.eventStartsAt);
    const eventEndsAt = new Date(data.eventEndsAt);
    const durationMinutes = Math.round((eventEndsAt.getTime() - eventStartsAt.getTime()) / 60_000);
    if (durationMinutes < policy.minimumDurationMinutes) throw new ConflictException('Event duration is below the minimum for this space');

    const selected = new Map<string, number>((data.services ?? []).map((service: any) => [service.code, Number(service.quantity)]));
    const services = policy.services.filter((service: any) => selected.has(service.code)).map((service: any) => {
      const quantity = selected.get(service.code)!;
      const unitAmount = Number(service.unitAmount);
      return { code: service.code, name: service.name, quantity, unitAmount, totalAmount: unitAmount * quantity };
    });
    if (selected.size !== services.length) throw new ConflictException('One or more selected services are unavailable for this space');

    const baseAmount = Number(policy.baseRate);
    const extraMinutes = Math.max(0, durationMinutes - policy.includedMinutes);
    const extraAmount = extraMinutes * Number(policy.extraMinuteRate);
    const servicesAmount = services.reduce((total: number, service: any) => total + service.totalAmount, 0);
    const cleaningAmount = Number(policy.cleaningFee);
    const subtotal = baseAmount + extraAmount + servicesAmount + cleaningAmount;
    const taxAmount = subtotal * Number(policy.taxRate) / 100;
    const totalAmount = subtotal + taxAmount;
    const depositAmount = totalAmount * Number(policy.depositPercentage) / 100;
    const guaranteeAmount = Number(policy.guaranteeAmount);
    return {
      space: policy,
      startsAt: new Date(eventStartsAt.getTime() - policy.setupMinutes * 60_000),
      endsAt: new Date(eventEndsAt.getTime() + policy.teardownMinutes * 60_000),
      eventStartsAt,
      eventEndsAt,
      services,
      pricing: { durationMinutes, baseAmount, extraMinutes, extraAmount, servicesAmount, cleaningAmount, subtotal, taxAmount, totalAmount, depositAmount, balanceAmount: totalAmount - depositAmount, guaranteeAmount },
      policySnapshot: { setupMinutes: policy.setupMinutes, teardownMinutes: policy.teardownMinutes, rules: policy.rules, cancellationPolicy: policy.cancellationPolicy },
    };
  }

  private async checkAvailability(tx: any, propertyId: string, spaceId: string, startsAt: Date, endsAt: Date, excludeEventId?: string) {
    // Tentative events block only until their explicit expiry; all operational states block their full setup-to-teardown interval.
    const conditions = [
      eq(schema.events.propertyId, propertyId),
      eq(schema.events.spaceId, spaceId),
      or(
        inArray(schema.events.status, ['confirmed', 'preparing', 'in_progress']),
        and(eq(schema.events.status, 'tentative'), gt(schema.events.expiresAt, new Date())),
      ),
      lt(schema.events.startsAt, endsAt),
      gt(schema.events.endsAt, startsAt),
    ];
    if (excludeEventId) conditions.push(sql`${schema.events.id} != ${excludeEventId}`);

    const overlap = await tx.select({ id: schema.events.id }).from(schema.events).where(and(...conditions)).limit(1);
    if (overlap.length > 0) {
      throw new ConflictException('The space is not available during the requested time range');
    }
  }

  private async expireTentatives(tx: any, propertyId: string) {
    await tx.update(schema.events).set({ status: 'cancelled', cancelledAt: new Date(), cancellationReason: 'Pre-reservation expired', updatedAt: new Date() }).where(and(
      eq(schema.events.propertyId, propertyId),
      eq(schema.events.status, 'tentative'),
      lte(schema.events.expiresAt, new Date()),
    ));
  }

  private async checkIdempotency(tx: any, propertyId: string, idempotencyKey: string, fingerprint: string) {
    if (!idempotencyKey) return null;
    const existing = await tx.select({ response: schema.eventCommands.response, fingerprint: schema.eventCommands.fingerprint })
      .from(schema.eventCommands)
      .where(and(eq(schema.eventCommands.propertyId, propertyId), eq(schema.eventCommands.idempotencyKey, idempotencyKey)))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].fingerprint !== fingerprint) {
        throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
      }
      return existing[0].response;
    }
    return null;
  }

  async createEvent(propertyId: string, accountId: string, data: any) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, data.idempotencyKey, 'create_event');
      if (previousResponse) return previousResponse;

      const startsAt = new Date(data.startsAt);
      const endsAt = new Date(data.endsAt);
      
      const newEventId = randomUUID();

      const [event] = await tx.insert(schema.events).values({
        id: newEventId,
        propertyId,
        spaceId: data.spaceId,
        guestId: data.guestId,
        customerAccountId: data.customerAccountId,
        title: data.title,
        description: data.description,
        timeKind: data.timeKind,
        startsAt,
        endsAt,
        timezone: data.timezone,
        attendees: data.attendees,
        estimatedAmount: data.estimatedAmount ? data.estimatedAmount.toString() : null,
        createdByAccountId: accountId,
        status: 'draft',
      }).returning();

      if (data.services && data.services.length > 0) {
        await tx.insert(schema.eventServices).values(
          data.services.map((s: any) => ({
            id: randomUUID(),
            propertyId,
            eventId: newEventId,
            serviceCode: s.code,
            quantity: s.quantity || 1,
            unitAmount: s.unitAmount !== undefined ? String(s.unitAmount) : undefined,
            totalAmount: s.totalAmount !== undefined ? String(s.totalAmount) : (s.unitAmount !== undefined ? String(Number(s.unitAmount) * (s.quantity || 1)) : undefined),
            notes: s.notes || undefined,
          }))
        );
      }

      await tx.insert(schema.eventCommands).values({
        propertyId,
        eventId: newEventId,
        operation: 'create',
        idempotencyKey: data.idempotencyKey,
        fingerprint: 'create_event',
        response: event,
      });

      this.auditService.record({
        actorAccountId: accountId,
        eventType: 'event.created',
        subjectType: 'event',
        subjectId: newEventId,
        metadata: { title: data.title },
      }, tx as any);

      return event;
    });
    this.realtime.emitToProperty(propertyId, 'event:created', result);
    return result;
  }

  async createCustomerPreReservation(customer: { propertyId: string; customerAccountId: string }, data: any, idempotencyKey: string) {
    const quote = await this.quote(customer.propertyId, data);
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, customer.propertyId);
      const previousResponse = await this.checkIdempotency(tx, customer.propertyId, idempotencyKey, 'customer_event_pre_reservation');
      if (previousResponse) return previousResponse;
      await this.expireTentatives(tx, customer.propertyId);
      await this.checkAvailability(tx, customer.propertyId, data.spaceId, quote.eventStartsAt, quote.eventEndsAt);
      const eventId = randomUUID();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const [event] = await tx.insert(schema.events).values({
        id: eventId,
        propertyId: customer.propertyId,
        spaceId: data.spaceId,
        customerAccountId: customer.customerAccountId,
        createdByCustomerAccountId: customer.customerAccountId,
        title: data.title,
        description: data.description,
        status: 'tentative',
        timeKind: 'time_bound',
        startsAt: quote.startsAt,
        endsAt: quote.endsAt,
        eventStartsAt: quote.eventStartsAt,
        eventEndsAt: quote.eventEndsAt,
        expiresAt,
        timezone: data.timezone,
        attendees: data.attendees,
        estimatedAmount: String(quote.pricing.totalAmount),
        depositAmount: String(quote.pricing.depositAmount),
        balanceAmount: String(quote.pricing.balanceAmount),
        guaranteeAmount: String(quote.pricing.guaranteeAmount),
        pricingSnapshot: quote.pricing,
        policySnapshot: quote.policySnapshot,
      }).returning();
      if (quote.services.length) await tx.insert(schema.eventServices).values(quote.services.map((service: any) => ({
        propertyId: customer.propertyId, eventId, serviceCode: service.code, quantity: service.quantity, unitAmount: String(service.unitAmount), totalAmount: String(service.totalAmount),
      })));
      await tx.insert(schema.eventCommands).values({ propertyId: customer.propertyId, eventId, operation: 'customer_pre_reservation', idempotencyKey, fingerprint: 'customer_event_pre_reservation', response: event });
      await this.auditService.record({ eventType: 'event.pre_reserved', subjectType: 'event', subjectId: eventId, propertyId: customer.propertyId, metadata: { customerAccountId: customer.customerAccountId, expiresAt: expiresAt.toISOString() } }, tx as any);
      return event;
    });
    this.realtime.emitToProperty(customer.propertyId, 'event:created', result);
    return result;
  }

  async listCustomerEvents(customer: { propertyId: string; customerAccountId: string }) {
    await this.db.transaction(async (tx) => this.expireTentatives(tx, customer.propertyId));
    return this.db.query.events.findMany({
      where: and(eq(schema.events.propertyId, customer.propertyId), eq(schema.events.customerAccountId, customer.customerAccountId)),
      orderBy: [desc(schema.events.startsAt)],
      with: { space: true, services: true },
    });
  }

  async cancelCustomerEvent(customer: { propertyId: string; customerAccountId: string }, eventId: string, reason: string, idempotencyKey: string) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, customer.propertyId);
      const previousResponse = await this.checkIdempotency(tx, customer.propertyId, idempotencyKey, 'customer_cancel_event');
      if (previousResponse) return previousResponse;
      const event = await tx.query.events.findFirst({ where: and(eq(schema.events.id, eventId), eq(schema.events.propertyId, customer.propertyId), eq(schema.events.customerAccountId, customer.customerAccountId)) });
      if (!event) throw new NotFoundException('Event not found');
      if (!['draft', 'tentative'].includes(event.status)) throw new ConflictException('This event can no longer be cancelled online');
      const [updated] = await tx.update(schema.events).set({ status: 'cancelled', cancellationReason: reason, cancelledAt: new Date(), updatedAt: new Date(), version: event.version + 1 }).where(eq(schema.events.id, eventId)).returning();
      await tx.insert(schema.eventCommands).values({ propertyId: customer.propertyId, eventId, operation: 'customer_cancel_event', idempotencyKey, fingerprint: 'customer_cancel_event', response: updated });
      await this.auditService.record({ eventType: 'event.cancelled_by_customer', subjectType: 'event', subjectId: eventId, propertyId: customer.propertyId, metadata: { customerAccountId: customer.customerAccountId, reason } }, tx as any);
      return updated;
    });
    this.realtime.emitToProperty(customer.propertyId, 'event:cancelled', result);
    return result;
  }

  async updateEvent(propertyId: string, eventId: string, accountId: string, data: any) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, data.idempotencyKey, 'update_event');
      if (previousResponse) return previousResponse;

      const event = await tx.query.events.findFirst({
        where: and(eq(schema.events.propertyId, propertyId), eq(schema.events.id, eventId)),
      });

      if (!event) throw new NotFoundException('Event not found');
      if (event.status === 'cancelled' || event.status === 'archived') throw new ConflictException('Event is cancelled or archived');
      if (event.version !== data.expectedVersion) throw new ConflictException('Event version mismatch. Please reload.');

      const startsAt = data.startsAt ? new Date(data.startsAt) : event.startsAt;
      const endsAt = data.endsAt ? new Date(data.endsAt) : event.endsAt;
      const spaceId = data.spaceId || event.spaceId;

      if (['tentative', 'confirmed', 'preparing', 'in_progress'].includes(event.status)) {
        await this.checkAvailability(tx, propertyId, spaceId, startsAt, endsAt, eventId);
      }

      const [updated] = await tx.update(schema.events)
        .set({
          spaceId: data.spaceId,
          guestId: data.guestId,
          customerAccountId: data.customerAccountId,
          title: data.title,
          description: data.description,
          timeKind: data.timeKind,
          startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
          endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
          timezone: data.timezone,
          attendees: data.attendees,
          estimatedAmount: data.estimatedAmount ? data.estimatedAmount.toString() : undefined,
          version: event.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.events.id, eventId))
        .returning();

      if (data.services !== undefined) {
        await tx.delete(schema.eventServices).where(eq(schema.eventServices.eventId, eventId));
        if (data.services.length > 0) {
          await tx.insert(schema.eventServices).values(
            data.services.map((s: any) => ({
              id: randomUUID(),
              propertyId,
              eventId,
              serviceCode: s.code,
              quantity: s.quantity || 1,
              unitAmount: s.unitAmount !== undefined ? String(s.unitAmount) : undefined,
              totalAmount: s.totalAmount !== undefined ? String(s.totalAmount) : (s.unitAmount !== undefined ? String(Number(s.unitAmount) * (s.quantity || 1)) : undefined),
              notes: s.notes || undefined,
            }))
          );
        }
      }

      await tx.insert(schema.eventCommands).values({
        propertyId,
        eventId,
        operation: 'update',
        idempotencyKey: data.idempotencyKey,
        fingerprint: 'update_event',
        response: updated,
      });

      this.auditService.record({
        actorAccountId: accountId,
        eventType: 'event.updated',
        subjectType: 'event',
        subjectId: eventId,
        metadata: { fromVersion: event.version, toVersion: updated!.version },
      }, tx as any);

      return updated;
    });
    this.realtime.emitToProperty(propertyId, 'event:updated', result);
    return result;
  }

  async confirmEvent(propertyId: string, eventId: string, accountId: string, data: any) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, data.idempotencyKey, 'confirm_event');
      if (previousResponse) return previousResponse;

      const event = await tx.query.events.findFirst({
        where: and(eq(schema.events.propertyId, propertyId), eq(schema.events.id, eventId)),
      });

      if (!event) throw new NotFoundException('Event not found');
      if (event.version !== data.expectedVersion) throw new ConflictException('Event version mismatch.');
      if (event.status === 'cancelled' || event.status === 'archived') throw new ConflictException('Event is cancelled or archived');
      if (event.status === 'tentative' && event.expiresAt && event.expiresAt <= new Date()) throw new ConflictException('The pre-reservation has expired');
      if (data.depositReceivedAmount < Number(event.depositAmount ?? 0)) throw new ConflictException('The required deposit has not been received');

      await this.checkAvailability(tx, propertyId, event.spaceId, event.startsAt, event.endsAt, eventId);

      const [updated] = await tx.update(schema.events)
        .set({
          status: 'confirmed',
          depositReceivedAmount: String(data.depositReceivedAmount),
          version: event.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.events.id, eventId))
        .returning();

      await tx.insert(schema.eventCommands).values({
        propertyId,
        eventId,
        operation: 'confirm',
        idempotencyKey: data.idempotencyKey,
        fingerprint: 'confirm_event',
        response: updated,
      });

      this.auditService.record({
        actorAccountId: accountId,
        eventType: 'event.confirmed',
        subjectType: 'event',
        subjectId: eventId,
        metadata: { 
          depositReceivedAmount: data.depositReceivedAmount,
          paymentMethod: data.paymentMethod || 'cash',
          notes: data.notes 
        },
      }, tx as any);

      return updated;
    });
    this.realtime.emitToProperty(propertyId, 'event:confirmed', result);
    return result;
  }

  async cancelEvent(propertyId: string, eventId: string, accountId: string, data: any) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, data.idempotencyKey, 'cancel_event');
      if (previousResponse) return previousResponse;

      const event = await tx.query.events.findFirst({
        where: and(eq(schema.events.propertyId, propertyId), eq(schema.events.id, eventId)),
      });

      if (!event) throw new NotFoundException('Event not found');
      if (event.version !== data.expectedVersion) throw new ConflictException('Event version mismatch.');
      if (event.status === 'archived') throw new ConflictException('Event is already archived');

      const [updated] = await tx.update(schema.events)
        .set({
          status: 'cancelled',
          version: event.version + 1,
          updatedAt: new Date(),
          cancelledAt: new Date(),
          cancelledByAccountId: accountId,
          cancellationReason: data.reason,
        })
        .where(eq(schema.events.id, eventId))
        .returning();

      await tx.insert(schema.eventCommands).values({
        propertyId,
        eventId,
        operation: 'cancel',
        idempotencyKey: data.idempotencyKey,
        fingerprint: 'cancel_event',
        response: updated,
      });

      this.auditService.record({
        actorAccountId: accountId,
        eventType: 'event.cancelled',
        subjectType: 'event',
        subjectId: eventId,
        metadata: { reason: data.reason },
      }, tx as any);

      return updated;
    });
    this.realtime.emitToProperty(propertyId, 'event:cancelled', result);
    return result;
  }

  async advanceEvent(propertyId: string, eventId: string, accountId: string, status: 'preparing' | 'in_progress' | 'completed', data: any) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);
      const previousResponse = await this.checkIdempotency(tx, propertyId, data.idempotencyKey, `event_${status}`);
      if (previousResponse) return previousResponse;
      const event = await tx.query.events.findFirst({ where: and(eq(schema.events.propertyId, propertyId), eq(schema.events.id, eventId)) });
      if (!event) throw new NotFoundException('Event not found');
      if (event.version !== data.expectedVersion) throw new ConflictException('Event version mismatch.');
      const allowedFrom = status === 'preparing' ? ['confirmed'] : status === 'in_progress' ? ['preparing'] : ['in_progress'];
      if (!allowedFrom.includes(event.status)) throw new ConflictException(`Event cannot move to ${status} from ${event.status}`);
      const [updated] = await tx.update(schema.events).set({ status, version: event.version + 1, updatedAt: new Date() }).where(eq(schema.events.id, eventId)).returning();
      await tx.insert(schema.eventCommands).values({ propertyId, eventId, operation: status, idempotencyKey: data.idempotencyKey, fingerprint: `event_${status}`, response: updated });
      await this.auditService.record({ actorAccountId: accountId, eventType: `event.${status}`, subjectType: 'event', subjectId: eventId, propertyId, metadata: {} }, tx as any);
      return updated;
    });
    this.realtime.emitToProperty(propertyId, 'event:status_changed', result);
    return result;
  }

  async archiveEvent(propertyId: string, eventId: string, accountId: string, data: any) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, data.idempotencyKey, 'archive_event');
      if (previousResponse) return previousResponse;

      const event = await tx.query.events.findFirst({
        where: and(eq(schema.events.propertyId, propertyId), eq(schema.events.id, eventId)),
      });

      if (!event) throw new NotFoundException('Event not found');
      if (event.version !== data.expectedVersion) throw new ConflictException('Event version mismatch.');
      if (!['cancelled', 'completed'].includes(event.status)) throw new ConflictException('Only cancelled or completed events can be archived.');

      const [updated] = await tx.update(schema.events)
        .set({
          status: 'archived',
          version: event.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.events.id, eventId))
        .returning();

      await tx.insert(schema.eventCommands).values({
        propertyId,
        eventId,
        operation: 'archive',
        idempotencyKey: data.idempotencyKey,
        fingerprint: 'archive_event',
        response: updated,
      });

      this.auditService.record({
        actorAccountId: accountId,
        eventType: 'event.archived',
        subjectType: 'event',
        subjectId: eventId,
        metadata: {},
      }, tx as any);

      return updated;
    });
    this.realtime.emitToProperty(propertyId, 'event:archived', result);
    return result;
  }

  async checkSpaceAvailability(propertyId: string, spaceId: string, from: string, to: string, excludeEventId?: string) {
    const startsAt = new Date(from);
    const endsAt = new Date(to);

    const conditions = [
      eq(schema.events.propertyId, propertyId),
      eq(schema.events.spaceId, spaceId),
      or(
        inArray(schema.events.status, ['confirmed', 'preparing', 'in_progress']),
        and(eq(schema.events.status, 'tentative'), gt(schema.events.expiresAt, new Date())),
      ),
      lt(schema.events.startsAt, endsAt),
      gt(schema.events.endsAt, startsAt),
    ];
    if (excludeEventId) conditions.push(sql`${schema.events.id} != ${excludeEventId}`);

    const conflicting = await this.db.query.events.findFirst({
      where: and(...conditions),
      with: { space: true, guest: true }
    });

    return {
      isAvailable: !conflicting,
      conflictingEvent: conflicting ? {
        id: conflicting.id,
        title: conflicting.title,
        startsAt: conflicting.startsAt,
        endsAt: conflicting.endsAt,
        status: conflicting.status,
      } : null,
    };
  }
}
