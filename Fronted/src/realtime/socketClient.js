import { io } from 'socket.io-client';

let socketInstance = null;
const connectionListeners = new Set();

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    socketInstance.on('connect', () => {
      console.log('[WebSocket] Conectado en vivo al servidor Park Plaza');
      connectionListeners.forEach((cb) => cb(true, 'connected'));
    });

    socketInstance.on('disconnect', (reason) => {
      console.warn('[WebSocket] Desconectado:', reason);
      connectionListeners.forEach((cb) => cb(false, 'disconnected'));
    });

    socketInstance.on('connect_error', (error) => {
      console.warn('[WebSocket] Error de conexión:', error.message);
      connectionListeners.forEach((cb) => cb(false, 'error'));
    });

    socketInstance.on('connection:ack', (ack) => {
      console.log('[WebSocket] Handshake ACK:', ack);
    });
  }

  return socketInstance;
}

export function subscribeToEvent(event, callback) {
  const socket = getSocket();
  socket.on(event, callback);

  return () => {
    socket.off(event, callback);
  };
}

export function addConnectionListener(callback) {
  connectionListeners.add(callback);
  if (socketInstance) {
    callback(socketInstance.connected, socketInstance.connected ? 'connected' : 'disconnected');
  }
  return () => {
    connectionListeners.delete(callback);
  };
}
