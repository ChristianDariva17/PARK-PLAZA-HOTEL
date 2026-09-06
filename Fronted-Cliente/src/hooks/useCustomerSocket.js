import { useEffect } from 'react';
import { getCustomerSocket, subscribeCustomerEvent } from '../realtime/customerSocketClient.js';

export function useCustomerSocket(stayId, propertyId, eventName, onEvent) {
  useEffect(() => {
    if (!stayId) return;
    getCustomerSocket();
  }, [stayId, propertyId]);

  useEffect(() => {
    if (!eventName || !onEvent) return;
    const unsubscribe = subscribeCustomerEvent(eventName, onEvent);
    return unsubscribe;
  }, [eventName, onEvent]);
}
