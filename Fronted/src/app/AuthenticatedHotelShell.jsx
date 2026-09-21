import { HotelProvider } from '../state/HotelContext.jsx';
import HotelShell from '../components/layout/HotelShell.jsx';

export default function AuthenticatedHotelShell() {
  return <HotelProvider><HotelShell /></HotelProvider>;
}
