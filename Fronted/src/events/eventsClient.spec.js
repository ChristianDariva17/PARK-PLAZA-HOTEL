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

  it('includes expectedVersion and idempotencyKey in updateEvent', async () => {
    vi.mocked(authRequest).mockResolvedValueOnce({ id: 'ev-1', version: 2 });
    
    const result = await eventsClient.updateEvent('ev-1', 1, { title: 'Updated' });
    
    expect(authRequest).toHaveBeenCalledWith('/api/events/ev-1', expect.objectContaining({
      method: 'PATCH',
      body: expect.stringMatching(/"expectedVersion":1/),
    }));
    expect(authRequest).toHaveBeenCalledWith('/api/events/ev-1', expect.objectContaining({
      body: expect.stringMatching(/"idempotencyKey":/),
    }));
    expect(result).toEqual({ id: 'ev-1', version: 2 });
  });

  it('includes expectedVersion and idempotencyKey in confirmEvent', async () => {
    vi.mocked(authRequest).mockResolvedValueOnce({ id: 'ev-1', status: 'confirmed' });
    
    await eventsClient.confirmEvent('ev-1', 2);
    
    expect(authRequest).toHaveBeenCalledWith('/api/events/ev-1/confirm', expect.objectContaining({
      method: 'POST',
      body: expect.stringMatching(/"expectedVersion":2/),
    }));
  });
});
