import { createContext, useContext } from 'react';

export const HotelStateContext = createContext(null);
export const HotelCommandsContext = createContext(null);
export const HotelShellStateContext = createContext(null);
export const HotelSearchStateContext = createContext(null);

export function useHotel() {
  const state = useContext(HotelStateContext);
  const commands = useContext(HotelCommandsContext);
  if (!state || !commands) throw new Error('useHotel debe utilizarse dentro de HotelProvider');
  return { state, ...commands };
}

export function useHotelCommands() {
  const commands = useContext(HotelCommandsContext);
  if (!commands) throw new Error('useHotelCommands debe utilizarse dentro de HotelProvider');
  return commands;
}

export function useHotelShellState() {
  const state = useContext(HotelShellStateContext);
  if (!state) throw new Error('useHotelShellState debe utilizarse dentro de HotelProvider');
  return state;
}

export function useHotelSearchState() {
  const state = useContext(HotelSearchStateContext);
  if (!state) throw new Error('useHotelSearchState debe utilizarse dentro de HotelProvider');
  return state;
}
