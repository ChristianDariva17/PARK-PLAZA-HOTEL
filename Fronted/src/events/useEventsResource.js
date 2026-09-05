import { useState, useEffect, useCallback } from 'react';
import { eventsClient } from './eventsClient';
import { useWebSocket } from '../hooks/useWebSocket';

export function useEventsResource() {
  const [spaces, setSpaces] = useState([]);
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search and filter state
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    spaceId: '',
    status: '',
    q: '',
    page: 1,
    pageSize: 20
  });

  const loadSpaces = useCallback(async (signal) => {
    try {
      const data = await eventsClient.getSpaces(signal);
      setSpaces(data);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Failed to load spaces', err);
      }
    }
  }, []);

  const loadEvents = useCallback(async (currentFilters, signal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await eventsClient.getEvents(currentFilters, signal);
      setEvents(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Error loading events');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadSpaces(controller.signal);
    return () => controller.abort();
  }, [loadSpaces]);

  useEffect(() => {
    const controller = new AbortController();
    loadEvents(filters, controller.signal);
    return () => controller.abort();
  }, [filters, loadEvents]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: newFilters.page || 1 }));
  }, []);

  const refresh = useCallback(() => {
    loadEvents(filters);
  }, [filters, loadEvents]);

  // Real-time synchronization
  useWebSocket('event:created', refresh);
  useWebSocket('event:confirmed', refresh);
  useWebSocket('event:status_changed', refresh);
  useWebSocket('event:cancelled', refresh);
  useWebSocket('event:updated', refresh);
  useWebSocket('event:archived', refresh);

  return {
    spaces,
    events,
    total,
    loading,
    error,
    filters,
    updateFilters,
    refresh
  };
}
