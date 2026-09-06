import { useEffect, useState } from 'react';
import { addConnectionListener, connectSocket, getSocket, subscribeToEvent } from '../realtime/socketClient.js';

/**
 * Hook to manage real-time WebSocket connection and event subscriptions.
 *
 * @param {string} [eventName] Optional event name to listen to
 * @param {Function} [onEvent] Callback triggered when eventName is received
 * @returns {{ isConnected: boolean, status: string, socket: any }}
 */
export function useWebSocket(eventName, onEvent) {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    connectSocket();
    const unsubscribeConn = addConnectionListener((connected, stat) => {
      setIsConnected(connected);
      setStatus(stat);
    });

    return unsubscribeConn;
  }, []);

  useEffect(() => {
    if (!eventName || !onEvent) return;

    const unsubscribe = subscribeToEvent(eventName, onEvent);
    return unsubscribe;
  }, [eventName, onEvent]);

  return {
    isConnected,
    status,
    socket: getSocket(),
  };
}
