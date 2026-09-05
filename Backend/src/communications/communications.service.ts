import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DATABASE, Database } from '../database/database.module.js';
import { notifications, communicationPreferences } from '../database/schema/communications.schema.js';
import { auditEvents } from '../database/schema/security.schema.js';
import { eq, and, desc, or } from 'drizzle-orm';
import { UpdatePreferenceDto, ListNotificationsQueryDto } from './communications.dto.js';

export interface RequestContext {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class CommunicationsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async updatePreference(propertyId: string, accountId: string, dto: UpdatePreferenceDto, ctx: RequestContext) {
    const { channel, purpose, optIn, consentVersion } = dto;

    return await this.db.transaction(async (tx: any) => {
      let pref = await tx.query.communicationPreferences.findFirst({
        where: and(
          eq(communicationPreferences.propertyId, propertyId),
          eq(communicationPreferences.accountId, accountId),
          eq(communicationPreferences.channel, channel),
          eq(communicationPreferences.purpose, purpose)
        )
      });

      if (pref) {
        [pref] = await tx.update(communicationPreferences)
          .set({ optIn, consentVersion, updatedAt: new Date() })
          .where(eq(communicationPreferences.id, pref.id))
          .returning();
      } else {
        [pref] = await tx.insert(communicationPreferences).values({
          propertyId,
          accountId,
          channel,
          purpose,
          optIn,
          consentVersion
        }).returning();
      }

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'communication.preference_updated',
        subjectType: 'preference',
        subjectId: pref.id,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { channel, purpose, optIn }
      });

      return pref;
    });
  }

  async listPreferences(propertyId: string, accountId: string) {
    return this.db.query.communicationPreferences.findMany({
      where: and(
        eq(communicationPreferences.propertyId, propertyId),
        eq(communicationPreferences.accountId, accountId)
      )
    });
  }

  async listNotifications(propertyId: string, accountId: string, roleKey: string, query: ListNotificationsQueryDto) {
    const limit = query.limit || 100;
    const page = query.page || 1;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(notifications.propertyId, propertyId),
      or(
        eq(notifications.targetAccountId, accountId),
        eq(notifications.targetRole, roleKey)
      )
    ];

    if (query.unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const records = await this.db.query.notifications.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(notifications.createdAt)]
    });

    return records.map((notification) => {
      const meta = (notification.metadata || {}) as Record<string, any>;
      const humanFormatted = this.formatLegacyNotification(notification.title, notification.content, meta);

      return {
        ...notification,
        title: humanFormatted.title,
        description: humanFormatted.description,
        route: humanFormatted.route,
        read: notification.isRead,
        department: meta.department || humanFormatted.department,
        priority: meta.priority || humanFormatted.priority,
      };
    });
  }

  async markNotificationRead(propertyId: string, accountId: string, roleKey: string, notificationId: string, isRead: boolean, ctx: RequestContext) {
    const notification = await this.db.query.notifications.findFirst({
      where: and(
        eq(notifications.propertyId, propertyId),
        eq(notifications.id, notificationId),
        or(
          eq(notifications.targetAccountId, accountId),
          eq(notifications.targetRole, roleKey)
        )
      )
    });

    if (!notification) throw new NotFoundException('Notificación no encontrada o no autorizada');

    return await this.db.transaction(async (tx: any) => {
      const [updated] = await tx.update(notifications)
        .set({ isRead, readAt: isRead ? new Date() : null })
        .where(eq(notifications.id, notificationId))
        .returning();

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: isRead ? 'notification.read' : 'notification.unread',
        subjectType: 'notification',
        subjectId: notificationId,
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { roleKey }
      });

      return updated;
    });
  }

  async markAllNotificationsRead(propertyId: string, accountId: string, roleKey: string, ctx: RequestContext) {
    return await this.db.transaction(async (tx: any) => {
      const updated = await tx.update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(notifications.propertyId, propertyId),
            eq(notifications.isRead, false),
            or(
              eq(notifications.targetAccountId, accountId),
              eq(notifications.targetRole, roleKey)
            )
          )
        )
        .returning();

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'notification.read_all',
        subjectType: 'notifications',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { count: updated.length }
      });

      return { count: updated.length, success: true };
    });
  }

  async clearReadNotifications(propertyId: string, accountId: string, roleKey: string, ctx: RequestContext) {
    return await this.db.transaction(async (tx: any) => {
      const deleted = await tx.delete(notifications)
        .where(
          and(
            eq(notifications.propertyId, propertyId),
            eq(notifications.isRead, true),
            or(
              eq(notifications.targetAccountId, accountId),
              eq(notifications.targetRole, roleKey)
            )
          )
        )
        .returning();

      await tx.insert(auditEvents).values({
        propertyId,
        actorAccountId: accountId,
        eventType: 'notification.clear_read',
        subjectType: 'notifications',
        requestId: ctx.requestId,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        metadata: { count: deleted.length }
      });

      return { count: deleted.length, success: true };
    });
  }

  // Translates older raw event notifications like `cleaning.progressed` into elegant human titles
  private formatLegacyNotification(rawTitle: string, rawContent: string, meta: Record<string, any>) {
    const titleLower = (rawTitle || '').toLowerCase();
    
    if (titleLower.startsWith('cleaning.')) {
      if (titleLower.includes('created')) {
        return {
          title: '🧹 Nueva Tarea de Limpieza Programada',
          description: 'Se generó una asignación de limpieza de habitación.',
          route: 'limpieza',
          department: 'housekeeping',
          priority: 'MEDIUM',
        };
      }
      if (titleLower.includes('progressed')) {
        return {
          title: '🧼 Avance en Limpieza de Habitación',
          description: 'Personal de housekeeping registró progreso en el aseo de habitación.',
          route: 'limpieza',
          department: 'housekeeping',
          priority: 'INFO',
        };
      }
      return {
        title: '🧹 Tarea de Limpieza Actualizada',
        description: 'Actualización en el estado de limpieza y mantenimiento de habitaciones.',
        route: 'limpieza',
        department: 'housekeeping',
        priority: 'INFO',
      };
    }

    if (titleLower.startsWith('auth.login')) {
      return {
        title: '🔒 Inicio de Sesión en el Sistema',
        description: 'Acceso autenticado exitosamente al panel operativo del hotel.',
        route: 'auditoria',
        department: 'security',
        priority: 'INFO',
      };
    }

    if (titleLower.startsWith('orders.') || titleLower.startsWith('kitchen.')) {
      return {
        title: '🍽️ Comanda de Cocina / Bar',
        description: 'Movimiento o actualización en pedidos de alimentos y bebidas.',
        route: 'cocina-bar',
        department: 'restaurant',
        priority: 'HIGH',
      };
    }

    if (titleLower.startsWith('reservations.') || titleLower.startsWith('stays.')) {
      return {
        title: '🛎️ Gestión de Reservas y Huéspedes',
        description: 'Registro operativo en el módulo de recepción y reservas.',
        route: 'reservas',
        department: 'frontdesk',
        priority: 'MEDIUM',
      };
    }

    if (titleLower.startsWith('suppliers.') || titleLower.startsWith('purchase_orders.')) {
      return {
        title: '📋 Órdenes de Compra & Proveedores',
        description: 'Gestión y abastecimiento de insumos para el hotel.',
        route: 'proveedores',
        department: 'purchases',
        priority: 'MEDIUM',
      };
    }

    if (titleLower.startsWith('events.')) {
      return {
        title: '💍 Gestión de Eventos & Salones',
        description: 'Actualización en la agenda de banquetes y eventos especiales.',
        route: 'eventos',
        department: 'events',
        priority: 'MEDIUM',
      };
    }

    // Default
    return {
      title: rawTitle,
      description: rawContent,
      route: 'dashboard',
      department: 'general',
      priority: 'INFO',
    };
  }
}
