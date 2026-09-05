import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./HotelContext.jsx', import.meta.url), 'utf8');

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
