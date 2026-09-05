import { Inject, Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { eq, desc, and, or, ne } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { vehicleRegistrations } from '../database/schema/parking.schema.js';
import { guests } from '../database/schema/guests.schema.js';
import { rooms } from '../database/schema/hotel.schema.js';
import { stayGuests, stays } from '../database/schema/stays.schema.js';
import type { CreateParkingDto, ExitParkingDto, UpdateParkingDto } from './parking.dto.js';
import type { AuthenticatedAccount, RequestContext } from '../auth/auth.types.js';
import { FolioService } from '../folios/folio.service.js';
import { acquirePropertyTransactionLock } from '../database/transaction-policy.js';

@Injectable()
export class ParkingService {
  constructor(@Inject(DATABASE) private readonly db: Database, private readonly folios: FolioService) {}

  async findAll(propertyId: string) {
    return this.db.query.vehicleRegistrations.findMany({
      where: eq(vehicleRegistrations.propertyId, propertyId),
      orderBy: [desc(vehicleRegistrations.entryAt)],
    });
  }

  async create(actor: AuthenticatedAccount, data: CreateParkingDto, context: RequestContext) {
    return await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);
      if (data.stayId) {
        await this.assertLinks(tx, actor.propertyId, data);
        const [stay] = await tx.select({ status: stays.status }).from(stays)
          .where(and(eq(stays.id, data.stayId), eq(stays.propertyId, actor.propertyId))).limit(1);
        if (!stay || !['active', 'Activa'].includes(stay.status)) throw new BadRequestException('Seleccione una estadía activa.');
      }
      const existing = await tx.query.vehicleRegistrations.findFirst({
        where: and(
          eq(vehicleRegistrations.propertyId, actor.propertyId),
          eq(vehicleRegistrations.status, 'Dentro'),
          or(eq(vehicleRegistrations.plate, data.plate), eq(vehicleRegistrations.space, data.space))
        )
      });
      if (existing) throw new BadRequestException(`El vehículo con placa ${data.plate} o el espacio ${data.space} ya se encuentra ocupado.`);
      const chargeId = (data.stayId && data.fee > 0)
        ? (await this.folios.appendAncillaryChargeLocked(tx, actor, { stayId: data.stayId, sourceType: 'parking_entry', sourceId: data.id, amount: data.fee.toString(), reason: 'Parking entry' }, context)).id
        : null;
      const [vehicle] = await tx.insert(vehicleRegistrations).values({
        id: data.id,
        propertyId: actor.propertyId,
        stayId: data.stayId || null,
        clientId: data.clientId || null,
        roomId: data.roomId || null,
        originType: data.originType || 'stay',
        driverName: data.driverName || null,
        driverPhone: data.driverPhone || null,
        vehicleColor: data.vehicleColor || null,
        keysLeft: Boolean(data.keysLeft),
        entryNotes: data.entryNotes || null,
        plate: data.plate,
        space: data.space,
        fee: data.fee.toString(),
        vehicleType: data.vehicleType,
        brandModel: data.brandModel || null,
        entryResponsible: data.entryResponsible,
        status: 'Dentro',
        chargeId,
      }).returning();
      return vehicle;
    });
  }

  async update(id: string, propertyId: string, payload: UpdateParkingDto) {
    const current = await this.db.query.vehicleRegistrations.findFirst({
      where: and(eq(vehicleRegistrations.id, id), eq(vehicleRegistrations.propertyId, propertyId)),
    });
    if (!current) throw new NotFoundException('Vehículo no encontrado');
    const targetStayId = payload.stayId !== undefined ? payload.stayId : current.stayId;
    if (targetStayId) {
      await this.assertLinks(this.db, propertyId, {
        stayId: targetStayId,
        clientId: payload.clientId !== undefined ? payload.clientId : current.clientId,
        roomId: payload.roomId !== undefined ? payload.roomId : current.roomId,
      });
    }
    const targetPlate = payload.plate ?? current.plate;
    const targetSpace = payload.space ?? current.space;
    if (current.status === 'Dentro' && (payload.plate || payload.space)) {
      const existing = await this.db.query.vehicleRegistrations.findFirst({
        where: and(
          eq(vehicleRegistrations.propertyId, propertyId),
          eq(vehicleRegistrations.status, 'Dentro'),
          ne(vehicleRegistrations.id, id),
          or(eq(vehicleRegistrations.plate, targetPlate), eq(vehicleRegistrations.space, targetSpace))
        ),
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`El vehículo con placa ${targetPlate} o el espacio ${targetSpace} ya se encuentra ocupado.`);
      }
    }
    const [updated] = await this.db.update(vehicleRegistrations)
      .set({
        ...payload,
        fee: payload.fee !== undefined ? payload.fee.toString() : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(vehicleRegistrations.id, id), eq(vehicleRegistrations.propertyId, propertyId)))
      .returning();

    if (!updated) throw new NotFoundException('Vehículo no encontrado');
    return updated;
  }

  async exit(id: string, actor: AuthenticatedAccount, data: ExitParkingDto, context: RequestContext) {
    return await this.db.transaction(async (tx) => {
      await acquirePropertyTransactionLock(tx, actor.propertyId);
      const vehicle = (await tx.select().from(vehicleRegistrations).where(and(eq(vehicleRegistrations.id, id), eq(vehicleRegistrations.propertyId, actor.propertyId))).limit(1).for('update', { of: vehicleRegistrations }))[0];
      if (!vehicle) throw new NotFoundException('Vehículo no encontrado');
      if (vehicle.status === 'Fuera') {
        if (Number(vehicle.fee) <= 0 && !vehicle.chargeId) return vehicle;
        if (!vehicle.chargeId) throw new ConflictException('Parking exit has no canonical ancillary charge');
        await this.folios.assertParkingChargeReference(tx, actor, { stayId: vehicle.stayId!, sourceId: vehicle.id, amount: vehicle.fee, chargeId: vehicle.chargeId });
        return vehicle;
      }
      if (vehicle.status !== 'Dentro') throw new ConflictException('Vehicle cannot exit from its current status');
      const chargeId = vehicle.chargeId;

      const [updated] = await tx.update(vehicleRegistrations).set({
        status: 'Fuera',
        exitAt: new Date(),
        exitResponsible: data.exitResponsible,
        exitObservation: data.exitObservation || null,
        chargeId,
        updatedAt: new Date(),
      })
      .where(and(eq(vehicleRegistrations.id, id), eq(vehicleRegistrations.propertyId, actor.propertyId)))
      .returning();

      if (!updated) throw new NotFoundException('Vehículo no encontrado');
      return updated;
    });
  }

  async archive(id: string, propertyId: string, reason: string) {
    const [archived] = await this.db.update(vehicleRegistrations).set({
      status: 'Archivado',
      archivedAt: new Date(),
      archiveReason: reason,
      updatedAt: new Date(),
    })
    .where(and(eq(vehicleRegistrations.id, id), eq(vehicleRegistrations.propertyId, propertyId)))
    .returning();

    if (!archived) throw new NotFoundException('Vehículo no encontrado');
    return archived;
  }

  private async assertLinks(
    executor: Pick<Database, 'select'>,
    propertyId: string,
    data: { stayId?: string | null; clientId?: string | null; roomId?: string | null },
  ) {
    if (!data.stayId || !data.clientId || !data.roomId) return;
    const [stayRows, guestRows, roomRows, linkedGuestRows] = await Promise.all([
      executor.select({ id: stays.id, roomId: stays.roomId }).from(stays)
        .where(and(eq(stays.id, data.stayId), eq(stays.propertyId, propertyId))).limit(1),
      executor.select({ id: guests.id }).from(guests)
        .where(and(eq(guests.id, data.clientId), eq(guests.propertyId, propertyId))).limit(1),
      executor.select({ id: rooms.id }).from(rooms)
        .where(and(eq(rooms.id, data.roomId), eq(rooms.propertyId, propertyId))).limit(1),
      executor.select({ guestId: stayGuests.guestId }).from(stayGuests)
        .where(and(eq(stayGuests.stayId, data.stayId), eq(stayGuests.guestId, data.clientId), eq(stayGuests.propertyId, propertyId))).limit(1),
    ]);
    if (!stayRows[0] || !guestRows[0] || !roomRows[0] || !linkedGuestRows[0] || stayRows[0].roomId !== data.roomId) {
      throw new BadRequestException('La estadía, el cliente y la habitación deben pertenecer a la propiedad autenticada');
    }
  }
}
