import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const fieldSource = source('FormField.jsx');
const atomsSource = source('P1Atoms.jsx');
const wizardSource = source('FormWizard.jsx');
const filterSource = source('FilterBar.jsx');
const sharedViewSource = readFileSync(new URL('../views/SharedViewParts.jsx', import.meta.url), 'utf8');

describe('form infrastructure contracts', () => {
  it('associates labels, controls, helpers, and errors accessibly', () => {
    expect(fieldSource).toContain('htmlFor={controlId}');
    expect(fieldSource).toContain("'aria-describedby': describedBy");
    expect(fieldSource).toContain("'aria-invalid': error ? 'true' : undefined");
    expect(fieldSource).toContain('role="alert"');
    expect(atomsSource).toContain('<FormField label={label} required={required} helperText={helperText} error={error} className={className}>');
    expect(atomsSource).not.toContain('const helperId');
    expect(atomsSource).not.toContain('const errorId');
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

  it('moves focus to wizard errors so validation failures are operable', () => {
    expect(wizardSource).toContain('const errorRef = useRef(null);');
    expect(wizardSource).toContain('errorRef.current?.focus()');
    expect(wizardSource).toContain('tabIndex="-1"');
  });

  it('exposes filter controls as a labelled search region', () => {
    expect(filterSource).toContain('role="search"');
    expect(filterSource).toContain('aria-label={label}');
    expect(filterSource).toContain('className={`filter-bar ${className}`.trim()}');
  });

  it('exposes one shared confirmation contract with busy-state semantics', () => {
    expect(sharedViewSource).toContain('export function ConfirmAction');
    expect(sharedViewSource).toContain('onConfirm');
    expect(sharedViewSource).toContain('aria-busy={busy}');
  });

  it('keeps real filter consumers controlled and resets pagination on changes', () => {
    const inventorySource = readFileSync(new URL('../../inventory/InventoryView.jsx', import.meta.url), 'utf8');
    const auditSource = readFileSync(new URL('../../documents/views/AuditView.jsx', import.meta.url), 'utf8');

    expect(inventorySource).toContain("<FilterBar label=\"Filtros de inventario\" className=\"inventory-filter-toolbar\">");
    expect(inventorySource).toContain('value={query}');
    expect(inventorySource).toContain("setSegment('todos')");
    expect(inventorySource).toContain('value={statusFilter}');
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

  it('uses the shared filter region in operational feature consumers', () => {
    const consumers = [
      ['../../parking/ParkingView.jsx', '<FilterBar label="Filtros de cochera">'],
      ['../../pets/PetsView.jsx', '<FilterBar label="Filtros de mascotas">'],
      ['../views/customers/CustomersView.jsx', '<FilterBar label="Filtros de clientes">'],
      ['../views/reservations/ReservationsView.jsx', '<FilterBar label="Filtros de reservas">'],
      ['../../amenities/RecreationView.jsx', '<FilterBar label="Filtros de recreación">'],
      ['../views/rooms/RoomsView.jsx', '<FilterBar label="Filtros de habitaciones" className="rooms-filter-bar">'],
      ['../../suppliers/SuppliersListView.jsx', '<FilterBar label="Filtros de proveedores" className="supplier-element-variant-a-extended">'],
      ['../../receivables/ReceivablesView.jsx', '<FilterBar label="Filtros de cuentas por cobrar" className="menu-row8">'],
      ['../../restaurant/MenuManagementView.jsx', '<FilterBar label="Filtros del menú" className="menu-surface-secondary69">'],
      ['../../documents/views/EvidenceView.jsx', '<FilterBar label="Filtros de evidencias" className="evidence-filter-bar">'],
      ['../../documents/views/ContractsView.jsx', '<FilterBar label="Filtros de contratos" className="contracts-filter-bar">'],
      ['../../maintenance/MaintenanceView.jsx', '<FilterBar label="Filtros de mantenimiento" className="custom-filter-bar">'],
      ['../../incidents/IncidentsView.jsx', '<FilterBar label="Filtros de incidencias" className="custom-filter-bar">'],
      ['../../events/EventCalendarView.jsx', '<FilterBar label="Filtros del calendario de eventos" className="events-filter-bar">'],
      ['../../communications/NotificationsView.jsx', '<FilterBar label="Filtros de notificaciones" className="notifications-filter-bar">'],
    ];

    for (const [path, contract] of consumers) {
      expect(readFileSync(new URL(path, import.meta.url), 'utf8')).toContain(contract);
    }
  });
});
