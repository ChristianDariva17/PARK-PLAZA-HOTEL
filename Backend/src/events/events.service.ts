import { Injectable, ConflictException, NotFoundException, Inject, Optional } from '@nestjs/common';
import { and, eq, sql, gt, lt, lte, gte, or, ilike, desc, asc, inArray } from 'drizzle-orm';
import { DATABASE } from '../database/database.module.js';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import { AuditService } from '../audit/audit.service.js';
import { FolioService } from '../folios/folio.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { randomUUID } from 'crypto';
import { requestFingerprint } from '../database/idempotency.js';
import { OutboxService } from '../audit/outbox.service.js';
import type { RequestContext } from '../auth/auth.types.js';

@Injectable()
export class EventsService {
  constructor(
    @Inject(DATABASE) private db: NodePgDatabase<typeof schema>,
    private auditService: AuditService,
    private folioService: FolioService,
    private realtime: RealtimeGateway,
    @Optional() private outbox?: OutboxService,
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
        propertyId,
        spaceId,
        code: service.code,
        name: service.name,
        category: service.category ?? 'General',
        unitAmount: String(service.unitAmount),
        perPerson: service.perPerson ?? false,
        active: service.active,
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

  private async checkIdempotency(tx: any, propertyId: string, idempotencyKey: string, operation: string, payload: unknown) {
    if (!idempotencyKey) throw new ConflictException('Idempotency key is required');
    const fingerprint = requestFingerprint({ operation, payload });
    const existing = await tx.select({ response: schema.eventCommands.response, fingerprint: schema.eventCommands.fingerprint, operation: schema.eventCommands.operation })
      .from(schema.eventCommands)
      .where(and(eq(schema.eventCommands.propertyId, propertyId), eq(schema.eventCommands.idempotencyKey, idempotencyKey)))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].operation !== operation || existing[0].fingerprint !== fingerprint) {
        throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
      }
      return existing[0].response;
    }
    return null;
  }

  private async enqueueRealtime(tx: any, propertyId: string, eventType: string, payload: unknown, aggregateId?: string, context: RequestContext = {}): Promise<void> {
    if (!this.outbox) return;
    await this.outbox.enqueue(tx, {
      propertyId,
      eventType,
      aggregateType: 'event',
      ...(aggregateId ? { aggregateId } : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
      payload: payload as Record<string, unknown>,
    });
  }

  async createEvent(propertyId: string, accountId: string, data: any, idempotencyKey: string, context: RequestContext = {}) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, idempotencyKey, 'create', data);
      if (previousResponse) return previousResponse;

      const pricing = await this.calculateServerPricing(tx, propertyId, data);
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
        startsAt: pricing.startsAt,
        endsAt: pricing.endsAt,
        eventStartsAt: pricing.eventStartsAt,
        eventEndsAt: pricing.eventEndsAt,
        timezone: data.timezone,
        attendees: data.attendees,
        estimatedAmount: String(pricing.pricing.totalAmount),
        pricingSnapshot: pricing.pricing,
        policySnapshot: pricing.policySnapshot,
        createdByAccountId: accountId,
        status: 'draft',
      }).returning();

      if (data.services && data.services.length > 0) {
        await tx.insert(schema.eventServices).values(
          pricing.services.map((s: any) => ({
            id: randomUUID(),
            propertyId,
            eventId: newEventId,
            serviceCode: s.code,
            quantity: s.quantity,
            unitAmount: String(s.unitAmount),
            totalAmount: String(s.totalAmount),
          }))
        );
      }

      await tx.insert(schema.eventCommands).values({
        propertyId,
        eventId: newEventId,
        operation: 'create',
        idempotencyKey,
        fingerprint: requestFingerprint({ operation: 'create', payload: data }),
        response: event,
      });

      await this.auditService.record({
        ...context,
        actorAccountId: accountId,
        propertyId,
        eventType: 'event.created',
        subjectType: 'event',
        subjectId: newEventId,
        metadata: { title: data.title },
      }, tx as any);
      await this.enqueueRealtime(tx, propertyId, 'event:created', event, newEventId, context);

      return event;
    });
    return result;
  }

  async createCustomerPreReservation(customer: { propertyId: string; customerAccountId: string }, data: any, idempotencyKey: string, context: RequestContext = {}) {
    const quote = await this.quote(customer.propertyId, data);
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, customer.propertyId);
      const previousResponse = await this.checkIdempotency(tx, customer.propertyId, idempotencyKey, 'customer_event_pre_reservation', data);
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
      await tx.insert(schema.eventCommands).values({ propertyId: customer.propertyId, eventId, operation: 'customer_pre_reservation', idempotencyKey, fingerprint: requestFingerprint({ operation: 'customer_event_pre_reservation', payload: data }), response: event });
      await this.auditService.record({ ...context, eventType: 'event.pre_reserved', subjectType: 'event', subjectId: eventId, propertyId: customer.propertyId, metadata: { customerAccountId: customer.customerAccountId, expiresAt: expiresAt.toISOString() } }, tx as any);
      await this.enqueueRealtime(tx, customer.propertyId, 'event:created', event, eventId, context);
      return event;
    });
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

  async cancelCustomerEvent(customer: { propertyId: string; customerAccountId: string }, eventId: string, reason: string, idempotencyKey: string, context: RequestContext = {}) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, customer.propertyId);
      const previousResponse = await this.checkIdempotency(tx, customer.propertyId, idempotencyKey, 'customer_cancel_event', { eventId, reason });
      if (previousResponse) return previousResponse;
      const event = await tx.query.events.findFirst({ where: and(eq(schema.events.id, eventId), eq(schema.events.propertyId, customer.propertyId), eq(schema.events.customerAccountId, customer.customerAccountId)) });
      if (!event) throw new NotFoundException('Event not found');
      if (!['draft', 'tentative'].includes(event.status)) throw new ConflictException('This event can no longer be cancelled online');
      const [updated] = await tx.update(schema.events).set({ status: 'cancelled', cancellationReason: reason, cancelledAt: new Date(), updatedAt: new Date(), version: event.version + 1 }).where(eq(schema.events.id, eventId)).returning();
      await tx.insert(schema.eventCommands).values({ propertyId: customer.propertyId, eventId, operation: 'customer_cancel_event', idempotencyKey, fingerprint: requestFingerprint({ operation: 'customer_cancel_event', payload: { eventId, reason } }), response: updated });
       await this.auditService.record({ ...context, eventType: 'event.cancelled_by_customer', subjectType: 'event', subjectId: eventId, propertyId: customer.propertyId, metadata: { customerAccountId: customer.customerAccountId, reason } }, tx as any);
       await this.enqueueRealtime(tx, customer.propertyId, 'event:cancelled', updated, eventId, context);
      return updated;
    });
    return result;
  }

  async updateEvent(propertyId: string, eventId: string, accountId: string, data: any, idempotencyKey: string, context: RequestContext = {}) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, idempotencyKey, 'update', data);
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
      const existingServices = data.services === undefined
        ? await tx.select().from(schema.eventServices).where(and(
          eq(schema.eventServices.propertyId, propertyId),
          eq(schema.eventServices.eventId, eventId),
        ))
        : [];
      const pricing = await this.calculateServerPricing(tx, propertyId, {
        ...data,
        spaceId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        eventStartsAt: data.eventStartsAt ?? event.eventStartsAt?.toISOString(),
        eventEndsAt: data.eventEndsAt ?? event.eventEndsAt?.toISOString(),
        attendees: data.attendees ?? event.attendees,
        services: data.services ?? existingServices.map((service: any) => ({ code: service.serviceCode, quantity: service.quantity })),
      });

      if (['tentative', 'confirmed', 'preparing', 'in_progress'].includes(event.status)) {
        await this.checkAvailability(tx, propertyId, spaceId, pricing.startsAt, pricing.endsAt, eventId);
      }

      const [updated] = await tx.update(schema.events)
        .set({
          spaceId,
          guestId: data.guestId,
          customerAccountId: data.customerAccountId,
          title: data.title,
          description: data.description,
          timeKind: data.timeKind,
          startsAt: pricing.startsAt,
          endsAt: pricing.endsAt,
          eventStartsAt: pricing.eventStartsAt,
          eventEndsAt: pricing.eventEndsAt,
          timezone: data.timezone,
          attendees: data.attendees,
          estimatedAmount: String(pricing.pricing.totalAmount),
          pricingSnapshot: pricing.pricing,
          policySnapshot: pricing.policySnapshot,
          version: event.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.events.id, eventId))
        .returning();

      if (data.services !== undefined) {
        await tx.delete(schema.eventServices).where(eq(schema.eventServices.eventId, eventId));
        if (data.services.length > 0) {
          await tx.insert(schema.eventServices).values(
            pricing.services.map((s: any) => ({
              id: randomUUID(),
              propertyId,
              eventId,
              serviceCode: s.code,
              quantity: s.quantity,
              unitAmount: String(s.unitAmount),
              totalAmount: String(s.totalAmount),
            }))
          );
        }
      }

      await tx.insert(schema.eventCommands).values({
        propertyId,
        eventId,
        operation: 'update',
        idempotencyKey,
        fingerprint: requestFingerprint({ operation: 'update', payload: data }),
        response: updated,
      });

      await this.auditService.record({
        ...context,
        actorAccountId: accountId,
        propertyId,
        eventType: 'event.updated',
        subjectType: 'event',
        subjectId: eventId,
        metadata: { fromVersion: event.version, toVersion: updated!.version },
      }, tx as any);
      await this.enqueueRealtime(tx, propertyId, 'event:updated', updated, eventId, context);

      return updated;
    });
    return result;
  }

  async confirmEvent(propertyId: string, eventId: string, accountId: string, data: any, idempotencyKey: string, context: RequestContext = {}) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, idempotencyKey, 'confirm', data);
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
        idempotencyKey,
        fingerprint: requestFingerprint({ operation: 'confirm', payload: data }),
        response: updated,
      });

      await this.auditService.record({
        ...context,
        actorAccountId: accountId,
        propertyId,
        eventType: 'event.confirmed',
        subjectType: 'event',
        subjectId: eventId,
        metadata: { 
          depositReceivedAmount: data.depositReceivedAmount,
          paymentMethod: data.paymentMethod || 'cash',
          notes: data.notes 
        },
      }, tx as any);
       await this.enqueueRealtime(tx, propertyId, 'event:confirmed', updated, eventId, context);

      return updated;
    });
    return result;
  }

  async cancelEvent(propertyId: string, eventId: string, accountId: string, data: any, idempotencyKey: string, context: RequestContext = {}) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, idempotencyKey, 'cancel', data);
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
        idempotencyKey,
        fingerprint: requestFingerprint({ operation: 'cancel', payload: data }),
        response: updated,
      });

      await this.auditService.record({
        ...context,
        actorAccountId: accountId,
        propertyId,
        eventType: 'event.cancelled',
        subjectType: 'event',
        subjectId: eventId,
        metadata: { reason: data.reason },
      }, tx as any);
       await this.enqueueRealtime(tx, propertyId, 'event:cancelled', updated, eventId, context);

      return updated;
    });
    return result;
  }

  async advanceEvent(propertyId: string, eventId: string, accountId: string, status: 'preparing' | 'in_progress' | 'completed', data: any, idempotencyKey: string, context: RequestContext = {}) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);
      const previousResponse = await this.checkIdempotency(tx, propertyId, idempotencyKey, status, data);
      if (previousResponse) return previousResponse;
      const event = await tx.query.events.findFirst({ where: and(eq(schema.events.propertyId, propertyId), eq(schema.events.id, eventId)) });
      if (!event) throw new NotFoundException('Event not found');
      if (event.version !== data.expectedVersion) throw new ConflictException('Event version mismatch.');
      const allowedFrom = status === 'preparing' ? ['confirmed'] : status === 'in_progress' ? ['preparing'] : ['in_progress'];
      if (!allowedFrom.includes(event.status)) throw new ConflictException(`Event cannot move to ${status} from ${event.status}`);
      const [updated] = await tx.update(schema.events).set({ status, version: event.version + 1, updatedAt: new Date() }).where(eq(schema.events.id, eventId)).returning();
      await tx.insert(schema.eventCommands).values({ propertyId, eventId, operation: status, idempotencyKey, fingerprint: requestFingerprint({ operation: status, payload: data }), response: updated });
       await this.auditService.record({ ...context, actorAccountId: accountId, eventType: `event.${status}`, subjectType: 'event', subjectId: eventId, propertyId, metadata: {} }, tx as any);
       await this.enqueueRealtime(tx, propertyId, 'event:status_changed', updated, eventId, context);
      return updated;
    });
    return result;
  }

  async archiveEvent(propertyId: string, eventId: string, accountId: string, data: any, idempotencyKey: string, context: RequestContext = {}) {
    const result = await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx as any, propertyId);

      const previousResponse = await this.checkIdempotency(tx, propertyId, idempotencyKey, 'archive', data);
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
        idempotencyKey,
        fingerprint: requestFingerprint({ operation: 'archive', payload: data }),
        response: updated,
      });

      await this.auditService.record({
        ...context,
        actorAccountId: accountId,
        propertyId,
        eventType: 'event.archived',
        subjectType: 'event',
        subjectId: eventId,
        metadata: {},
      }, tx as any);
       await this.enqueueRealtime(tx, propertyId, 'event:archived', updated, eventId, context);

      return updated;
    });
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

  private async calculateServerPricing(tx: any, propertyId: string, data: any) {
    const space = await tx.query.eventSpaces.findFirst({
      where: and(eq(schema.eventSpaces.propertyId, propertyId), eq(schema.eventSpaces.id, data.spaceId)),
      with: { spaceServices: true },
    });
    if (!space || !space.active) throw new NotFoundException('Event space not found or inactive');
    if (space.capacity !== null && data.attendees > space.capacity) {
      throw new ConflictException('Attendee count exceeds the space capacity');
    }

    const startsAt = new Date(data.startsAt);
    const endsAt = new Date(data.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || startsAt >= endsAt) {
      throw new ConflictException('Event interval is invalid');
    }

    const eventStartsAt = data.eventStartsAt ? new Date(data.eventStartsAt) : startsAt;
    const eventEndsAt = data.eventEndsAt ? new Date(data.eventEndsAt) : endsAt;
    if (!Number.isFinite(eventStartsAt.getTime()) || !Number.isFinite(eventEndsAt.getTime()) || eventStartsAt >= eventEndsAt) {
      throw new ConflictException('Public event interval is invalid');
    }

    const durationMinutes = Math.round((eventEndsAt.getTime() - eventStartsAt.getTime()) / 60_000);
    if (durationMinutes < space.minimumDurationMinutes) {
      throw new ConflictException('Event duration is below the minimum for this space');
    }

    const selections = new Map<string, number>((data.services ?? []).map((service: any) => [service.code, Number(service.quantity)]));
    const policyServices = (space.spaceServices ?? []).filter((service: any) => service.active);
    const policyByCode = new Map<string, any>(policyServices.map((service: any) => [service.code, service] as [string, any]));
    if ([...selections.keys()].some((code) => !policyByCode.has(code))) {
      throw new ConflictException('One or more selected services are unavailable for this space');
    }

    const services = [...selections.entries()].map(([code, quantity]) => {
      const service = policyByCode.get(code)!;
      const unitAmount = Number(service.unitAmount);
      return { code, name: service.name, quantity, unitAmount, totalAmount: Number((unitAmount * quantity).toFixed(2)) };
    });
    const baseAmount = Number(space.baseRate);
    const extraMinutes = Math.max(0, durationMinutes - space.includedMinutes);
    const extraAmount = Number((extraMinutes * Number(space.extraMinuteRate)).toFixed(2));
    const servicesAmount = Number(services.reduce((total, service) => total + service.totalAmount, 0).toFixed(2));
    const cleaningAmount = Number(space.cleaningFee);
    const subtotal = Number((baseAmount + extraAmount + servicesAmount + cleaningAmount).toFixed(2));
    const taxAmount = Number((subtotal * Number(space.taxRate) / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));
    const depositAmount = Number((totalAmount * Number(space.depositPercentage) / 100).toFixed(2));
    const pricing = {
      durationMinutes,
      baseAmount,
      extraMinutes,
      extraAmount,
      servicesAmount,
      cleaningAmount,
      subtotal,
      taxAmount,
      totalAmount,
      depositAmount,
      balanceAmount: Number((totalAmount - depositAmount).toFixed(2)),
      guaranteeAmount: Number(space.guaranteeAmount),
    };

    return {
      startsAt: data.eventStartsAt ? new Date(eventStartsAt.getTime() - space.setupMinutes * 60_000) : startsAt,
      endsAt: data.eventEndsAt ? new Date(eventEndsAt.getTime() + space.teardownMinutes * 60_000) : endsAt,
      eventStartsAt: data.eventStartsAt ? eventStartsAt : null,
      eventEndsAt: data.eventEndsAt ? eventEndsAt : null,
      services,
      pricing,
      policySnapshot: {
        setupMinutes: space.setupMinutes,
        teardownMinutes: space.teardownMinutes,
        rules: space.rules,
        cancellationPolicy: space.cancellationPolicy,
      },
    };
  }
}
