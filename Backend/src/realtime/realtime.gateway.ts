import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { accounts, customerAccounts, customerReservations, customerSessions, roles, sessions, stays } from '../database/schema/index.js';
import type { Environment } from '../config/environment.js';

@WebSocketGateway({
  path: '/api/socket.io',
  namespace: '/',
  pingTimeout: 30000,
  pingInterval: 10000,
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const cookieHeader = client.handshake.headers.cookie;
      const cookies = this.parseCookies(cookieHeader);
      const sessionToken = cookies[this.config.get('AUTH_COOKIE_NAME', { infer: true })];

      if (sessionToken && typeof sessionToken === 'string') {
        const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
        const rows = await this.database
          .select({
            accountId: accounts.id,
            propertyId: accounts.propertyId,
            email: accounts.email,
            roleKey: roles.key,
            accountStatus: accounts.status,
            expiresAt: sessions.expiresAt,
          })
          .from(sessions)
          .innerJoin(accounts, eq(sessions.accountId, accounts.id))
          .innerJoin(roles, eq(accounts.roleId, roles.id))
          .where(
            and(
              eq(sessions.tokenHash, tokenHash),
              isNull(sessions.revokedAt),
              gt(sessions.expiresAt, new Date()),
            ),
          )
          .limit(1);

        const account = rows[0];

        if (account && account.accountStatus === 'active') {
          client.data.account = account;
          const propertyRoom = `property:${account.propertyId}`;
          const roleRoom = `property:${account.propertyId}:role:${account.roleKey}`;

          await client.join(propertyRoom);
          await client.join(roleRoom);

          this.logger.log(`[Staff Connected] Socket ${client.id} joined rooms: ${propertyRoom}, ${roleRoom} (${account.email} - ${account.roleKey})`);

          client.emit('connection:ack', {
            status: 'connected',
            type: 'staff',
            propertyId: account.propertyId,
            role: account.roleKey,
          });
          return;
        }
      }

      const customerToken = cookies[this.config.get('CUSTOMER_COOKIE_NAME', { infer: true })];
      if (customerToken) {
        const customer = await this.resolveCustomer(customerToken);
        if (customer) {
          const activeStays = await this.resolveCustomerActiveStays(customer.customerAccountId, customer.propertyId);
          if (activeStays.length > 0) {
            await Promise.all(activeStays.map((stayId) => client.join(`stay:${stayId}`)));
            this.logger.log(`[Customer Connected] Socket ${client.id} joined ${activeStays.length} authorized stay room(s)`);
            client.emit('connection:ack', { status: 'connected', type: 'customer', stayIds: activeStays });
            return;
          }
        }
      }

      this.logger.warn(`[Socket Rejected] Socket ${client.id} did not provide an authorized session`);
      client.emit('connection:ack', { status: 'rejected' });
      client.disconnect(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`[Socket Error] Connection handler error for ${client.id}: ${message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Socket Disconnected] Socket ${client.id}`);
  }

  /**
   * Emits an event to authenticated staff in a property.
   */
  emitToProperty(propertyId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`property:${propertyId}`).emit(event, payload);
  }

  /**
   * Emits an event to a specific role in a property (e.g. kitchen, cleaning, receptionist, administrator)
   */
  emitToRole(propertyId: string, roleKey: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`property:${propertyId}:role:${roleKey}`).emit(event, payload);
  }

  /**
   * Emits an event to a specific guest stay room (e.g. order ready, folio charge)
   */
  emitToStay(stayId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`stay:${stayId}`).emit(event, payload);
  }

  /**
   * Broadcasts an event to all connected sockets
   */
  emitToAll(event: string, payload: unknown) {
    if (!this.server) return;
    this.server.emit(event, payload);
  }

  private async resolveCustomer(token: string) {
    const now = new Date();
    const idleCutoff = new Date(now.getTime() - this.config.get('CUSTOMER_SESSION_IDLE_HOURS', { infer: true }) * 3_600_000);
    const rows = await this.database.select({
      customerAccountId: customerAccounts.id,
      propertyId: customerReservations.propertyId,
      lastSeenAt: customerSessions.lastSeenAt,
    }).from(customerSessions)
      .innerJoin(customerAccounts, eq(customerSessions.customerAccountId, customerAccounts.id))
      .innerJoin(customerReservations, eq(customerReservations.customerAccountId, customerAccounts.id))
      .where(and(
        eq(customerSessions.tokenHash, createHash('sha256').update(token).digest('hex')),
        isNull(customerSessions.revokedAt),
        gt(customerSessions.expiresAt, now),
        gt(customerSessions.lastSeenAt, idleCutoff),
        eq(customerAccounts.status, 'active'),
      ))
      .limit(1);
    return rows[0] ?? null;
  }

  private async resolveCustomerActiveStays(customerAccountId: string, propertyId: string): Promise<string[]> {
    const rows = await this.database.select({ id: stays.id }).from(customerReservations)
      .innerJoin(stays, and(
        eq(stays.reservationId, customerReservations.reservationId),
        eq(stays.propertyId, customerReservations.propertyId),
      ))
      .where(and(
        eq(customerReservations.customerAccountId, customerAccountId),
        eq(customerReservations.propertyId, propertyId),
        eq(stays.status, 'active'),
      ));
    return rows.map((row) => row.id);
  }

  private parseCookies(cookieHeader?: string): Record<string, string> {
    const list: Record<string, string> = {};
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      const name = parts[0]?.trim();
      const value = parts.slice(1).join('=').trim();
      if (name) {
        list[name] = decodeURIComponent(value);
      }
    });

    return list;
  }
}
