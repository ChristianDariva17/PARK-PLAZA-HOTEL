import { useState, useCallback, useEffect } from 'react';
import { staffClient } from '../staff/staffClient.js';
import { useAuth } from '../auth/authContext.js';
import { hasPermission, PERMISSIONS } from '../auth/permissions.js';

export function useStaffResource() {
  const { account, permissions = [] } = useAuth();
  const [data, setData] = useState({ staff: [], attendance: [] });
  const [status, setStatus] = useState('idle'); // idle | loading | ready | failed | forbidden
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!account) return;
    
    const canReadStaff = hasPermission(permissions, PERMISSIONS.staffRead);
    const canReadAttendance = hasPermission(permissions, PERMISSIONS.staffAttendanceRead);
    
    if (!canReadStaff && !canReadAttendance) {
      setStatus('forbidden');
      return;
    }

    try {
      setStatus('loading');
      setError(null);

      const [staff, attendance] = await Promise.all([
        canReadStaff ? staffClient.getStaffDirectory() : Promise.resolve([]),
        canReadAttendance ? staffClient.getAttendanceEvents() : Promise.resolve([]),
      ]);

      setData({ staff, attendance });
      setStatus('ready');
    } catch (err) {
      console.error('Error loading staff resources:', err);
      setError(err);
      setStatus('failed');
    }
  }, [account, permissions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, status, error, reload: loadData };
}
