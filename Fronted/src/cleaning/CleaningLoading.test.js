import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const cleaningViewSource = readFileSync(new URL('./CleaningView.jsx', import.meta.url), 'utf8');

describe('Cleaning initial loading contract', () => {
  it('uses a structural accessible skeleton before tasks are available', () => {
    expect(cleaningViewSource).toContain('function CleaningLoadingSkeleton()');
    expect(cleaningViewSource).toContain('Cargando tareas de limpieza...');
    expect(cleaningViewSource).toContain('loadingFallback={<CleaningLoadingSkeleton />}');
  });
});
