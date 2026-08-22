import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, desc, and, or } from 'drizzle-orm';
import { Database, DATABASE } from '../database/database.module.js';
import { vehicleRegistrations } from '../database/schema/parking.schema.js';
import { guests } from '../database/schema/guests.schema.js';
import { rooms } from '../database/schema/hotel.schema.js';
import { stayGuests, stays } from '../database/schema/stays.schema.js';
import type { CreateParkingDto, ExitParkingDto, UpdateParkingDto } from './parking.dto.js';

@Injectable()
export class ParkingService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findAll(propertyId: string) {
    return this.db.query.vehicleRegistrations.findMany({
      where: eq(vehicleRegistrations.propertyId, propertyId),
      orderBy: [desc(vehicleRegistrations.entryAt)],
    });
  }

  async create(propertyId: string, data: CreateParkingDto) {
    await this.assertLinks(this.db, propertyId, data);
    const existing = await this.db.query.vehicleRegistrations.findFirst({
      where: and(
        eq(vehicleRegistrations.propertyId, propertyId),
        eq(vehicleRegistrations.status, 'Dentro'),
        or(
          eq(vehicleRegistrations.plate, data.plate),
          eq(vehicleRegistrations.space, data.space)
        )
      )
    });

    if (existing) {
      throw new BadRequestException(`El vehículo con placa ${data.plate} o el espacio ${data.space} ya se encuentra ocupado.`);
    }

    const [vehicle] = await this.db.insert(vehicleRegistrations).values({
      id: data.id,
      propertyId,
      stayId: data.stayId,
      clientId: data.clientId,
      roomId: data.roomId,
      plate: data.plate,
      space: data.space,
      fee: data.fee.toString(),
      vehicleType: data.vehicleType,
      brandModel: data.brandModel,
      entryResponsible: data.entryResponsible,
      status: 'Dentro',
    }).returning();
    return vehicle;
  }

  async update(id: string, propertyId: string, payload: UpdateParkingDto) {
    const current = await this.db.query.vehicleRegistrations.findFirst({
      where: and(eq(vehicleRegistrations.id, id), eq(vehicleRegistrations.propertyId, propertyId)),
    });
    if (!current) throw new NotFoundException('Vehículo no encontrado');
    await this.assertLinks(this.db, propertyId, {
      stayId: payload.stayId ?? current.stayId,
      clientId: payload.clientId ?? current.clientId,
      roomId: payload.roomId ?? current.roomId,
    });
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

  async exit(id: string, propertyId: string, data: ExitParkingDto) {
    return await this.db.transaction(async (tx) => {
      const vehicle = await tx.query.vehicleRegistrations.findFirst({
        where: and(eq(vehicleRegistrations.id, id), eq(vehicleRegistrations.propertyId, propertyId))
      });
      if (!vehicle) throw new NotFoundException('Vehículo no encontrado');

      let chargeId = null;
      if (Number(vehicle.fee) > 0) {
        chargeId = `CAR-${vehicle.id}`;
      }

      const [updated] = await tx.update(vehicleRegistrations).set({
        status: 'Fuera',
        exitAt: new Date(),
        exitResponsible: data.exitResponsible,
        exitObservation: data.exitObservation || null,
        chargeId,
        updatedAt: new Date(),
      })
      .where(and(eq(vehicleRegistrations.id, id), eq(vehicleRegistrations.propertyId, propertyId)))
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
    data: { stayId: string; clientId: string; roomId: string },
  ) {
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
