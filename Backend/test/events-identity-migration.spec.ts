import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventsIdentityMigrationService } from '../src/events/events-identity-migration.service.js';
import type { AuditService } from '../src/audit/audit.service.js';

describe('EventsIdentityMigrationService', () => {
  let service: EventsIdentityMigrationService;
  let db: any;
  let audit: any;
  let tx: any;

  beforeEach(() => {
    tx = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      execute: vi.fn(),
    };

    db = {
      transaction: vi.fn((cb) => cb(tx)),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
    };

    audit = {
      record: vi.fn(),
    };

    service = new EventsIdentityMigrationService(db as any, audit as any);
  });

  describe('Inventory of legacy events', () => {
    it('returns the inventory grouped by legacy party type', async () => {
      vi.mocked(db.groupBy).mockResolvedValueOnce([
        { legacyPartyType: 'guest', count: 10 },
        { legacyPartyType: 'customerAccount', count: 5 },
        { legacyPartyType: 'both', count: 2 },
        { legacyPartyType: 'neither', count: 1 },
      ] as never);

      const result = await service.getQuarantineInventory('prop-1');
      expect(result).toEqual({
        guest: 10,
        customerAccount: 5,
        both: 2,
        neither: 1,
        total: 18,
      });
    });
  });

  describe('Resolution of quarantine', () => {
    it('resolves a guest identity, auditing the resolution and setting it as resolved', async () => {
      vi.mocked(tx.for).mockResolvedValueOnce([{ id: 'event-1', quarantineStatus: 'pending' }] as never);
      vi.mocked(tx.returning).mockResolvedValueOnce([{ id: 'event-1', quarantineStatus: 'resolved' }] as never);

      await service.resolveIdentity({
        accountId: 'actor-1',
        propertyId: 'prop-1',
      }, 'event-1', 'guest', 'guest-1');

      expect(tx.update).toHaveBeenCalled();
      expect(tx.set).toHaveBeenCalledWith(expect.objectContaining({
        quarantineStatus: 'resolved',
        quarantineResolvedByAccountId: 'actor-1',
        guestId: 'guest-1',
        customerAccountId: null,
      }));
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'event.quarantine_resolved',
        subjectId: 'event-1',
        metadata: { resolutionType: 'guest', selectedId: 'guest-1' },
      }), tx);
    });

    it('rejects resolving an already resolved event', async () => {
      vi.mocked(tx.for).mockResolvedValueOnce([{ id: 'event-1', quarantineStatus: 'resolved' }] as never);

      await expect(service.resolveIdentity(
        { accountId: 'actor-1', propertyId: 'prop-1' },
        'event-1',
        'guest',
        'guest-1'
      )).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects an invalid resolution type', async () => {
      await expect(service.resolveIdentity(
        { accountId: 'actor-1', propertyId: 'prop-1' },
        'event-1',
        'both' as any,
        'guest-1'
      )).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
