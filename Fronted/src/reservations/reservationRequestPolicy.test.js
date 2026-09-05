import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { hasReservationCreateAccess, hasReservationLifecycleAccess, isCurrentReservationOperation, reservationReconciliationSucceeded } from './reservationRequestPolicy.js';

describe('reservation request policy', () => {
  it('fails closed unless every create-flow permission is present', () => {
    const permissions = [PERMISSIONS.reservationsRead, PERMISSIONS.reservationsCreate, PERMISSIONS.roomsRead, PERMISSIONS.guestsRead];
    expect(hasReservationCreateAccess('authenticated', permissions)).toBe(true);
    expect(hasReservationCreateAccess('anonymous', permissions)).toBe(false);
    permissions.forEach((permission) => expect(hasReservationCreateAccess('authenticated', permissions.filter((item) => item !== permission))).toBe(false));
  });

  it('rejects stale generations and aborted operations', () => {
    const active = new AbortController();
    const aborted = new AbortController();
    aborted.abort();
    expect(isCurrentReservationOperation(3, 3, active.signal)).toBe(true);
    expect(isCurrentReservationOperation(2, 3, active.signal)).toBe(false);
    expect(isCurrentReservationOperation(3, 3, aborted.signal)).toBe(false);
  });

  it('allows retry only after both authoritative reconciliations succeed', () => {
    expect(reservationReconciliationSucceeded([{ status: 'fulfilled', value: [] }, { status: 'fulfilled', value: { rooms: [] } }])).toBe(true);
    expect(reservationReconciliationSucceeded([{ status: 'fulfilled', value: null }, { status: 'fulfilled', value: { rooms: [] } }])).toBe(false);
    expect(reservationReconciliationSucceeded([{ status: 'rejected', reason: new Error('failed') }, { status: 'fulfilled', value: { rooms: [] } }])).toBe(false);
  });
  it('requires the exact lifecycle permission for each operation', () => {
    const permissions = [PERMISSIONS.reservationsRead, PERMISSIONS.reservationsUpdate, PERMISSIONS.reservationsCancel];
    expect(hasReservationLifecycleAccess('authenticated', permissions, 'confirm')).toBe(true);
    expect(hasReservationLifecycleAccess('authenticated', permissions, 'cancel')).toBe(true);
    expect(hasReservationLifecycleAccess('authenticated', permissions.filter((item) => item !== PERMISSIONS.reservationsCancel), 'cancel')).toBe(false);
  });
});
