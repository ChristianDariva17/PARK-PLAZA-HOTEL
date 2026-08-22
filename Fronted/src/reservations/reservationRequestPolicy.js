import { PERMISSIONS } from '../auth/permissions.js';

const CREATE_PERMISSIONS = [PERMISSIONS.reservationsRead, PERMISSIONS.reservationsCreate, PERMISSIONS.roomsRead, PERMISSIONS.guestsRead];

export const isCurrentReservationOperation = (generation, currentGeneration, signal) => generation === currentGeneration && !signal.aborted;

export const hasReservationCreateAccess = (authStatus, permissions) => authStatus === 'authenticated' && CREATE_PERMISSIONS.every((permission) => permissions?.includes(permission));

export const reservationReconciliationSucceeded = (results) => results.length === 2 && results.every((result) => result.status === 'fulfilled' && result.value !== null);
