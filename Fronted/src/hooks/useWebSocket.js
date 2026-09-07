import { useCallback, useEffect, useRef, useState } from 'react';
import { addConnectionListener, connectSocket, getSocket, subscribeToEvent } from '../realtime/socketClient.js';

/**
 * Hook to manage real-time WebSocket connection and event subscriptions.
 *
 * @param {string} [eventName] Optional event name to listen to
 * @param {Function} [onEvent] Callback triggered when eventName is received
 * @returns {{ isConnected: boolean, status: string, socket: any }}
 */
export function useWebSocket(eventName, onEvent) {
  return useWebSocketEvents(eventName ? [eventName] : [], onEvent);
}

export function useWebSocketEvents(eventNames, onEvent) {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState('connecting');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const eventKey = eventNames.join('\0');

  useEffect(() => {
    connectSocket();
    const unsubscribeConn = addConnectionListener((connected, stat) => {
      setIsConnected(connected);
      setStatus(stat);
    });

    return unsubscribeConn;
  }, []);

  const handleEvent = useCallback((...args) => onEventRef.current?.(...args), []);

  useEffect(() => {
    if (!eventKey || !onEventRef.current) return undefined;

    const unsubscribers = eventKey.split('\0').map((eventName) => subscribeToEvent(eventName, handleEvent));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [eventKey, handleEvent]);

  return {
    isConnected,
    status,
    socket: getSocket(),
  };
}
