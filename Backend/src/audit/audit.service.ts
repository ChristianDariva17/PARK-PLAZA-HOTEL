import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DATABASE } from '../database/database.module.js';
import { auditEvents, notifications } from '../database/schema/index.js';
import type { RequestContext } from '../auth/auth.types.js';
import { OutboxService } from './outbox.service.js';

type AuditEventRow = typeof auditEvents.$inferInsert;

interface AuditInsert {
  values(value: unknown): PromiseLike<unknown>;
}

export interface AuditExecutor {
  insert(table: any): AuditInsert;
}

interface AuditTransactionalExecutor extends AuditExecutor {
  transaction(callback: (executor: AuditExecutor) => Promise<void>): Promise<unknown>;
}

export interface AuditEventInput extends RequestContext {
  eventType: string;
  actorAccountId?: string;
  subjectType?: string;
  subjectId?: string;
  propertyId?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationDetails {
  title: string;
  content: string;
  department: 'frontdesk' | 'housekeeping' | 'restaurant' | 'purchases' | 'maintenance' | 'events' | 'security' | 'general';
  priority: 'HIGH' | 'MEDIUM' | 'INFO';
  route: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(DATABASE) private readonly database: AuditExecutor,
    @Optional() private readonly outbox?: OutboxService,
  ) {}

  async listEvents(propertyId: string, limit: number, offset: number) {
    return (this.database as any).select().from(auditEvents).where(eq(auditEvents.propertyId, propertyId)).orderBy(desc(auditEvents.occurredAt)).limit(limit).offset(offset);
  }

  async record(event: AuditEventInput, executor: AuditExecutor = this.database): Promise<void> {
    if (executor === this.database && typeof (this.database as { transaction?: unknown }).transaction === 'function') {
      await (this.database as AuditTransactionalExecutor).transaction((tx) => this.recordInExecutor(event, tx));
      return;
    }
    await this.recordInExecutor(event, executor);
  }

  async recordMany(events: readonly AuditEventInput[], executor: AuditExecutor = this.database): Promise<void> {
    if (events.length === 0) return;
    if (executor === this.database && typeof (this.database as { transaction?: unknown }).transaction === 'function') {
      await (this.database as AuditTransactionalExecutor).transaction((tx) => this.recordManyInExecutor(events, tx));
      return;
    }
    await this.recordManyInExecutor(events, executor);
  }

  private async recordInExecutor(event: AuditEventInput, executor: AuditExecutor): Promise<void> {
    await executor.insert(auditEvents).values(this.buildEvent(event));
    await this.queueNotification(event, executor);
  }

  private async recordManyInExecutor(events: readonly AuditEventInput[], executor: AuditExecutor): Promise<void> {
    await executor.insert(auditEvents).values(events.map((event) => this.buildEvent(event)));
    for (const event of events) await this.queueNotification(event, executor);
  }

  private buildEvent(event: AuditEventInput): AuditEventRow {
    return {
      eventType: event.eventType,
      metadata: this.sanitize(event.metadata ?? {}),
      ...(event.requestId ? { requestId: event.requestId } : {}),
      ...(event.actorAccountId ? { actorAccountId: event.actorAccountId } : {}),
      ...(event.subjectType ? { subjectType: event.subjectType } : {}),
      ...(event.subjectId ? { subjectId: event.subjectId } : {}),
      ...(event.propertyId ? { propertyId: event.propertyId } : {}),
      ...(event.ipAddress ? { ipAddress: event.ipAddress } : {}),
      ...(event.userAgent ? { userAgent: event.userAgent } : {}),
    };
  }

  private async queueNotification(event: AuditEventInput, executor: AuditExecutor): Promise<void> {
    if (!event.propertyId || !event.actorAccountId || event.eventType.startsWith('notification.')) return;

    const details = this.formatNotificationDetails(event);
    const sanitizedMetadata = {
      ...this.sanitize(event.metadata ?? {}),
      department: details.department,
      priority: details.priority,
      originalEventType: event.eventType,
    };

    const notificationRows = [
      {
        id: randomUUID(),
        propertyId: event.propertyId,
        targetAccountId: event.actorAccountId,
        type: details.priority,
        title: details.title,
        content: details.content,
        actionLink: details.route,
        metadata: sanitizedMetadata,
      },
      {
        id: randomUUID(),
        propertyId: event.propertyId,
        targetRole: 'administrator',
        type: details.priority,
        title: details.title,
        content: details.content,
        actionLink: details.route,
        metadata: sanitizedMetadata,
      },
      ...(this.roleFor(details.department) ? [{
        id: randomUUID(),
        propertyId: event.propertyId,
        targetRole: this.roleFor(details.department),
        type: details.priority === 'HIGH' ? 'ALARM' : 'TASK',
        title: details.title,
        content: details.content,
        actionLink: details.route,
        metadata: sanitizedMetadata,
      }] : []),
    ];

    await executor.insert(notifications).values(notificationRows);
    if (this.outbox) {
      await this.outbox.enqueue(executor, {
        propertyId: event.propertyId,
        eventType: 'notification:new',
        ...(event.subjectType ? { aggregateType: event.subjectType } : {}),
        ...(event.subjectId ? { aggregateId: event.subjectId } : {}),
        ...(event.requestId ? { requestId: event.requestId } : {}),
        payload: {
          ...details,
          id: notificationRows[0]!.id,
          createdAt: new Date().toISOString(),
          isRead: false,
          read: false,
        },
      });
    }
  }

  private formatNotificationDetails(event: AuditEventInput): NotificationDetails {
    const type = event.eventType.toLowerCase();
    const meta = event.metadata || {};

    // 1. Housekeeping / Limpieza
    if (type.startsWith('cleaning.')) {
      if (type.includes('created')) {
        return {
          title: '🧹 Nueva Tarea de Limpieza Programada',
          content: `Se generó una asignación de limpieza de habitación para el personal de housekeeping.`,
          department: 'housekeeping',
          priority: 'MEDIUM',
          route: 'limpieza',
        };
      }
      if (type.includes('progressed') || type.includes('in_progress')) {
        return {
          title: '🧼 Avance en Limpieza de Habitación',
          content: `El personal de housekeeping registró progreso en el mantenimiento y aseo de la habitación.`,
          department: 'housekeeping',
          priority: 'INFO',
          route: 'limpieza',
        };
      }
      if (type.includes('completed') || type.includes('finished')) {
        return {
          title: '✨ Habitación Limpia y Lista para Ocupación',
          content: `Se completó satisfactoriamente la limpieza. La habitación queda disponible para recepción.`,
          department: 'housekeeping',
          priority: 'MEDIUM',
          route: 'limpieza',
        };
      }
      return {
        title: '🧹 Actualización de Limpieza',
        content: `Se actualizó el estado operativo de una tarea de limpieza de habitación.`,
        department: 'housekeeping',
        priority: 'INFO',
        route: 'limpieza',
      };
    }

    // 2. Kitchen & Bar / Restaurante
    if (type.startsWith('orders.') || type.startsWith('kitchen.') || type.startsWith('menu.') || type.startsWith('food.')) {
      if (type.includes('created')) {
        return {
          title: '🍽️ Nueva Comanda en Cocina / Bar',
          content: `Se ha registrado una nueva orden de alimentos y bebidas para preparación.`,
          department: 'restaurant',
          priority: 'HIGH',
          route: 'cocina-bar',
        };
      }
      if (type.includes('ready') || type.includes('completed')) {
        return {
          title: '🔔 Pedido Listo para Servir',
          content: `La cocina o bar ha finalizado la preparación de una comanda para su entrega.`,
          department: 'restaurant',
          priority: 'HIGH',
          route: 'cocina-bar',
        };
      }
      return {
        title: '🍳 Actualización en Cocina / Bar',
        content: `Se registró un cambio de estado en la comanda de alimentos y bebidas.`,
        department: 'restaurant',
        priority: 'MEDIUM',
        route: 'cocina-bar',
      };
    }

    // 3. Reservations & Reception / Recepción
    if (type.startsWith('reservations.') || type.startsWith('stays.') || type.startsWith('guests.')) {
      if (type.includes('created')) {
        return {
          title: '🛎️ Nueva Reserva Recibida',
          content: `Se registró una nueva reserva de alojamiento en el sistema de recepción.`,
          department: 'frontdesk',
          priority: 'MEDIUM',
          route: 'reservas',
        };
      }
      if (type.includes('checked_in') || type.includes('checkin')) {
        return {
          title: '🏨 Check-in de Huésped Registrado',
          content: `Ingreso formal de huésped con asignación de habitación y tarjeta de acceso.`,
          department: 'frontdesk',
          priority: 'INFO',
          route: 'checkin-checkout',
        };
      }
      if (type.includes('checked_out') || type.includes('checkout')) {
        return {
          title: '👋 Check-out y Liquidación de Folio',
          content: `Se finalizó la estadía del huésped y se emitió el cierre de cuenta.`,
          department: 'frontdesk',
          priority: 'INFO',
          route: 'checkin-checkout',
        };
      }
      return {
        title: '🛎️ Gestión de Huéspedes y Recepción',
        content: `Se registró una operación en el módulo de recepción y estadías.`,
        department: 'frontdesk',
        priority: 'INFO',
        route: 'reservas',
      };
    }

    // 4. Purchases & Suppliers / Compras y Proveedores
    if (type.startsWith('suppliers.') || type.startsWith('purchase_orders.') || type.startsWith('inventory.')) {
      if (type.includes('po_created') || type.includes('order.created')) {
        return {
          title: '📋 Nueva Orden de Compra (OC) Emitida',
          content: `Se emitió una orden de compra formal para abastecimiento de insumos.`,
          department: 'purchases',
          priority: 'MEDIUM',
          route: 'proveedores',
        };
      }
      if (type.includes('received') || type.includes('restock')) {
        return {
          title: '📦 Insumos Recibidos en Almacén Central',
          content: `Se recepcionó mercadería de proveedor y se actualizó el Kardex de inventario.`,
          department: 'purchases',
          priority: 'MEDIUM',
          route: 'proveedores',
        };
      }
      if (type.includes('low_stock') || type.includes('critical')) {
        return {
          title: '⚠️ Alerta: Insumos en Nivel Crítico de Stock',
          content: `Materias primas de cocina/bar alcanzaron el stock mínimo de seguridad.`,
          department: 'purchases',
          priority: 'HIGH',
          route: 'proveedores',
        };
      }
      return {
        title: '📦 Movimiento de Inventario y Compras',
        content: `Se registró un ajuste o movimiento en el inventario del hotel.`,
        department: 'purchases',
        priority: 'INFO',
        route: 'inventario',
      };
    }

    // 5. Events & Banquets / Salones y Eventos
    if (type.startsWith('events.')) {
      if (type.includes('created') || type.includes('confirmed')) {
        return {
          title: '💍 Nuevo Evento / Banquete Agendado',
          content: `Se reservó un espacio de eventos con paquete de catering y montaje.`,
          department: 'events',
          priority: 'MEDIUM',
          route: 'eventos',
        };
      }
      return {
        title: '🎉 Actualización de Eventos y Salones',
        content: `Se modificó la agenda o requerimientos de un evento corporativo o social.`,
        department: 'events',
        priority: 'INFO',
        route: 'eventos',
      };
    }

    // 6. Maintenance & Incidents / Mantenimiento e Incidencias
    if (type.startsWith('maintenance.') || type.startsWith('incidents.')) {
      return {
        title: '⚠️ Requerimiento de Mantenimiento / Incidencia',
        content: `Se registró un reporte técnico que requiere atención de servicios generales.`,
        department: 'maintenance',
        priority: 'HIGH',
        route: 'mantenimiento',
      };
    }

    // 7. Security & Authentication / Seguridad y Acceso
    if (type.startsWith('auth.')) {
      if (type.includes('succeeded') || type.includes('login')) {
        return {
          title: '🔒 Inicio de Sesión de Usuario',
          content: `Acceso autenticado exitosamente al sistema de gestión Park Plaza.`,
          department: 'security',
          priority: 'INFO',
          route: 'auditoria',
        };
      }
      if (type.includes('failed')) {
        return {
          title: '🚨 Intento de Acceso No Autorizado',
          content: `Se detectó un intento fallido de autenticación en la plataforma.`,
          department: 'security',
          priority: 'HIGH',
          route: 'auditoria',
        };
      }
      return {
        title: '🔒 Evento de Seguridad y Cuentas',
        content: `Actividad registrada en el control de acceso y credenciales.`,
        department: 'security',
        priority: 'INFO',
        route: 'auditoria',
      };
    }

    // Default Fallback
    return {
      title: '📢 Notificación del Sistema Park Plaza',
      content: `Se registró una operación sobre el sistema (${event.eventType}).`,
      department: 'general',
      priority: 'INFO',
      route: 'dashboard',
    };
  }

  private roleFor(department: string) {
    if (department === 'housekeeping') return 'cleaning';
    if (department === 'restaurant') return 'kitchen';
    if (department === 'frontdesk') return 'receptionist';
    if (department === 'purchases') return 'administrator';
    if (department === 'maintenance') return 'maintenance';
    return null;
  }

  private sanitize(value: Record<string, unknown>): Record<string, unknown> {
    const credential = /(password|token|secret|authorization|cookie)/i;
    const pii = /(email(?!hash)|phone|documentNumber|address|emergencyContact|photoUrl)/i;
    return Object.fromEntries(Object.entries(value).filter(([key]) => !credential.test(key)).map(([key, item]) => [key, pii.test(key) ? '[REDACTED]' : this.sanitizeValue(item, credential, pii)]));
  }

  private sanitizeValue(value: unknown, credential: RegExp, pii: RegExp): unknown {
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item, credential, pii));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !credential.test(key)).map(([key, item]) => [key, pii.test(key) ? '[REDACTED]' : this.sanitizeValue(item, credential, pii)]));
    return value;
  }
}
