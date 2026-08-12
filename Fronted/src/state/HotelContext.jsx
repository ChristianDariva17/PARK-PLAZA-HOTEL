import { useLayoutEffect, useReducer, useRef } from 'react';
import { getInitialHotelState } from '../domain/hotelModel.js';
import { HotelStateContext } from './hotelContext.js';
import { hotelReducer, validateHotelAction } from './hotelReducer.js';

export function HotelProvider({ children }) {
  const [state, reducerDispatch] = useReducer(hotelReducer, undefined, getInitialHotelState);
  const projectedState = useRef(state);
  useLayoutEffect(() => {
    projectedState.current = state;
  }, [state]);
  const execute = (action) => {
    const result = validateHotelAction(projectedState.current, action);
    if (result.ok) {
      projectedState.current = hotelReducer(projectedState.current, action);
      reducerDispatch(action);
    }
    return result;
  };
  return <HotelStateContext.Provider value={{ state, dispatch: execute, execute }}>{children}</HotelStateContext.Provider>;
}
