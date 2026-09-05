import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentsClient } from '../documents/documentsClient.js';
import { fetchNotifications } from '../communications/communicationsClient.js';
import { fetchExperiences } from '../experiences/experiencesClient.js';

const propertyId = '550e8400-e29b-41d4-a716-446655440000';

afterEach(() => vi.unstubAllGlobals());

describe('verified administrative clients', () => {
  it('uses the concrete documents controller path', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })));
    vi.stubGlobal('fetch', fetch);

    await documentsClient.listContracts();

    expect(fetch.mock.calls[0][0]).toMatch(/^\/api\/documents\/contracts\?/);
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('uses the session-derived property identifier for scoped resources', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } })));
    vi.stubGlobal('fetch', fetch);

    await Promise.all([fetchNotifications(propertyId), fetchExperiences(propertyId)]);

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `/api/properties/${propertyId}/communications/notifications`,
      `/api/properties/${propertyId}/experiences`,
    ]);
  });
});
