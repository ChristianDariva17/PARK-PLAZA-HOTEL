import { io } from 'socket.io-client';

let socketInstance = null;
let socketCustomerId = null;

export function getCustomerSocket() {
  return socketInstance;
}

export function connectCustomerSocket(customerId) {
  if (socketInstance && socketCustomerId && socketCustomerId !== customerId) {
    disconnectCustomerSocket();
  }

  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketCustomerId = customerId;

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
  socketCustomerId = null;
}

export function subscribeCustomerEvent(event, callback) {
  if (!socketInstance) return () => {};
  socketInstance.on(event, callback);

  return () => {
    socketInstance.off(event, callback);
  };
}
