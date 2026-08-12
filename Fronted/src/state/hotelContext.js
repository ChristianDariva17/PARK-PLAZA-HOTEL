import { createContext, useContext } from 'react';

export const HotelStateContext = createContext(null);

export function useHotel() {
  const context = useContext(HotelStateContext);
  if (!context) throw new Error('useHotel debe utilizarse dentro de HotelProvider');
  return context;
}
