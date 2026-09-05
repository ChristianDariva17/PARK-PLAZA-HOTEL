import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/authContext.js';
import { fetchAmenityReservations } from './amenitiesClient.js';

export function useAmenityReservations() {
  const { account, status: authStatus } = useAuth();
  const [resource, setResource] = useState({ data: [], status: 'idle', error: null });

  const reload = useCallback(async (signal) => {
    setResource((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await fetchAmenityReservations(signal);
      setResource({ data, status: 'ready', error: null });
    } catch (error) {
      if (error.name !== 'AbortError') setResource((current) => ({ ...current, status: 'error', error: error.message }));
    }
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !account?.id) {
      setResource({ data: [], status: 'idle', error: null });
      return undefined;
    }
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [account?.id, authStatus, reload]);

  return { ...resource, reload: () => reload() };
}
