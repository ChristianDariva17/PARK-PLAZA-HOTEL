import { describe, expect, it, vi } from 'vitest';
import { RealtimeGateway } from '../src/realtime/realtime.gateway.js';

function config() {
  const values: Record<string, unknown> = {
    AUTH_COOKIE_NAME: 'pp_session',
    CUSTOMER_COOKIE_NAME: 'customer_session',
    CUSTOMER_SESSION_IDLE_HOURS: 24,
  };
  return {
    get: vi.fn((key: string) => values[key]),
  } as any;
}

function client(cookie?: string, auth: Record<string, unknown> = {}) {
  return {
    id: 'socket-1',
    data: {},
    handshake: { headers: { ...(cookie ? { cookie } : {}) }, auth, query: {} },
    join: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
    disconnect: vi.fn(),
  } as any;
}

function query(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
}

describe('RealtimeGateway', () => {
  it('rejects client-selected stay and property identifiers without an authorized session', async () => {
    const database = { select: vi.fn() } as any;
    const gateway = new RealtimeGateway(database, config());
    const socket = client(undefined, { stayId: 'another-guest-stay', propertyId: 'another-property' });

    await gateway.handleConnection(socket);

    expect(database.select).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('connection:ack', { status: 'rejected' });
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it('joins staff rooms derived from the authenticated staff session', async () => {
    const database = { select: vi.fn(() => query([{ accountId: 'staff-1', propertyId: 'property-1', email: 'staff@example.com', roleKey: 'reception', accountStatus: 'active' }])) } as any;
    const gateway = new RealtimeGateway(database, config());
    const socket = client('pp_session=staff-token');

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledWith('property:property-1');
    expect(socket.join).toHaveBeenCalledWith('property:property-1:role:reception');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('keeps consecutive staff connections isolated to their newly authenticated rooms', async () => {
    const database = {
      select: vi.fn()
        .mockReturnValueOnce(query([{ accountId: 'staff-a', propertyId: 'property-a', email: 'a@example.com', roleKey: 'reception', accountStatus: 'active' }]))
        .mockReturnValueOnce(query([{ accountId: 'staff-b', propertyId: 'property-b', email: 'b@example.com', roleKey: 'kitchen', accountStatus: 'active' }])),
    } as any;
    const gateway = new RealtimeGateway(database, config());
    const staffA = client('pp_session=staff-a');
    const staffB = client('pp_session=staff-b');

    await gateway.handleConnection(staffA);
    await gateway.handleConnection(staffB);

    expect(staffA.join).toHaveBeenCalledWith('property:property-a');
    expect(staffA.join).toHaveBeenCalledWith('property:property-a:role:reception');
    expect(staffB.join).toHaveBeenCalledWith('property:property-b');
    expect(staffB.join).toHaveBeenCalledWith('property:property-b:role:kitchen');
    expect(staffB.join).not.toHaveBeenCalledWith('property:property-a');
    expect(staffB.join).not.toHaveBeenCalledWith('property:property-a:role:reception');
  });

  it('joins only active stays owned by the authenticated customer', async () => {
    const customerQuery = query([{ customerAccountId: 'customer-1', propertyId: 'property-1', lastSeenAt: new Date() }]);
    const stayQuery = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 'authorized-stay' }]),
    };
    const database = { select: vi.fn().mockReturnValueOnce(customerQuery).mockReturnValueOnce(stayQuery) } as any;
    const gateway = new RealtimeGateway(database, config());
    const socket = client('customer_session=customer-token', { stayId: 'another-guest-stay', propertyId: 'another-property' });

    await gateway.handleConnection(socket);

    expect(socket.join).toHaveBeenCalledTimes(1);
    expect(socket.join).toHaveBeenCalledWith('stay:authorized-stay');
    expect(socket.emit).toHaveBeenCalledWith('connection:ack', { status: 'connected', type: 'customer', stayIds: ['authorized-stay'] });
    expect(socket.disconnect).not.toHaveBeenCalled();
  });
});
