import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (name) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const overlaySource = readSource('Overlay.jsx');
const collectionTableSource = readSource('CollectionTable.jsx');
const permissionButtonSource = readSource('../auth/PermissionButton.jsx');
const actionFeedbackSource = readSource('actionFeedback.js');
const p1AtomsSource = readSource('P1Atoms.jsx');
const sharedPartsSource = readSource('../views/SharedViewParts.jsx');

describe('UI infrastructure contracts', () => {
  it('keeps dialogs and drawers accessible and restores focus', () => {
    expect(overlaySource).toContain('role="dialog"');
    expect(overlaySource).toContain('aria-modal="true"');
    expect(overlaySource).toContain('aria-labelledby={titleId}');
    expect(overlaySource).toContain('previousFocus.current?.focus?.()');
    expect(overlaySource).toContain("if (event.key === 'Escape') {");
    expect(overlaySource).toContain('event.preventDefault();');
  });

  it('supports keyboard navigation and active panel linkage for tabs', () => {
    expect(overlaySource).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(overlaySource).toContain('onChange(tabs[nextIndex].id)');
    expect(overlaySource).toContain("panel.setAttribute('aria-labelledby', activeButton.id)");
    expect(overlaySource).toContain('role="tabpanel"');
  });

  it('defines deterministic sorting and pagination boundaries', () => {
    expect(collectionTableSource).toContain('aria-sort={active ?');
    expect(collectionTableSource).toContain('onSort(column.key)');
    expect(collectionTableSource).toContain('disabled={page === 1}');
    expect(collectionTableSource).toContain('disabled={page === pageCount}');
    expect(collectionTableSource).toContain('if (!total) return null');
  });

  it('keeps row action menus keyboard-addressable', () => {
    expect(collectionTableSource).toContain("role: 'menuitem'");
    expect(collectionTableSource).toContain("tabIndex: -1");
    expect(collectionTableSource).toContain("querySelector('[role=\"menuitem\"]')");
  });

  it('exposes accessible names for compact controls', () => {
    const cashSource = readFileSync(new URL('../../cash/CashDenominationsCalculator.jsx', import.meta.url), 'utf8');
    const staffSource = readFileSync(new URL('../../views/staff/StaffAttendanceView.jsx', import.meta.url), 'utf8');
    const searchSource = readFileSync(new URL('../layout/GlobalSearch.jsx', import.meta.url), 'utf8');
    expect(cashSource).toContain('aria-label={`Cantidad de ${item.label}`}');
    expect(cashSource).toContain('aria-label={`Aumentar cantidad de ${item.label}`}');
    expect(staffSource).toContain('aria-label="Actualizar registros"');
    expect(searchSource).toContain('aria-haspopup="listbox"');
    expect(searchSource).toContain('aria-expanded={open}');
  });

  it('guards reusable actions through the permission hook', () => {
    expect(permissionButtonSource).toContain('useActionPermission(actionType, subjectType)');
    expect(permissionButtonSource).toContain('if (!allowed) return null');
    expect(permissionButtonSource).toContain('return useActionPermission(actionType, subjectType) ? children : null');
    expect(collectionTableSource).toContain('permissionForPrimaryAction(route, child.props?.children)');
  });

  it('reports rejected and successful actions through the shared feedback contract', () => {
    expect(actionFeedbackSource).toContain('if (!result.ok)');
    expect(actionFeedbackSource).toContain("'Operación rechazada'");
    expect(actionFeedbackSource).toContain("success.type || 'success'");
    expect(sharedPartsSource).toContain('permissionForAction');
    expect(sharedPartsSource).toContain('permissionForPrimaryAction');
  });

  it('exposes the complete phase 4 state and action primitive contract', () => {
    expect(p1AtomsSource).toContain('export function AsyncButton');
    expect(p1AtomsSource).toContain('aria-busy={pending}');
    expect(sharedPartsSource).toContain('export function PageShell');
    expect(sharedPartsSource).toContain('export function EmptyState');
    expect(sharedPartsSource).toContain('export function ErrorState');
    expect(sharedPartsSource).toContain('export function ResourceState');
    expect(sharedPartsSource).toContain('export function ConfirmAction');
    expect(sharedPartsSource).toContain('export function DataTable');
  });

  it('retries a failed route locally instead of reloading the whole application', () => {
    const routeBoundarySource = readFileSync(new URL('../routing/RouteErrorBoundary.jsx', import.meta.url), 'utf8');
    expect(routeBoundarySource).toContain('this.setState({ error: null })');
    expect(routeBoundarySource).toContain('this.props.onRetry?.()');
    expect(routeBoundarySource).toContain('>Reintentar módulo</button>');
    expect(routeBoundarySource).not.toContain('window.location.reload()');
  });

  it('refreshes event collections locally after mutations', () => {
    const eventsRootSource = readFileSync(new URL('../../events/EventsModuleRoot.jsx', import.meta.url), 'utf8');
    expect(eventsRootSource).toContain('const [refreshVersion, setRefreshVersion] = useState(0);');
    expect(eventsRootSource).toContain('key={`calendar-${refreshVersion}`}');
    expect(eventsRootSource).toContain('key={`list-${refreshVersion}`}');
    expect(eventsRootSource).not.toContain('window.location.reload()');
  });
});
