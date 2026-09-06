import { useEffect } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { connectCustomerSocket, subscribeCustomerEvent } from '../realtime/customerSocketClient.js';

export function useCustomerSocket(eventName, onEvent) {
  const { customer, status } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated' || !customer) return;
    connectCustomerSocket();
  }, [customer, status]);

  useEffect(() => {
    if (!eventName || !onEvent) return;
    const unsubscribe = subscribeCustomerEvent(eventName, onEvent);
    return unsubscribe;
  }, [eventName, onEvent]);
}
