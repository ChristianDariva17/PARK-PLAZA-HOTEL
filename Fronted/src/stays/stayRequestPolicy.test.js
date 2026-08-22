import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../auth/permissions.js';
import { hasStayCheckInAccess, hasStayCheckOutAccess, isCurrentStayOperation, stayReconciliationSucceeded } from './stayRequestPolicy.js';

describe('stay request policy', () => {
  it('fails closed on missing permissions and stale operations', () => {
    const permissions = [PERMISSIONS.staysRead, PERMISSIONS.staysCheckIn, PERMISSIONS.staysCheckOut, PERMISSIONS.reservationsRead, PERMISSIONS.roomsRead, PERMISSIONS.guestsRead];
    expect(hasStayCheckInAccess('authenticated', permissions)).toBe(true);
    expect(hasStayCheckOutAccess('authenticated', permissions)).toBe(true);
    expect(hasStayCheckInAccess('authenticated', permissions.filter((item) => item !== PERMISSIONS.guestsRead))).toBe(false);
    const controller = new AbortController();
    expect(isCurrentStayOperation(2, 2, controller.signal)).toBe(true);
    controller.abort();
    expect(isCurrentStayOperation(2, 2, controller.signal)).toBe(false);
  });
  it('requires all authoritative collections to reload before an ambiguous retry', () => {
    expect(stayReconciliationSucceeded([{ status: 'fulfilled', value: [] }, { status: 'fulfilled', value: [] }, { status: 'fulfilled', value: [] }])).toBe(true);
    expect(stayReconciliationSucceeded([{ status: 'fulfilled', value: [] }, { status: 'rejected', reason: new Error('offline') }, { status: 'fulfilled', value: [] }])).toBe(false);
  });
});
