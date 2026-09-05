import { PERMISSIONS } from '../auth/permissions.js';

const CREATE_PERMISSIONS = [PERMISSIONS.reservationsRead, PERMISSIONS.reservationsCreate, PERMISSIONS.roomsRead, PERMISSIONS.guestsRead];
const LIFECYCLE_PERMISSIONS = Object.freeze({ confirm: PERMISSIONS.reservationsUpdate, cancel: PERMISSIONS.reservationsCancel, disposition: PERMISSIONS.reservationsUpdate });

export const isCurrentReservationOperation = (generation, currentGeneration, signal) => generation === currentGeneration && !signal.aborted;

export const hasReservationCreateAccess = (authStatus, permissions) => authStatus === 'authenticated' && CREATE_PERMISSIONS.every((permission) => permissions?.includes(permission));

export const reservationReconciliationSucceeded = (results) => results.length === 2 && results.every((result) => result.status === 'fulfilled' && result.value !== null);
export const hasReservationLifecycleAccess = (authStatus, permissions, operation) => authStatus === 'authenticated' && Boolean(LIFECYCLE_PERMISSIONS[operation] && permissions?.includes(PERMISSIONS.reservationsRead) && permissions.includes(LIFECYCLE_PERMISSIONS[operation]));
