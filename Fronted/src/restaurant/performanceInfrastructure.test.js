import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const menuSource = readFileSync(new URL('./MenuManagementView.jsx', import.meta.url), 'utf8');

describe('performance infrastructure contracts', () => {
  it('derives catalog metrics in one memoized pass', () => {
    expect(menuSource).toContain('const menuMetrics = useMemo(() => items.reduce');
    expect(menuSource).toContain('activePriceTotal');
    expect(menuSource).toContain('const normalizedSearch = search.trim().toLowerCase();');
    expect(menuSource).toContain('[items, statusFilter, segmentFilter, categoryFilter, normalizedSearch, sortBy]');
  });
});
