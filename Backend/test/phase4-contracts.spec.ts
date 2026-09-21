import 'reflect-metadata';
import { BadRequestException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ExperiencesController } from '../src/experiences/experiences.controller.js';
import { DocumentsController } from '../src/documents/documents.controller.js';
import { CreateContractDto, LinkEvidenceDto, RegisterEvidenceDto, TransitionContractDto } from '../src/documents/documents.dto.js';
import { EventsController } from '../src/events/events.controller.js';
import { CreateExperienceDto, CreateParticipationDto } from '../src/experiences/experiences.dto.js';
import { SuppliersController } from '../src/suppliers/suppliers.controller.js';
import { AttendanceController } from '../src/attendance/attendance.controller.js';
import { REQUIRED_PERMISSIONS } from '../src/auth/decorators/require-permissions.decorator.js';
import {
  parseReportManualAttendanceDto,
  parseReportQrAttendanceDto,
} from '../src/attendance/attendance.dto.js';
import { parseCreateStaffDto } from '../src/staff/staff.dto.js';
import { parseCreateMenuItemDto, parseCreateOrderDto } from '../src/restaurant/restaurant.dto.js';
import { parseCreateSupplierDto } from '../src/suppliers/suppliers.dto.js';
import { replaceSpaceServicesDto } from '../src/events/events.dto.js';

const account = {
  accountId: 'account-id',
  propertyId: 'property-a',
  roleKey: 'administrator',
  email: 'admin@example.com',
  permissions: ['experiences.read'],
  sessionId: 'session-id',
  passwordChangeRequired: false,
};

describe('Phase 4 HTTP contract gates', () => {
  it('keeps corrected routes explicitly bound to their permissions', () => {
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, ExperiencesController.prototype.createExperience))
      .toEqual(['experiences.create']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, ExperiencesController.prototype.listExperiences))
      .toEqual(['experiences.read']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, ExperiencesController.prototype.registerParticipation))
      .toEqual(['experiences.participate']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, ExperiencesController.prototype.updateExperience))
      .toEqual(['experiences.update']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, ExperiencesController.prototype.listParticipations))
      .toEqual(['experiences.read']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, AttendanceController.prototype.reportQrAttendance))
      .toEqual(['staff.attendance.manual']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DocumentsController.prototype.createContract))
      .toEqual(['contracts.amend']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DocumentsController.prototype.transitionContract))
      .toEqual(['contracts.amend']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DocumentsController.prototype.registerEvidence))
      .toEqual(['evidence.manage']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, EventsController.prototype.createEvent))
      .toEqual(['events.create']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, EventsController.prototype.confirmEvent))
      .toEqual(['events.confirm']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, EventsController.prototype.cancelEvent))
      .toEqual(['events.cancel']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DocumentsController.prototype.listContracts))
      .toEqual(['contracts.read']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DocumentsController.prototype.getContract))
      .toEqual(['contracts.read']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DocumentsController.prototype.linkEvidence))
      .toEqual(['evidence.manage']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DocumentsController.prototype.listEvidences))
      .toEqual(['evidence.read']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, DocumentsController.prototype.listAuditEvents))
      .toEqual(['audit.read']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, SuppliersController.prototype.createSupplier))
      .toEqual(['suppliers.create']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, SuppliersController.prototype.updateSupplier))
      .toEqual(['suppliers.update']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, SuppliersController.prototype.archiveSupplier))
      .toEqual(['suppliers.archive']);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, SuppliersController.prototype.reactivateSupplier))
      .toEqual(['suppliers.archive']);
  });

  it('rejects a cross-property route before invoking the domain service', async () => {
    const service = { listExperiences: vi.fn() };
    const controller = new ExperiencesController(service as any);

    await expect(controller.listExperiences('property-b', account, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.listExperiences).not.toHaveBeenCalled();
  });

  it('rejects cross-property experience mutations before invoking the domain service', async () => {
    const service = {
      createExperience: vi.fn(),
      registerParticipation: vi.fn(),
    };
    const controller = new ExperiencesController(service as any);
    const request = {} as any;

    await expect(controller.createExperience('property-b', account, request, {} as any))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.registerParticipation('property-b', 'experience-id', account, request, {} as any))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(service.createExperience).not.toHaveBeenCalled();
    expect(service.registerParticipation).not.toHaveBeenCalled();
  });

  it('passes the authenticated account ID to supplier mutations', async () => {
    const service = { archiveSupplier: vi.fn() };
    const controller = new SuppliersController(service as any);
    const id = '550e8400-e29b-41d4-a716-446655440000';

    await controller.archiveSupplier(account, id, { reason: 'No longer needed', expectedVersion: 1 }, id);
    expect(service.archiveSupplier).toHaveBeenCalledWith(account.propertyId, id, { reason: 'No longer needed', expectedVersion: 1 }, id, account.accountId);
  });

  it('rejects a contract void transition without the explicit void permission', async () => {
    const service = { transitionContract: vi.fn() };
    const controller = new DocumentsController(service as any);
    const limitedAccount = { ...account, permissions: ['contracts.amend'] };
    const request = { id: 'request-id', ip: '127.0.0.1', headers: {} } as any;

    await expect(controller.transitionContract(limitedAccount as any, request, 'contract-id', { targetState: 'VOID' } as any))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(service.transitionContract).not.toHaveBeenCalled();
  });

  it('rejects invalid event commands before invoking the domain service', async () => {
    const service = {
      createEvent: vi.fn(),
      confirmEvent: vi.fn(),
      cancelEvent: vi.fn(),
    };
    const controller = new EventsController(service as any, {} as any);

    await expect(controller.createEvent(account, { spaceId: 'not-a-uuid' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.confirmEvent(account, 'event-id', { expectedVersion: 0, idempotencyKey: '' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.cancelEvent(account, 'event-id', { expectedVersion: 1, idempotencyKey: 'key', reason: '' })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.createEvent).not.toHaveBeenCalled();
    expect(service.confirmEvent).not.toHaveBeenCalled();
    expect(service.cancelEvent).not.toHaveBeenCalled();
  });

  it('preserves event space service presentation metadata in the HTTP contract', () => {
    expect(replaceSpaceServicesDto.parse([{
      code: 'coffee_break',
      name: 'Coffee Break',
      category: 'Gastronomía & Catering',
      unitAmount: 125.5,
      perPerson: false,
    }])).toEqual([{
      code: 'coffee_break',
      name: 'Coffee Break',
      category: 'Gastronomía & Catering',
      unitAmount: 125.5,
      perPerson: false,
      active: true,
    }]);

    expect(replaceSpaceServicesDto.parse([{
      code: 'projector',
      name: 'Proyector',
      unitAmount: 100,
    }])[0]).toMatchObject({
      category: 'General',
      perPerson: false,
      active: true,
    });
  });

  it.each([
    ['manual attendance', parseReportManualAttendanceDto, { staffId: 'not-a-uuid' }],
    ['QR attendance', parseReportQrAttendanceDto, { qrToken: 'too-short', latitude: 0, longitude: 0, idempotencyKey: 'not-a-uuid' }],
    ['staff', parseCreateStaffDto, { firstName: '', lastName: 'Invalid', documentNormalized: 'x', unexpected: true }],
    ['menu', parseCreateMenuItemDto, { name: 'x', category: 'food', salePrice: 10, unexpected: true }],
    ['restaurant order', parseCreateOrderDto, { source: 'staff', items: [], unexpected: true }],
    ['supplier', parseCreateSupplierDto, { legalName: 'x', taxId: 'not-a-ruc', unexpected: true }],
  ])('maps invalid %s input to HTTP 400', (_name, parse, input) => {
    expect(() => parse(input)).toThrow(BadRequestException);
  });

  it('maps class-validator document failures to HTTP 400', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

    await expect(pipe.transform(
      { targetState: 'INVALID', idempotencyKey: 'not-a-uuid', unexpected: true },
      { type: 'body', metatype: TransitionContractDto },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['experience', CreateExperienceDto, { name: 'x', type: 'INVALID', requiresReservation: 'yes', price: -1 }],
    ['experience participation', CreateParticipationDto, { stayId: 'not-a-uuid', pax: 0, idempotencyKey: 'not-a-uuid' }],
    ['contract', CreateContractDto, { idempotencyKey: 'not-a-uuid' }],
    ['evidence', RegisterEvidenceDto, { sourceType: 'INVALID', referenceId: 'not-a-uuid', evidenceType: '', description: '', idempotencyKey: 'not-a-uuid' }],
  ])('maps invalid %s DTOs to HTTP 400', async (_name, metatype, input) => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

    await expect(pipe.transform(input, { type: 'body', metatype })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['evidence URL', RegisterEvidenceDto, { sourceType: 'CONTRACTS', evidenceType: 'document', referenceId: '550e8400-e29b-41d4-a716-446655440000', description: 'Evidence', url: 'not-a-url', idempotencyKey: '550e8400-e29b-41d4-a716-446655440001' }],
    ['evidence relation type', LinkEvidenceDto, { evidenceId: '550e8400-e29b-41d4-a716-446655440000', relationType: 'invalid relation', idempotencyKey: '550e8400-e29b-41d4-a716-446655440001' }],
  ])('rejects invalid %s with HTTP 400', async (_name, metatype, input) => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

    await expect(pipe.transform(input, { type: 'body', metatype })).rejects.toBeInstanceOf(BadRequestException);
  });
});
