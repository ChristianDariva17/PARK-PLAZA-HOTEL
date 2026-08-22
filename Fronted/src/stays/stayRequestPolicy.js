import { PERMISSIONS } from '../auth/permissions.js';

const CHECK_IN_PERMISSIONS = [PERMISSIONS.staysRead, PERMISSIONS.staysCheckIn, PERMISSIONS.reservationsRead, PERMISSIONS.roomsRead, PERMISSIONS.guestsRead];
const CHECK_OUT_PERMISSIONS = [PERMISSIONS.staysRead, PERMISSIONS.staysCheckOut, PERMISSIONS.reservationsRead, PERMISSIONS.roomsRead];

export const isCurrentStayOperation = (generation, currentGeneration, signal) => generation === currentGeneration && !signal.aborted;
export const hasStayCheckInAccess = (status, permissions) => status === 'authenticated' && CHECK_IN_PERMISSIONS.every((permission) => permissions?.includes(permission));
export const hasStayCheckOutAccess = (status, permissions) => status === 'authenticated' && CHECK_OUT_PERMISSIONS.every((permission) => permissions?.includes(permission));
export const stayReconciliationSucceeded = (results) => results.length === 3 && results.every((result) => result.status === 'fulfilled' && result.value !== null);
