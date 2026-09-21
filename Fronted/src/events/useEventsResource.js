import { useState, useEffect, useCallback, useRef } from 'react';
import { eventsClient } from './eventsClient';
import { useWebSocketEvents } from '../hooks/useWebSocket';
import { normalizeRequestError } from '../api/requestError.js';
import { createResourceSnapshot, RESOURCE_STATUS, statusForCollection } from '../api/resourceState.js';

const EVENT_REFRESH_NAMES = ['event:created', 'event:confirmed', 'event:status_changed', 'event:cancelled', 'event:updated', 'event:archived'];

export function useEventsResource() {
  const [spaces, setSpaces] = useState([]);
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(RESOURCE_STATUS.IDLE);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [spacesStatus, setSpacesStatus] = useState(RESOURCE_STATUS.IDLE);
  const [spacesError, setSpacesError] = useState(null);
  const [spacesErrorDetails, setSpacesErrorDetails] = useState(null);

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
  const spacesRequestRef = useRef({ generation: 0, controller: null });
  const refreshTimerRef = useRef(null);

  const loadSpaces = useCallback(async (signal, generation) => {
    setSpacesStatus((current) => current === RESOURCE_STATUS.SUCCESS || current === RESOURCE_STATUS.EMPTY ? RESOURCE_STATUS.REFRESHING : RESOURCE_STATUS.LOADING);
    setSpacesError(null);
    setSpacesErrorDetails(null);
    try {
      const data = await eventsClient.getSpaces(signal);
      if (generation !== spacesRequestRef.current.generation || signal.aborted) return;
      setSpaces(data);
      setSpacesStatus(statusForCollection(data));
    } catch (err) {
      if (generation !== spacesRequestRef.current.generation || err.name === 'AbortError') return;
      const details = normalizeRequestError(err);
      setSpacesError(details.message);
      setSpacesErrorDetails(details);
      setSpacesStatus(details.type === 'forbidden' ? RESOURCE_STATUS.FORBIDDEN : details.type === 'network' ? RESOURCE_STATUS.OFFLINE : RESOURCE_STATUS.ERROR);
    }
  }, []);

  const loadEvents = useCallback(async (currentFilters, signal, generation) => {
    setStatus((current) => current === RESOURCE_STATUS.SUCCESS || current === RESOURCE_STATUS.EMPTY || current === RESOURCE_STATUS.STALE ? RESOURCE_STATUS.REFRESHING : RESOURCE_STATUS.LOADING);
    setError(null);
    setErrorDetails(null);
    try {
      const data = await eventsClient.getEvents(currentFilters, signal);
      if (generation !== eventsRequestRef.current.generation || signal.aborted) return;
      const items = Array.isArray(data?.items) ? data.items : [];
      setEvents(items);
      setTotal(Number(data?.total) || 0);
      setUpdatedAt(new Date().toISOString());
      setStatus(statusForCollection(items));
    } catch (err) {
      if (generation !== eventsRequestRef.current.generation || err.name === 'AbortError') return;
      const details = normalizeRequestError(err);
      setError(details.message);
      setErrorDetails(details);
      setStatus(details.type === 'forbidden' ? RESOURCE_STATUS.FORBIDDEN : details.type === 'network' ? RESOURCE_STATUS.OFFLINE : RESOURCE_STATUS.ERROR);
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
    const request = spacesRequestRef.current;
    request.generation += 1;
    const generation = request.generation;
    request.controller = controller;
    loadSpaces(controller.signal, generation);
    return () => {
      controller.abort();
      if (request.generation === generation) request.generation += 1;
    };
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
    ...createResourceSnapshot({ status, data: events, error, errorDetails, updatedAt }),
    spaces,
    spacesStatus,
    spacesError,
    spacesErrorDetails,
    events,
    total,
    filters,
    updateFilters,
    refresh,
    reload: refresh,
  };
}
