import { io } from 'socket.io-client';

let socketInstance = null;

export function getCustomerSocket() {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketInstance.on('connect', () => {
      console.log('[Customer WebSocket] Conectado al portal.');
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
