import { useEffect } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { connectCustomerSocket, disconnectCustomerSocket, subscribeCustomerEvent } from '../realtime/customerSocketClient.js';

export function useCustomerSocket(eventName, onEvent) {
  const { customer, status } = useAuth();

  useEffect(() => {
    if (status !== 'authenticated' || !customer?.customerAccountId) {
      disconnectCustomerSocket();
      return;
    }
    connectCustomerSocket(customer.customerAccountId);
  }, [customer, status]);

  useEffect(() => {
    if (!eventName || !onEvent) return;
    const unsubscribe = subscribeCustomerEvent(eventName, onEvent);
    return unsubscribe;
  }, [eventName, onEvent]);
}
