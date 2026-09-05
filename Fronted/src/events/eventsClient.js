import { authRequest } from '../auth/authClient';

const generateIdempotencyKey = () => crypto.randomUUID();

export const eventsClient = {
  async getEvents(params = {}, signal) {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);
    if (params.spaceId) searchParams.append('spaceId', params.spaceId);
    if (params.status) searchParams.append('status', params.status);
    if (params.q) searchParams.append('q', params.q);
    if (params.page) searchParams.append('page', params.page);
    if (params.pageSize) searchParams.append('pageSize', params.pageSize);

    return authRequest(`/api/events?${searchParams.toString()}`, { signal });
  },

  async getSpaces(signal) {
    return authRequest('/api/events/spaces', { signal });
  },

  async checkSpaceAvailability(spaceId, from, to, excludeEventId, signal) {
    const searchParams = new URLSearchParams();
    searchParams.append('from', from);
    searchParams.append('to', to);
    if (excludeEventId) searchParams.append('excludeEventId', excludeEventId);

    return authRequest(`/api/events/spaces/${spaceId}/availability?${searchParams.toString()}`, { signal });
  },

  async getEventDetail(eventId, signal) {
    return authRequest(`/api/events/${eventId}`, { signal });
  },

  async getSpacePolicy(spaceId, signal) {
    return authRequest(`/api/events/spaces/${spaceId}/policy`, { signal });
  },

  async updateSpacePolicy(spaceId, payload) {
    return authRequest(`/api/events/spaces/${spaceId}/policy`, { method: 'PATCH', body: JSON.stringify(payload) });
  },

  async replaceSpaceServices(spaceId, services) {
    return authRequest(`/api/events/spaces/${spaceId}/services`, { method: 'PUT', body: JSON.stringify(services) });
  },

  async createEvent(data) {
    const payload = { ...data, idempotencyKey: generateIdempotencyKey() };
    return authRequest('/api/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateEvent(eventId, expectedVersion, data) {
    const payload = { ...data, expectedVersion, idempotencyKey: generateIdempotencyKey() };
    return authRequest(`/api/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async confirmEvent(eventId, expectedVersion, depositReceivedAmount = 0, paymentMethod = 'Efectivo', notes = '') {
    return authRequest(`/api/events/${eventId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ 
        expectedVersion, 
        depositReceivedAmount, 
        paymentMethod, 
        notes, 
        idempotencyKey: generateIdempotencyKey() 
      }),
    });
  },

  async advanceEvent(eventId, expectedVersion, action) {
    return authRequest(`/api/events/${eventId}/${action}`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion, idempotencyKey: generateIdempotencyKey() }),
    });
  },

  async cancelEvent(eventId, expectedVersion, reason) {
    return authRequest(`/api/events/${eventId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion, reason, idempotencyKey: generateIdempotencyKey() }),
    });
  },

  async archiveEvent(eventId, expectedVersion) {
    return authRequest(`/api/events/${eventId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion, idempotencyKey: generateIdempotencyKey() }),
    });
  }
};
