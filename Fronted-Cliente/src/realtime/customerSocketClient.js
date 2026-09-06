import { io } from 'socket.io-client';

let socketInstance = null;

export function getCustomerSocket() {
  return socketInstance;
}

export function connectCustomerSocket() {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: false,
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

  if (!socketInstance.connected) socketInstance.connect();
  return socketInstance;
}

export function disconnectCustomerSocket() {
  if (!socketInstance) return;

  socketInstance.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
}

export function subscribeCustomerEvent(event, callback) {
  if (!socketInstance) return () => {};
  socketInstance.on(event, callback);

  return () => {
    socketInstance.off(event, callback);
  };
}
