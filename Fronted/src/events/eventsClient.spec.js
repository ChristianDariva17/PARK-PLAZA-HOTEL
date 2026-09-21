import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventsClient } from './eventsClient';
import { authRequest } from '../auth/authClient';

vi.mock('../auth/authClient', () => ({
  authRequest: vi.fn()
}));

describe('eventsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends expectedVersion in the body and idempotency key in the header for updateEvent', async () => {
    vi.mocked(authRequest).mockResolvedValueOnce({ id: 'ev-1', version: 2 });
    
    const result = await eventsClient.updateEvent('ev-1', 1, { title: 'Updated' });
    
    expect(authRequest).toHaveBeenCalledWith('/api/events/ev-1', expect.objectContaining({
      method: 'PATCH',
      body: expect.stringMatching(/"expectedVersion":1/),
    }));
    expect(authRequest).toHaveBeenCalledWith('/api/events/ev-1', expect.objectContaining({
      headers: { 'Idempotency-Key': expect.any(String) },
      body: expect.not.stringMatching(/"idempotencyKey"/),
    }));
    expect(result).toEqual({ id: 'ev-1', version: 2 });
  });

  it('sends expectedVersion in the body and idempotency key in the header for confirmEvent', async () => {
    vi.mocked(authRequest).mockResolvedValueOnce({ id: 'ev-1', status: 'confirmed' });
    
    await eventsClient.confirmEvent('ev-1', 2);
    
    expect(authRequest).toHaveBeenCalledWith('/api/events/ev-1/confirm', expect.objectContaining({
      method: 'POST',
      headers: { 'Idempotency-Key': expect.any(String) },
      body: expect.stringMatching(/"expectedVersion":2/),
    }));
  });
});
