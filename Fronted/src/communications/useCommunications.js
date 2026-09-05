import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/authContext.js';
import { useActionPermission } from '../components/auth/useActionPermission.js';
import { 
  fetchNotifications, 
  markNotificationRead, 
  markAllNotificationsRead, 
  clearReadNotifications, 
  fetchPreferences, 
  updatePreference 
} from './communicationsClient.js';
import { adaptNotificationResponse, adaptPreferenceResponse } from './communicationsModel.js';

export function useCommunications() {
  const { account, status: authStatus } = useAuth();
  const canReadNotifications = useActionPermission('NOTIFICATION_READ');
  const [notifications, setNotifications] = useState({ data: [], status: 'idle', error: null });
  const [preferences, setPreferences] = useState({ data: null, status: 'idle', error: null });
  const [actionLoading, setActionLoading] = useState(false);

  const loadNotifications = useCallback(async (controller) => {
    setNotifications(prev => ({ ...prev, status: 'loading', error: null }));
    try {
      const res = await fetchNotifications(account.propertyId, {}, controller?.signal);
      const data = (res || []).map(adaptNotificationResponse);
      setNotifications({ data, status: 'ready', error: null });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setNotifications(prev => ({ ...prev, status: 'error', error: err.message }));
    }
  }, [account?.propertyId]);

  const loadPreferences = useCallback(async (controller) => {
    setPreferences(prev => ({ ...prev, status: 'loading', error: null }));
    try {
      const res = await fetchPreferences(account.propertyId, controller?.signal);
      setPreferences({ data: adaptPreferenceResponse(res), status: 'ready', error: null });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setPreferences(prev => ({ ...prev, status: 'error', error: err.message }));
    }
  }, [account?.propertyId]);

  const refresh = useCallback(() => {
    if (account?.propertyId) {
      loadNotifications();
    }
  }, [account?.propertyId, loadNotifications]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !account?.id || !account?.propertyId || !canReadNotifications) {
      setNotifications({ data: [], status: 'idle', error: null });
      return;
    }
    const controller = new AbortController();
    loadNotifications(controller);
    return () => controller.abort();
  }, [account?.id, account?.propertyId, authStatus, canReadNotifications, loadNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationRead(account.propertyId, id, true);
      setNotifications(prev => ({
        ...prev,
        data: prev.data.map(n => n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n)
      }));
      return true;
    } catch (err) {
      return false;
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setActionLoading(true);
      await markAllNotificationsRead(account.propertyId);
      setNotifications(prev => ({
        ...prev,
        data: prev.data.map(n => ({ ...n, read: true, readAt: new Date().toISOString() }))
      }));
      return true;
    } catch (err) {
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearRead = async () => {
    try {
      setActionLoading(true);
      await clearReadNotifications(account.propertyId);
      setNotifications(prev => ({
        ...prev,
        data: prev.data.filter(n => !n.read)
      }));
      return true;
    } catch (err) {
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const unreadCount = notifications.data.filter(n => !n.read).length;

  return {
    notifications,
    unreadCount,
    preferences,
    actionLoading,
    handleMarkRead,
    handleMarkAllRead,
    handleClearRead,
    refresh,
    loadPreferences,
    updatePreference: (payload) => updatePreference(account?.propertyId, payload),
  };
}
