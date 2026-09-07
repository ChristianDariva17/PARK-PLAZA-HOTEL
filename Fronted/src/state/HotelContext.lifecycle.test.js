import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./HotelContext.jsx', import.meta.url), 'utf8');
const contextSource = readFileSync(new URL('./hotelContext.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');

describe('HotelContext reservation lifecycle wiring', () => {
  it('uses a generation-guarded, abortable command runner with server reconciliation', () => {
    expect(source).toContain('const reservationLifecycleCommand = useCallback');
    expect(source).toContain('reservationLifecycleControllerRef.current?.abort()');
    expect(source).toContain('const controller = new AbortController()');
    expect(source).toContain('adaptReservationCommandResponse(await request)');
    expect(source).toContain('await reloadReservations()');
    expect(source).toContain('const loadReservationDetail = useCallback');
  });
});

describe('HotelContext shell state isolation', () => {
  it('publishes a stable shell slice instead of subscribing the shell to every domain', () => {
    expect(contextSource).toContain('HotelShellStateContext');
    expect(contextSource).toContain('HotelSearchStateContext');
    expect(contextSource).toContain('useHotelShellState');
    expect(contextSource).toContain('useHotelSearchState');
    expect(source).toContain('const shellState = useMemo');
    expect(source).toContain('const searchState = useMemo');
    expect(source).toContain('HotelShellStateContext.Provider value={shellState}');
    expect(appSource).toContain('const shellState = useHotelShellState()');
    expect(appSource).not.toContain('state={state}');
    expect(appSource).toContain("useWebSocketEvents(['room:updated', 'room:status_changed', 'room:category_updated']");
    expect(appSource).toContain('roomReloadTimerRef');
  });
});
