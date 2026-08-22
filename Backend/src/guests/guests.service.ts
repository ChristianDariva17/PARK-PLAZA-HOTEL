import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { DATABASE, type Database } from '../database/database.module.js';
import { getPostgresErrorFields } from '../database/postgres-error.js';
import { guests, identityDocuments } from '../database/schema/index.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';
import type { CreateGuestDto, UpdateGuestDto } from './guests.dto.js';

const guestSelection = {
  id: guests.id,
  firstName: guests.firstName,
  lastName: guests.lastName,
  birthDate: guests.birthDate,
  nationality: guests.nationality,
  email: guests.email,
  phone: guests.phone,
  address: guests.address,
  emergencyContact: guests.emergencyContact,
  notes: guests.notes,
  status: guests.status,
  createdAt: guests.createdAt,
  updatedAt: guests.updatedAt,
  documentId: identityDocuments.id,
  documentType: identityDocuments.type,
  issuingCountry: identityDocuments.issuingCountry,
  documentNumber: identityDocuments.documentNumber,
  documentExpiresOn: identityDocuments.expiresOn,
  documentCreatedAt: identityDocuments.createdAt,
};

const guestReturning = {
  id: guests.id,
  firstName: guests.firstName,
  lastName: guests.lastName,
  birthDate: guests.birthDate,
  nationality: guests.nationality,
  email: guests.email,
  phone: guests.phone,
  address: guests.address,
  emergencyContact: guests.emergencyContact,
  notes: guests.notes,
  status: guests.status,
  createdAt: guests.createdAt,
  updatedAt: guests.updatedAt,
};

const documentReturning = {
  id: identityDocuments.id,
  type: identityDocuments.type,
  issuingCountry: identityDocuments.issuingCountry,
  documentNumber: identityDocuments.documentNumber,
  expiresOn: identityDocuments.expiresOn,
  createdAt: identityDocuments.createdAt,
};

type GuestRow = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergencyContact: string | null;
  notes: string | null;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  documentId: string;
  documentType: 'dni' | 'passport' | 'foreign_id' | 'other';
  issuingCountry: string;
  documentNumber: string;
  documentExpiresOn: string | null;
  documentCreatedAt: Date;
};

export interface GuestResponse {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergencyContact: string | null;
  notes: string | null;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  primaryDocument: {
    id: string;
    type: 'dni' | 'passport' | 'foreign_id' | 'other';
    issuingCountry: string;
    documentNumber: string;
    expiresOn: string | null;
    createdAt: Date;
  };
}

@Injectable()
export class GuestsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  async list(propertyId: string): Promise<GuestResponse[]> {
    const rows = await this.database.select(guestSelection).from(guests).innerJoin(
      identityDocuments,
      and(eq(identityDocuments.guestId, guests.id), eq(identityDocuments.propertyId, guests.propertyId), eq(identityDocuments.isPrimary, true)),
    ).where(eq(guests.propertyId, propertyId)).orderBy(asc(guests.lastName), asc(guests.firstName), asc(guests.id));
    return rows.map((row) => this.toResponse(row));
  }

  async create(actor: AuthenticatedAccount, input: CreateGuestDto, context: RequestContext): Promise<GuestResponse> {
    try {
      return await this.database.transaction(async (tx) => {
        await acquirePropertyTransactionLock(tx, actor.propertyId);
        const guestRows = await tx.insert(guests).values({
          propertyId: actor.propertyId,
          firstName: input.firstName,
          lastName: input.lastName,
          birthDate: input.birthDate ?? null,
          nationality: input.nationality ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          emergencyContact: input.emergencyContact ?? null,
          notes: input.notes ?? null,
        }).returning(guestReturning);
        const guest = guestRows[0]!;
        const documentRows = await tx.insert(identityDocuments).values({
          guestId: guest.id,
          propertyId: actor.propertyId,
          type: input.primaryDocument.type,
          issuingCountry: input.primaryDocument.issuingCountry,
          documentNumber: input.primaryDocument.documentNumber,
          expiresOn: input.primaryDocument.expiresOn ?? null,
          isPrimary: true,
        }).returning(documentReturning);
        const document = documentRows[0]!;
        await this.audit.record({
          ...this.auditBase(actor, context),
          eventType: 'guest.created',
          subjectType: 'guest',
          subjectId: guest.id,
          metadata: { documentType: document.type, issuingCountry: document.issuingCountry },
        }, tx);
        return this.toResponse({
          ...guest,
          documentId: document.id,
          documentType: document.type,
          issuingCountry: document.issuingCountry,
          documentNumber: document.documentNumber,
          documentExpiresOn: document.expiresOn,
          documentCreatedAt: document.createdAt,
        });
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  async update(actor: AuthenticatedAccount, guestId: string, input: UpdateGuestDto, context: RequestContext): Promise<GuestResponse> {
    try {
      return await this.database.transaction(async (tx) => {
        await acquirePropertyTransactionLock(tx, actor.propertyId);
        const rows = await tx.select(guestSelection).from(guests).innerJoin(
          identityDocuments,
          and(eq(identityDocuments.guestId, guests.id), eq(identityDocuments.propertyId, guests.propertyId), eq(identityDocuments.isPrimary, true)),
        ).where(and(eq(guests.id, guestId), eq(guests.propertyId, actor.propertyId))).limit(1).for('update');
        const current = rows[0];
        if (!current) throw new NotFoundException('Guest not found');
        if (current.status !== 'active') throw new BadRequestException('Archived guest cannot be updated');

        const guestChanges = this.changedGuestFields(current, input);
        const documentChanges = this.changedDocumentFields(current, input.primaryDocument);
        const changedFields = [...Object.keys(guestChanges), ...Object.keys(documentChanges).map((field) => `primaryDocument.${field}`)];
        if (changedFields.length === 0) return this.toResponse(current);

        const now = new Date();
        await tx.update(guests).set({ ...guestChanges, updatedAt: now }).where(and(eq(guests.id, guestId), eq(guests.propertyId, actor.propertyId)));
        if (Object.keys(documentChanges).length > 0) {
          await tx.update(identityDocuments).set(documentChanges).where(and(
            eq(identityDocuments.id, current.documentId),
            eq(identityDocuments.guestId, guestId),
            eq(identityDocuments.propertyId, actor.propertyId),
            eq(identityDocuments.isPrimary, true),
          ));
        }
        await this.audit.record({
          ...this.auditBase(actor, context),
          eventType: 'guest.updated',
          subjectType: 'guest',
          subjectId: guestId,
          metadata: {
            fields: changedFields,
            ...(Object.keys(documentChanges).length > 0 ? {
              documentType: documentChanges.type ?? current.documentType,
              issuingCountry: documentChanges.issuingCountry ?? current.issuingCountry,
            } : {}),
          },
        }, tx);
        return this.toResponse({
          ...current,
          ...guestChanges,
          updatedAt: now,
          documentType: documentChanges.type ?? current.documentType,
          issuingCountry: documentChanges.issuingCountry ?? current.issuingCountry,
          documentNumber: documentChanges.documentNumber ?? current.documentNumber,
          documentExpiresOn: documentChanges.expiresOn === undefined ? current.documentExpiresOn : documentChanges.expiresOn,
        });
      });
    } catch (error) {
      this.rethrowConstraint(error);
    }
  }

  private changedGuestFields(current: GuestRow, input: UpdateGuestDto) {
    const changes: Partial<Pick<GuestRow, 'firstName' | 'lastName' | 'birthDate' | 'nationality' | 'email' | 'phone' | 'address' | 'emergencyContact' | 'notes'>> = {};
    if (input.firstName !== undefined && input.firstName !== current.firstName) changes.firstName = input.firstName;
    if (input.lastName !== undefined && input.lastName !== current.lastName) changes.lastName = input.lastName;
    if (input.birthDate !== undefined && input.birthDate !== current.birthDate) changes.birthDate = input.birthDate;
    if (input.nationality !== undefined && input.nationality !== current.nationality) changes.nationality = input.nationality;
    if (input.email !== undefined && input.email !== current.email) changes.email = input.email;
    if (input.phone !== undefined && input.phone !== current.phone) changes.phone = input.phone;
    if (input.address !== undefined && input.address !== current.address) changes.address = input.address;
    if (input.emergencyContact !== undefined && input.emergencyContact !== current.emergencyContact) changes.emergencyContact = input.emergencyContact;
    if (input.notes !== undefined && input.notes !== current.notes) changes.notes = input.notes;
    return changes;
  }

  private changedDocumentFields(current: GuestRow, input: UpdateGuestDto['primaryDocument']) {
    const changes: Partial<{ type: GuestRow['documentType']; issuingCountry: string; documentNumber: string; expiresOn: string | null }> = {};
    if (!input) return changes;
    if (input.type !== undefined && input.type !== current.documentType) changes.type = input.type;
    if (input.issuingCountry !== undefined && input.issuingCountry !== current.issuingCountry) changes.issuingCountry = input.issuingCountry;
    if (input.documentNumber !== undefined && input.documentNumber !== current.documentNumber) changes.documentNumber = input.documentNumber;
    if (input.expiresOn !== undefined && input.expiresOn !== current.documentExpiresOn) changes.expiresOn = input.expiresOn;
    return changes;
  }

  private toResponse(row: GuestRow): GuestResponse {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      birthDate: row.birthDate,
      nationality: row.nationality,
      email: row.email,
      phone: row.phone,
      address: row.address,
      emergencyContact: row.emergencyContact,
      notes: row.notes,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      primaryDocument: {
        id: row.documentId,
        type: row.documentType,
        issuingCountry: row.issuingCountry,
        documentNumber: row.documentNumber,
        expiresOn: row.documentExpiresOn,
        createdAt: row.documentCreatedAt,
      },
    };
  }

  private auditBase(actor: AuthenticatedAccount, context: RequestContext) {
    return {
      actorAccountId: actor.accountId,
      propertyId: actor.propertyId,
      ...(context.requestId ? { requestId: context.requestId } : {}),
      ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
      ...(context.userAgent ? { userAgent: context.userAgent } : {}),
    };
  }

  private rethrowConstraint(error: unknown): never {
    const postgresError = getPostgresErrorFields(error);
    if (postgresError?.code === '23505' && postgresError.constraint === 'identity_documents_property_document_unique') {
      throw new ConflictException('Identity document is already in use');
    }
    throw error;
  }
}
