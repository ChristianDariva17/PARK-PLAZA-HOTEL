import { useState, useEffect, useCallback, useRef } from 'react';
import { eventsClient } from './eventsClient';
import { useWebSocketEvents } from '../hooks/useWebSocket';

const EVENT_REFRESH_NAMES = ['event:created', 'event:confirmed', 'event:status_changed', 'event:cancelled', 'event:updated', 'event:archived'];

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
  const eventsRequestRef = useRef({ generation: 0, controller: null });
  const refreshTimerRef = useRef(null);

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

  const loadEvents = useCallback(async (currentFilters, signal, generation) => {
    setLoading(true);
    setError(null);
    try {
      const data = await eventsClient.getEvents(currentFilters, signal);
      if (generation !== eventsRequestRef.current.generation || signal.aborted) return;
      setEvents(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      if (generation === eventsRequestRef.current.generation && err.name !== 'AbortError') {
        setError(err.message || 'Error loading events');
      }
    } finally {
      if (generation === eventsRequestRef.current.generation) setLoading(false);
    }
  }, []);

  const startEventsLoad = useCallback((currentFilters) => {
    const request = eventsRequestRef.current;
    request.controller?.abort();
    request.generation += 1;
    request.controller = new AbortController();
    loadEvents(currentFilters, request.controller.signal, request.generation);
  }, [loadEvents]);

  useEffect(() => {
    const controller = new AbortController();
    loadSpaces(controller.signal);
    return () => controller.abort();
  }, [loadSpaces]);

  useEffect(() => {
    startEventsLoad(filters);
    const controller = eventsRequestRef.current.controller;
    return () => controller?.abort();
  }, [filters, startEventsLoad]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: newFilters.page || 1 }));
  }, []);

  const refresh = useCallback(() => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      startEventsLoad(filters);
    }, 100);
  }, [filters, startEventsLoad]);

  // Real-time synchronization
  useWebSocketEvents(EVENT_REFRESH_NAMES, refresh);

  useEffect(() => () => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    eventsRequestRef.current.controller?.abort();
  }, []);

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
