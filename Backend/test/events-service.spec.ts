import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventsService } from '../src/events/events.service.js';
import type { AuditService } from '../src/audit/audit.service.js';
import type { FolioService } from '../src/folios/folio.service.js';

describe('EventsService', () => {
  let service: EventsService;
  let db: any;
  let audit: any;
  let folio: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      for: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      execute: vi.fn(),
      query: {
        events: { findFirst: vi.fn(), findMany: vi.fn() },
      },
    };

    db = {
      transaction: vi.fn(async (cb) => cb(tx)),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      query: {
        events: { findFirst: vi.fn(), findMany: vi.fn() },
        eventSpaces: { findMany: vi.fn() },
      },
    };

    audit = { record: vi.fn() };
    folio = {}; // FolioService is intentionally decoupled, we don't expect calls to it.

    service = new EventsService(db, audit, folio, {
      emitToProperty: vi.fn(),
      emitToStay: vi.fn(),
    } as any);
  });

  describe('Lifecycle Machine', () => {
    it('creates a draft event and saves idempotency receipt', async () => {
      // Setup to mock idempotency check and insert
      vi.mocked(tx.limit).mockResolvedValueOnce([]); // No idempotency conflict
      
      const eventId = 'event-1';
      vi.mocked(tx.returning).mockResolvedValueOnce([{ id: eventId, status: 'draft', version: 1 }]);

      const result = await service.createEvent('prop-1', 'actor-1', {
        spaceId: 'space-1',
        title: 'New Event',
        timeKind: 'full_day',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        timezone: 'UTC',
        attendees: 10,
        idempotencyKey: 'key-1',
      });

      expect(result.status).toBe('draft');
      expect(tx.insert).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'event.created' }), tx);
    });

    it('returns the same response if idempotency key matches and fingerprint is identical', async () => {
      // Mock existing idempotency command
      vi.mocked(tx.limit).mockResolvedValueOnce([
        { response: { id: 'existing-1', status: 'draft' }, fingerprint: 'create_event' }
      ]);

      const result = await service.createEvent('prop-1', 'actor-1', {
        spaceId: 'space-1',
        title: 'New Event',
        timeKind: 'full_day',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        timezone: 'UTC',
        attendees: 10,
        idempotencyKey: 'key-1',
      });

      expect(result).toEqual({ id: 'existing-1', status: 'draft' });
      expect(tx.insert).not.toHaveBeenCalled();
    });

    it('throws IDEMPOTENCY_KEY_REUSED if fingerprint differs', async () => {
      vi.mocked(tx.limit).mockResolvedValueOnce([
        { response: {}, fingerprint: 'different_action' }
      ]);

      await expect(service.createEvent('prop-1', 'actor-1', {
        spaceId: 'space-1',
        title: 'New Event',
        timeKind: 'full_day',
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        timezone: 'UTC',
        attendees: 10,
        idempotencyKey: 'key-1',
      })).rejects.toThrow(ConflictException);
    });
  });

  describe('State transitions and Availability', () => {
    it('throws if trying to confirm but space is occupied', async () => {
      // Idempotency no conflict
      vi.mocked(tx.limit).mockResolvedValueOnce([]); 
      // Event exists
      vi.mocked(tx.query.events.findFirst).mockResolvedValueOnce({
        id: 'event-1', status: 'draft', version: 1, spaceId: 'space-1', startsAt: new Date(), endsAt: new Date()
      });
      // Check availability returns conflict (a confirmed event overlaps)
      vi.mocked(tx.limit).mockResolvedValueOnce([{ id: 'other-event' }]);

      await expect(service.confirmEvent('prop-1', 'event-1', 'actor-1', {
        idempotencyKey: 'key-1', expectedVersion: 1
      })).rejects.toThrow(ConflictException);
    });

    it('rejects updates if version mismatches', async () => {
      vi.mocked(tx.limit).mockResolvedValueOnce([]); 
      vi.mocked(tx.query.events.findFirst).mockResolvedValueOnce({
        id: 'event-1', status: 'draft', version: 2
      });

      await expect(service.updateEvent('prop-1', 'event-1', 'actor-1', {
        idempotencyKey: 'key-1', expectedVersion: 1
      })).rejects.toThrow(ConflictException);
    });

    it('rejects editing cancelled or archived events', async () => {
      vi.mocked(tx.limit).mockResolvedValueOnce([]); 
      vi.mocked(tx.query.events.findFirst).mockResolvedValueOnce({
        id: 'event-1', status: 'cancelled', version: 1
      });

      await expect(service.updateEvent('prop-1', 'event-1', 'actor-1', {
        idempotencyKey: 'key-1', expectedVersion: 1
      })).rejects.toThrow(ConflictException);
    });
  });
});
