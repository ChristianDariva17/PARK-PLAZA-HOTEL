import { useLayoutEffect, useReducer, useRef } from 'react';
import { usePermissions } from '../auth/authContext.js';
import { permissionForAction } from '../auth/permissions.js';
import { getInitialHotelState } from '../domain/hotelModel.js';
import { HotelStateContext } from './hotelContext.js';
import { hotelReducer, validateHotelAction } from './hotelReducer.js';

export function HotelProvider({ children }) {
  const { can } = usePermissions();
  const [state, reducerDispatch] = useReducer(hotelReducer, undefined, getInitialHotelState);
  const projectedState = useRef(state);
  useLayoutEffect(() => {
    projectedState.current = state;
  }, [state]);
  const execute = (action) => {
    const clientSubject = action.type === 'BIOMETRIC_ATTEMPT' && projectedState.current.clients.some((item) => item.id === action.subjectId);
    const staffSubject = action.type === 'BIOMETRIC_ATTEMPT' && projectedState.current.staff.some((item) => item.id === action.subjectId);
    const authorizedAction = action.type === 'BIOMETRIC_ATTEMPT' && clientSubject !== staffSubject
      ? { ...action, subjectType: clientSubject ? 'client' : 'employee' }
      : action;
    const requiredPermission = permissionForAction(authorizedAction);
    if (action.type === 'BIOMETRIC_ATTEMPT' && !requiredPermission) return { ok: false, error: 'No se pudo determinar el tipo de persona biométrica.' };
    if (requiredPermission && !(Array.isArray(requiredPermission) ? requiredPermission.some(can) : can(requiredPermission))) return { ok: false, error: 'No tenés permiso para realizar esta operación.' };
    const result = validateHotelAction(projectedState.current, authorizedAction);
    if (result.ok) {
      projectedState.current = hotelReducer(projectedState.current, authorizedAction);
      reducerDispatch(authorizedAction);
    }
    return result;
  };
  return <HotelStateContext.Provider value={{ state, dispatch: execute, execute }}>{children}</HotelStateContext.Provider>;
}
