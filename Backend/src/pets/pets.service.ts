import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc, and } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { guests } from '../database/schema/guests.schema.js';
import { pets } from '../database/schema/pets.schema.js';
import { stayGuests, stays } from '../database/schema/stays.schema.js';
import type { CreatePetDto, UpdatePetDto } from './pets.dto.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { FolioService } from '../folios/folio.service.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';

@Injectable()
export class PetsService {
  constructor(@Inject(DATABASE) private readonly db: Database, private readonly folios: FolioService) {}

  async findAll(propertyId: string) {
    return this.db.query.pets.findMany({
      where: eq(pets.propertyId, propertyId),
      orderBy: [desc(pets.createdAt)],
    });
  }

  async create(actor: AuthenticatedAccount, data: CreatePetDto, context: RequestContext) {
    return this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);
      const isStay = data.originType === 'stay' && Boolean(data.stayId);
      if (isStay) {
        await this.assertLinks(tx, actor.propertyId, data.clientId!, data.stayId!);
        const folio = await this.folios.read(tx, actor.propertyId, data.stayId!, true);
        if (folio.settlement !== 'open') throw new ConflictException('Stay folio is no longer open');
      }
      const existing = (await tx.select().from(pets).where(and(eq(pets.id, data.id), eq(pets.propertyId, actor.propertyId))).limit(1).for('update', { of: pets }))[0];
      if (existing) {
        const shouldBeCharged = isStay && data.charge > 0;
        if (existing.stayId === (data.stayId || null) && existing.clientId === (data.clientId || null) && existing.charge === data.charge.toFixed(2) && existing.chargeApplied === shouldBeCharged) {
          if (shouldBeCharged && existing.chargeId) {
            await this.folios.assertAncillaryChargeReference(tx, actor, { stayId: data.stayId!, sourceType: 'pet_charge', sourceId: data.id, amount: data.charge.toFixed(2), chargeId: existing.chargeId });
            return existing;
          }
          if (!shouldBeCharged && !existing.chargeId) return existing;
        }
        throw new ConflictException('Pet creation replay conflicts with the recorded pet');
      }
      const chargeApplied = isStay && data.charge > 0;
      const chargeId = chargeApplied
        ? (await this.folios.appendAncillaryChargeLocked(tx, actor, { stayId: data.stayId!, sourceType: 'pet_charge', sourceId: data.id, amount: data.charge.toFixed(2), reason: 'Pet lodging charge' }, context)).id
        : null;

      const [pet] = await tx.insert(pets).values({
        id: data.id,
        propertyId: actor.propertyId,
        stayId: isStay ? data.stayId! : null,
        clientId: data.clientId || null,
        name: data.name,
        type: data.type,
        breed: data.breed || null,
        size: data.size,
        lodgingPlace: data.lodgingPlace,
        charge: data.charge.toFixed(2),
        chargeId,
        chargeApplied,
        notes: data.notes || null,
        damageIncidentId: data.damageIncidentId || null,
        vaccinationVerified: Boolean(data.vaccinationVerified),
        temperament: data.temperament || null,
        emergencyContact: data.emergencyContact || null,
        welcomeKitDelivered: Boolean(data.welcomeKitDelivered),
        originType: data.originType || 'stay',
        ownerName: data.ownerName || null,
        ownerPhone: data.ownerPhone || null,
        status: 'Activa',
      }).returning();
      return pet;
    });
  }

  async update(id: string, propertyId: string, payload: UpdatePetDto) {
    if (['stayId', 'clientId', 'charge'].some((field) => Object.hasOwn(payload, field))) {
      throw new BadRequestException('Pet stay, guest, and charge cannot be changed after creation');
    }
    const current = await this.db.query.pets.findFirst({
      where: and(eq(pets.id, id), eq(pets.propertyId, propertyId)),
    });
    if (!current) throw new NotFoundException('Mascota no encontrada');
    const [updated] = await this.db.update(pets)
      .set({
        ...payload,
        updatedAt: new Date(),
      })
      .where(and(eq(pets.id, id), eq(pets.propertyId, propertyId)))
      .returning();

    if (!updated) throw new NotFoundException('Mascota no encontrada');
    return updated;
  }

  async archive(id: string, propertyId: string, reason: string) {
    const [archived] = await this.db.update(pets)
      .set({
        status: 'Archivada',
        archivedAt: new Date(),
        archiveReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(pets.id, id), eq(pets.propertyId, propertyId)))
      .returning();

    if (!archived) throw new NotFoundException('Mascota no encontrada');
    return archived;
  }

  async reactivate(id: string, propertyId: string, reason: string) {
    const [reactivated] = await this.db.update(pets)
      .set({
        status: 'Activa',
        reactivatedAt: new Date(),
        reactivationReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(pets.id, id), eq(pets.propertyId, propertyId)))
      .returning();

    if (!reactivated) throw new NotFoundException('Mascota no encontrada');
    return reactivated;
  }

  private async assertLinks(executor: Pick<Database, 'select'>, propertyId: string, clientId: string, stayId: string) {
    const guestRows = await executor.select({ id: guests.id }).from(guests)
      .where(and(eq(guests.id, clientId), eq(guests.propertyId, propertyId))).limit(1);
    if (!guestRows[0]) throw new BadRequestException('El cliente debe pertenecer a la propiedad autenticada');
    const [stayRows, linkedGuestRows] = await Promise.all([
      executor.select({ id: stays.id, status: stays.status }).from(stays)
        .where(and(eq(stays.id, stayId), eq(stays.propertyId, propertyId))).limit(1),
      executor.select({ guestId: stayGuests.guestId }).from(stayGuests)
        .where(and(eq(stayGuests.stayId, stayId), eq(stayGuests.guestId, clientId), eq(stayGuests.propertyId, propertyId))).limit(1),
    ]);
    if (!stayRows[0] || !['active', 'Activa'].includes(stayRows[0].status) || !linkedGuestRows[0]) {
      throw new BadRequestException('La estadía activa y el cliente deben estar vinculados en la propiedad autenticada');
    }
  }
}
