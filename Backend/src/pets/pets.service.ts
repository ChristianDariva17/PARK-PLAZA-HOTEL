import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, desc, and } from 'drizzle-orm';
import { Database, DATABASE } from '../database/database.module.js';
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
      await this.assertLinks(tx, actor.propertyId, data.clientId, data.stayId);
      const existing = (await tx.select().from(pets).where(and(eq(pets.id, data.id), eq(pets.propertyId, actor.propertyId))).limit(1).for('update', { of: pets }))[0];
      if (existing) {
        const shouldBeCharged = data.stayId !== null && data.charge > 0;
        if (existing.stayId === data.stayId && existing.clientId === data.clientId && existing.charge === data.charge.toFixed(2) && existing.chargeApplied === shouldBeCharged) {
          if (shouldBeCharged && existing.chargeId) {
            await this.folios.assertAncillaryChargeReference(tx, actor, { stayId: data.stayId!, sourceType: 'pet_charge', sourceId: data.id, amount: data.charge.toFixed(2), chargeId: existing.chargeId });
            return existing;
          }
          if (!shouldBeCharged && !existing.chargeId) return existing;
        }
        throw new ConflictException('Pet creation replay conflicts with the recorded pet');
      }
      const chargeApplied = data.stayId !== null && data.charge > 0;
      const chargeId = chargeApplied ? (await this.folios.appendAncillaryChargeLocked(tx, actor, { stayId: data.stayId!, sourceType: 'pet_charge', sourceId: data.id, amount: data.charge.toFixed(2), reason: 'Pet lodging charge' }, context)).id : null;
      const [pet] = await tx.insert(pets).values({
      id: data.id,
      propertyId: actor.propertyId,
      stayId: data.stayId || null,
      clientId: data.clientId,
      name: data.name,
      type: data.type,
      size: data.size,
      lodgingPlace: data.lodgingPlace,
      charge: data.charge.toFixed(2),
      chargeId,
      chargeApplied,
      notes: data.notes || null,
      damageIncidentId: data.damageIncidentId || null,
      status: 'Activa',
    }).returning();
      return pet;
    });
  }

  async update(id: string, propertyId: string, payload: UpdatePetDto) {
    const current = await this.db.query.pets.findFirst({
      where: and(eq(pets.id, id), eq(pets.propertyId, propertyId)),
    });
    if (!current) throw new NotFoundException('Mascota no encontrada');
    await this.assertLinks(this.db, propertyId, payload.clientId ?? current.clientId, payload.stayId === undefined ? current.stayId : payload.stayId);
    const [updated] = await this.db.update(pets)
      .set({
        ...payload,
        charge: payload.charge !== undefined ? payload.charge.toFixed(2) : undefined,
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

  private async assertLinks(executor: Pick<Database, 'select'>, propertyId: string, clientId: string, stayId: string | null) {
    const guestRows = await executor.select({ id: guests.id }).from(guests)
      .where(and(eq(guests.id, clientId), eq(guests.propertyId, propertyId))).limit(1);
    if (!guestRows[0]) throw new BadRequestException('El cliente debe pertenecer a la propiedad autenticada');
    if (!stayId) return;
    const [stayRows, linkedGuestRows] = await Promise.all([
      executor.select({ id: stays.id }).from(stays)
        .where(and(eq(stays.id, stayId), eq(stays.propertyId, propertyId))).limit(1),
      executor.select({ guestId: stayGuests.guestId }).from(stayGuests)
        .where(and(eq(stayGuests.stayId, stayId), eq(stayGuests.guestId, clientId), eq(stayGuests.propertyId, propertyId))).limit(1),
    ]);
    if (!stayRows[0] || !linkedGuestRows[0]) {
      throw new BadRequestException('La estadía y el cliente deben estar vinculados en la propiedad autenticada');
    }
  }
}
