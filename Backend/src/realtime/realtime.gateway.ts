import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { accounts, roles, sessions } from '../database/schema/index.js';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/',
  pingTimeout: 30000,
  pingInterval: 10000,
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async handleConnection(client: Socket) {
    try {
      const cookieHeader = client.handshake.headers.cookie;
      const cookies = this.parseCookies(cookieHeader);
      const sessionToken = cookies['pp_session'] || client.handshake.auth?.token || client.handshake.query?.token;

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

      // Guest / Customer portal connection via stayId or propertyId
      const stayId = client.handshake.auth?.stayId || client.handshake.query?.stayId;
      const propertyId = client.handshake.auth?.propertyId || client.handshake.query?.propertyId;

      if (stayId && typeof stayId === 'string') {
        const stayRoom = `stay:${stayId}`;
        await client.join(stayRoom);
        if (propertyId && typeof propertyId === 'string') {
          await client.join(`property:${propertyId}`);
        }
        this.logger.log(`[Guest Connected] Socket ${client.id} joined room: ${stayRoom}`);
        client.emit('connection:ack', {
          status: 'connected',
          type: 'guest',
          stayId,
        });
        return;
      }

      // Anonymous / Guest general broadcast
      if (propertyId && typeof propertyId === 'string') {
        await client.join(`property:${propertyId}`);
        this.logger.log(`[Public Connected] Socket ${client.id} joined property:${propertyId}`);
        client.emit('connection:ack', { status: 'connected', type: 'public', propertyId });
        return;
      }

      this.logger.log(`[Socket Connected] Socket ${client.id} connected globally.`);
      client.emit('connection:ack', { status: 'connected', type: 'anonymous' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`[Socket Error] Connection handler error for ${client.id}: ${message}`);
      client.emit('connection:ack', { status: 'connected', type: 'fallback' });
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Socket Disconnected] Socket ${client.id}`);
  }

  /**
   * Emits an event to all sockets in a specific property (staff & guests)
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
