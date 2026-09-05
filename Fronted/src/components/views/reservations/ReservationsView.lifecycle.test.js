import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./ReservationsView.jsx', import.meta.url), 'utf8');

describe('ReservationsView lifecycle detail contract', () => {
  it('renders authoritative detail and only invokes server-projected lifecycle actions', () => {
    expect(source).toContain('reservationCommands.detail(selectedId)');
    expect(source).toContain('detail.permittedActions.includes(\'confirm\')');
    expect(source).toContain('detail.permittedActions.includes(\'cancel\')');
    expect(source).toContain('detail.permittedActions.includes(\'disposition\')');
    expect(source).toContain('!lifecycle.reason.trim()');
    expect(source).toContain("{ reason: lifecycle.reason, disposition: lifecycle.disposition }");
    expect(source).toContain('result.replayed');
  });
});
