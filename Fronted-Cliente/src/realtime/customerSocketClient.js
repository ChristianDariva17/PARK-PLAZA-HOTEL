import { io } from 'socket.io-client';

let socketInstance = null;

export function getCustomerSocket(stayId, propertyId) {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: {
        stayId,
        propertyId,
      },
      query: {
        stayId,
        propertyId,
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('[Customer WebSocket] Conectado en vivo a la estadía:', stayId);
    });

    socketInstance.on('connection:ack', (ack) => {
      console.log('[Customer WebSocket] ACK:', ack);
    });
  }

  return socketInstance;
}

export function subscribeCustomerEvent(event, callback) {
  if (!socketInstance) return () => {};
  socketInstance.on(event, callback);

  return () => {
    socketInstance.off(event, callback);
  };
}
