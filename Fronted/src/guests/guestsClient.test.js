import { describe, expect, it } from 'vitest';
import { createGuestCancellationError, GuestRequestError } from './guestsClient.js';

describe('guest operation cancellation', () => {
  it('creates an explicit normalized superseded-operation error', () => {
    const error = createGuestCancellationError();
    expect(error).toBeInstanceOf(GuestRequestError);
    expect(error).toMatchObject({ code: 'superseded', status: null, reloadRecommended: false });
    expect(error.message).toContain('intente nuevamente');
  });
});
