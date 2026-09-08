import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const fieldSource = source('FormField.jsx');
const atomsSource = source('P1Atoms.jsx');
const wizardSource = source('FormWizard.jsx');
const filterSource = source('FilterBar.jsx');

describe('form infrastructure contracts', () => {
  it('associates labels, controls, helpers, and errors accessibly', () => {
    expect(fieldSource).toContain('htmlFor={controlId}');
    expect(fieldSource).toContain("'aria-describedby': describedBy");
    expect(fieldSource).toContain("'aria-invalid': error ? 'true' : undefined");
    expect(fieldSource).toContain('role="alert"');
    expect(atomsSource).toContain("props['aria-describedby'], helperId, errorId");
    expect(atomsSource).toContain("aria-invalid={error ? 'true' : undefined}");
  });

  it('keeps all P1 controls on the shared form-field contract', () => {
    expect(atomsSource).toContain('<FormField label={label} required={required} helperText={helperText} error={error} className={className}>');
    expect(atomsSource).toContain('export function P1Input');
    expect(atomsSource).toContain('export function P1Select');
    expect(atomsSource).toContain('export function P1Textarea');
  });

  it('maps button variants and preserves badge attributes', () => {
    expect(atomsSource).toContain("variant === 'primary' ? 'btn-primary'");
    expect(atomsSource).toContain("variant === 'secondary' ? 'btn-outline'");
    expect(atomsSource).toContain("variant === 'danger' ? 'btn-danger'");
    expect(atomsSource).toContain('className={`p1-badge p1-badge-${variant} ${className}`}');
    expect(atomsSource).toContain('{...props}');
  });

  it('validates the current wizard step before advancing or submitting', () => {
    expect(wizardSource).toContain('const validation = current.validate?.();');
    expect(wizardSource).toContain('setStep((value) => Math.min(value + 1, steps.length - 1))');
    expect(wizardSource).toContain('if (submitting || submitDisabled) return;');
    expect(wizardSource).toContain('aria-label="Progreso del formulario"');
    expect(wizardSource).toContain('aria-label="Resumen persistente del formulario"');
  });

  it('exposes filter controls as a labelled search region', () => {
    expect(filterSource).toContain('role="search"');
    expect(filterSource).toContain('aria-label={label}');
    expect(filterSource).toContain('className={`filter-bar ${className}`.trim()}');
  });

  it('keeps real filter consumers controlled and resets pagination on changes', () => {
    const inventorySource = readFileSync(new URL('../views/CoreViews.jsx', import.meta.url), 'utf8');
    const auditSource = readFileSync(new URL('../../documents/views/AuditView.jsx', import.meta.url), 'utf8');

    expect(inventorySource).toContain('<FilterBar label="Filtros de inventario">');
    expect(inventorySource).toContain('value={query}');
    expect(inventorySource).toContain('value={category}');
    expect(auditSource).toContain('<FilterBar label="Filtros de auditoría">');
    expect(auditSource).toContain('setPage(1)');
    expect(auditSource).toContain('setFilters(f => ({ ...f, search: e.target.value }))');
  });

  it('keeps shared action and status atoms wired into real feature views', () => {
    const ordersSource = readFileSync(new URL('../views/orders/OrdersView.jsx', import.meta.url), 'utf8');
    const eventsSource = readFileSync(new URL('../../events/EventsListView.jsx', import.meta.url), 'utf8');

    expect(ordersSource).toContain('P1Button');
    expect(ordersSource).toContain('<P1Button');
    expect(eventsSource).toContain('import { P1Badge }');
    expect(eventsSource).toContain('<P1Badge');
  });
});
