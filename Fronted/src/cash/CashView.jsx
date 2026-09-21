import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, Clock, DollarSign, Eye, Filter, Lock, Plus, Receipt, Search, ShieldAlert, SlidersHorizontal, Sparkles, TrendingDown, TrendingUp, Unlock } from 'lucide-react';
import { formatMoney } from '../domain/hotelModel';
import { useHotel } from '../state/hotelContext';
import { CashDenominationsCalculator } from '../cash/CashDenominationsCalculator.jsx';
import { CashZReportModal } from '../cash/CashZReportModal.jsx';
import { CashMovementEnhancedForm } from '../cash/CashMovementEnhancedForm.jsx';
import { PermissionButton } from '../components/auth/PermissionButton';
import { useActionPermission } from '../components/auth/useActionPermission';
import { Dialog } from '../components/ui/Overlay';
import { ResourceState, StatusBadge } from '../components/views/SharedViewParts';

const displayDateTime = (value) => value ? new Date(value).toLocaleString('es-PE') : 'No registrado';

export function CashOpenForm({ onClose, notify }) {
  const { state, cashCommands } = useHotel();
  const allowed = useActionPermission('CASH_OPEN');
  const activeStaff = (state?.staff || []).filter((item) => item.status === 'Activo');
  const [isManual, setIsManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    responsible: activeStaff[0]?.name || '',
    shift: 'Mañana',
    openingAmount: 0,
    notes: ''
  });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!form.responsible?.trim()) {
      notify('Dato requerido', 'Debe seleccionar o indicar el responsable del turno.', 'error');
      return;
    }
    if (!Number.isFinite(Number(form.openingAmount)) || Number(form.openingAmount) < 0) {
      notify('Monto inválido', 'El fondo inicial debe ser un monto válido igual o mayor a S/ 0.00.', 'error');
      return;
    }
    if (cashCommands) {
      setBusy(true);
      try {
        await cashCommands.open(form);
        notify('Caja abierta', 'El turno quedó disponible para registrar movimientos.', 'success');
        onClose();
      } catch (error) {
        notify('Error al abrir caja', error.message, 'error');
      } finally {
        setBusy(false);
      }
    }
  };
  if (!allowed) return null;
  return (
    <form className="form-grid" onSubmit={submit} aria-busy={busy}>
      <label className="span-2">
        Encargado / Responsable de Caja *
        {!isManual && activeStaff.length > 0 ? (
          <div className="cash-responsible-row">
            <select
              required
              value={form.responsible}
              onChange={(e) => {
                if (e.target.value === '__manual__') {
                  setIsManual(true);
                  set('responsible', '');
                } else {
                  set('responsible', e.target.value);
                }
              }}
              className="cash-responsible-select"
            >
              <option value="">-- Seleccionar encargado del personal --</option>
              {activeStaff.map((person) => (
                <option key={person.id} value={person.name}>
                  {person.name} ({person.role} · {person.area})
                </option>
              ))}
              <option value="__manual__">➕ Ingresar otro nombre manualmente...</option>
            </select>
          </div>
        ) : (
          <div className="cash-responsible-manual">
            <input
              required
              autoFocus
              placeholder="Nombre del encargado o cajero..."
              value={form.responsible}
              onChange={(event) => set('responsible', event.target.value)}
            />
            {activeStaff.length > 0 && (
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={() => {
                  setIsManual(false);
                  set('responsible', activeStaff[0]?.name || '');
                }}
              >
                Elegir de lista
              </button>
            )}
          </div>
        )}
      </label>
      <label>
        Turno
        <select value={form.shift} onChange={(event) => set('shift', event.target.value)}>
          <option>Mañana</option>
          <option>Tarde</option>
          <option>Noche</option>
        </select>
      </label>
      <label>
        Fondo inicial
        <input
          type="number"
          min="0"
          step="any"
          value={form.openingAmount}
          onChange={(event) => set('openingAmount', event.target.value)}
        />
      </label>
      <label className="span-2">
        Notas
        <textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} />
      </label>
      <div className="form-actions span-2">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Abriendo...' : 'Abrir caja'}</button>
      </div>
    </form>
  );
}

export function CashCountForm({ close, expected, onClose, onSessionClosed, notify }) {
  const { state, cashCommands } = useHotel();
  const allowed = useActionPermission(close ? 'CASH_CLOSE' : 'CASH_COUNT');
  const [mode, setMode] = useState('calculator'); // 'calculator' | 'manual'
  const [blindMode, setBlindMode] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [countedAmount, setCountedAmount] = useState(expected);
  const [breakdownSummary, setBreakdownSummary] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const difference = Number(countedAmount) - expected;
  const isDiscrepancy = Math.abs(difference) >= 5.00;

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (cashCommands) {
      if (!Number.isFinite(Number(countedAmount)) || Number(countedAmount) < 0) {
        notify('Monto inválido', 'El efectivo contado debe ser un monto válido igual o mayor a S/ 0.00.', 'error');
        return;
      }
      const openSession = state.cashSessions.find((item) => item.status === 'Abierta');
      if (!openSession) {
        notify('Error', 'No hay ninguna sesión de caja abierta activa.', 'error');
        return;
      }

      if (isDiscrepancy && (!note || note.trim().length < 5)) {
        notify(
          'Justificación obligatoria',
          `Existe un descuadre de ${formatMoney(difference)} (mayor a S/ 5.00). Ingrese el motivo detallado en Observaciones para continuar.`,
          'error'
        );
        return;
      }

      setBusy(true);
      try {
        const fullNote = [
          note?.trim(),
          blindMode ? '[Arqueo Ciego Verificado]' : null,
          breakdownSummary ? `[Conteo Físico PEN: ${breakdownSummary}]` : null,
        ].filter(Boolean).join(' · ');

        if (close) {
          const closed = await cashCommands.close(openSession.id, { countedAmount: Number(countedAmount), note: fullNote });
          notify('Caja cerrada', 'La sesión quedó cerrada con arqueo y desglose registrado.', 'success');
          onClose();
          if (onSessionClosed) {
            onSessionClosed(closed || {
              ...openSession,
              status: 'Cerrada',
              countedAmount: Number(countedAmount),
              expectedAmount: expected,
              difference,
              notes: fullNote,
              closedAt: new Date().toISOString(),
            });
          }
        } else {
          await cashCommands.count(openSession.id, { countedAmount: Number(countedAmount), note: fullNote });
          notify('Arqueo registrado', 'Se guardaron el desglose físico, monto esperado y diferencia.', 'success');
          onClose();
        }
      } catch (error) {
        notify('Error al procesar arqueo/cierre', error.message, 'error');
      } finally {
        setBusy(false);
      }
    }
  };

  if (!allowed) return null;

  return (
    <form className="form-grid cash-count-form" onSubmit={submit} aria-busy={busy}>
      {/* Pestañas de modo y control de Arqueo Ciego */}
      <div className="cash-count-mode-bar">
        <div className="cash-count-mode-tabs">
          <button
            type="button"
            className={`btn btn-sm ${mode === 'calculator' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setMode('calculator')}
          >
            Desglose Billetes y Monedas (PEN)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'manual' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setMode('manual')}
          >
            Monto directo
          </button>
        </div>

        <button
          type="button"
          className={`btn btn-sm ${blindMode ? 'btn-primary' : 'btn-outline'} cash-blind-toggle ${blindMode ? 'blind-mode-active' : ''}`}
          onClick={() => {
            setBlindMode(!blindMode);
            setRevealed(false);
          }}
          title="El modo ciego oculta el saldo teórico del sistema para evitar sesgos durante el conteo físico"
        >
          {blindMode ? <Lock size={14} /> : <Unlock size={14} />}
          <span>{blindMode ? 'Arqueo Ciego Activo' : 'Activar Arqueo Ciego'}</span>
        </button>
      </div>

      {mode === 'calculator' ? (
        <CashDenominationsCalculator
          onChange={(total) => setCountedAmount(total)}
          onSummaryChange={(summary) => setBreakdownSummary(summary)}
        />
      ) : (
        <label className="span-2">
          Monto contado en efectivo
          <input
            type="number"
            min="0"
            step="any"
            value={countedAmount}
            onChange={(event) => setCountedAmount(event.target.value)}
          />
        </label>
      )}

      {/* Tarjeta de Comparativa y Cuadre (Soporta Arqueo Ciego) */}
      {blindMode && !revealed ? (
        <div className="cash-blind-panel">
          <div className="cash-blind-heading">
            <Lock size={16} />
            <span>Modo Arqueo Ciego Activo (Control Antifraude)</span>
          </div>
          <div className="cash-blind-description">
            El saldo esperado y el cuadre se mantienen ocultos para garantizar un conteo objetivo en gaveta.
          </div>
          <div className="cash-blind-summary">
            <span className="cash-counted-amount">
              Efectivo Contado: <strong className="cash-counted-amount-value">{formatMoney(Number(countedAmount) || 0)}</strong>
            </span>
            <button
              type="button"
              className="btn btn-xs btn-outline cash-reveal-action"
              onClick={() => setRevealed(true)}
            >
              <Eye size={13} />
              <span>Revelar Cuadre</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="cash-reconciliation">
          <div>
            <span className="cash-reconciliation-label">Esperado en Sistema</span>
            <strong className="cash-reconciliation-expected">{formatMoney(expected)}</strong>
          </div>
          <div>
            <span className="cash-reconciliation-label">Total Contado Físico</span>
            <strong className="cash-reconciliation-counted">{formatMoney(Number(countedAmount) || 0)}</strong>
          </div>
          <div>
            <span className="cash-reconciliation-label">Diferencia / Cuadre</span>
            <strong className={`cash-reconciliation-difference ${Math.abs(difference) < 0.01 ? 'difference-exact' : difference > 0 ? 'difference-surplus' : 'difference-shortage'}`}>
              {Math.abs(difference) < 0.01
                ? 'Exacto (S/ 0.00)'
                : difference > 0
                ? `Sobrante (+${formatMoney(difference)})`
                : `Faltante (${formatMoney(difference)})`}
            </strong>
          </div>
        </div>
      )}

      {/* Alerta de Descuadre Significativo */}
      {isDiscrepancy && (
        <div className="cash-discrepancy-alert">
          <AlertTriangle size={16} />
          <span>
            Descuadre de {formatMoney(difference)} detectado. Por política hotelera, debe ingresar una justificación detallada antes de cerrar.
          </span>
        </div>
      )}

      <label className="span-2">
        <span className="cash-notes-label">
          Observaciones o justificación {isDiscrepancy ? '⚠️ (OBLIGATORIO por descuadre >= S/ 5.00)' : Math.abs(difference) >= 0.01 ? '(Recomendado)' : '(Opcional)'}
        </span>
        <textarea
          value={note}
          required={isDiscrepancy}
          placeholder="Ej: Conteo físico verificado en gaveta. Descuadre atribuible a..."
          onChange={(event) => setNote(event.target.value)}
         className="cash-notes-input" />
      </label>

      <div className="form-actions span-2 cash-count-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" type="submit" disabled={busy} aria-busy={busy}>{busy ? 'Procesando...' : close ? 'Cerrar caja' : 'Guardar arqueo'}</button>
      </div>
    </form>
  );
}

function getShiftElapsed(openedAt) {
  if (!openedAt) return '';
  const ms = Date.now() - new Date(openedAt).getTime();
  if (ms < 0) return 'Recién iniciado';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days > 0) return `${days}d ${remHours}h activo`;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m activo`;
}

function CashLoadingSkeleton() {
  return (
    <div className="cash-loading-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando información de caja.</span>
      <div className="cash-loading-skeleton-header" aria-hidden="true">
        <span className="loading-skeleton loading-skeleton-kicker" />
        <span className="loading-skeleton loading-skeleton-title" />
        <span className="loading-skeleton loading-skeleton-description" />
      </div>
      <div className="cash-loading-skeleton-grid" aria-hidden="true">
        <div className="cash-loading-skeleton-card">
          <span className="loading-skeleton loading-skeleton-line loading-skeleton-line-short" />
          <span className="loading-skeleton loading-skeleton-line loading-skeleton-line-long" />
          <span className="loading-skeleton loading-skeleton-block" />
          <span className="loading-skeleton loading-skeleton-block loading-skeleton-block-small" />
        </div>
        <div className="cash-loading-skeleton-card">
          <span className="loading-skeleton loading-skeleton-line loading-skeleton-line-medium" />
          <span className="loading-skeleton loading-skeleton-table-row" />
          <span className="loading-skeleton loading-skeleton-table-row" />
          <span className="loading-skeleton loading-skeleton-table-row" />
        </div>
      </div>
    </div>
  );
}

export function OperationalCashView({ notify }) {
  const { state, cashCommands } = useHotel();
  const [dialog, setDialog] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [reportSession, setReportSession] = useState(null);
  const [movementPreset, setMovementPreset] = useState(null);
  const [movementFilter, setMovementFilter] = useState('ALL'); // 'ALL' | 'INGRESO' | 'EGRESO' | 'CASH_DROP'
  const [movementSearch, setMovementSearch] = useState('');
  const cashRequest = state.cashRequest || { status: 'idle', error: null };
  const hasCashData = state.cashSessions.length > 0 || state.cashMovements.length > 0;
  const cashResourceStatus = cashRequest.status === 'error'
    ? hasCashData ? 'refreshing' : 'error'
    : cashRequest.status === 'loading'
      ? hasCashData ? 'refreshing' : 'loading'
      : cashRequest.status === 'success' ? 'success' : 'loading';
  const retryCash = () => Promise.resolve(cashCommands?.reload?.()).catch(() => {});

  const openSession = state.cashSessions.find((item) => item.status === 'Abierta');
  const session = state.cashSessions.find((item) => item.id === selectedSessionId) || openSession || state.cashSessions[0];

  useEffect(() => {
    if (session?.id) cashCommands?.loadDetails(session.id).catch(() => {});
  }, [cashCommands, session?.id]);

  const sessionMovements = state.cashMovements.filter((item) => item.sessionId === session?.id);
  const movements = [
    ...state.cashSessions.map((item) => ({
      id: item.id,
      createdAt: item.openedAt,
      type: 'Sesión',
      concept: <button className="btn btn-sm btn-outline" onClick={() => setSelectedSessionId(item.id)}>{session?.id === item.id ? 'Sesión seleccionada' : 'Ver sesión completa'}</button>,
      referenceId: `${item.status} · Cierre ${displayDateTime(item.closedAt)} · Esperado ${item.expectedAmount == null ? 'Pendiente' : formatMoney(item.expectedAmount)} · Contado ${item.countedAmount == null ? 'Pendiente' : formatMoney(item.countedAmount)} · Diferencia ${item.difference == null ? 'Pendiente' : formatMoney(item.difference)} · ${item.notes || 'Sin notas'}`,
      method: item.shift,
      responsible: item.responsible,
      amount: item.expectedAmount ?? item.openingAmount,
    })),
    ...sessionMovements,
  ];

  const cashMovements = sessionMovements.filter((item) => item.method === 'Efectivo');
  const incomeMovements = cashMovements.filter((item) => item.type === 'Ingreso');
  const expenseMovements = cashMovements.filter((item) => item.type === 'Egreso');
  const income = incomeMovements.reduce((sum, item) => sum + item.amount, 0);
  const expenses = expenseMovements.reduce((sum, item) => sum + item.amount, 0);
  const expected = (session?.openingAmount || 0) + income - expenses;

  // Límite de seguridad en recepción (Cash Drop recommendation)
  const CASH_SAFETY_LIMIT = 2000;
  const isCashExceeded = openSession && expected > CASH_SAFETY_LIMIT;
  const cashLimitPercentage = Math.min(Math.round((expected / CASH_SAFETY_LIMIT) * 100), 100);

  const handleTriggerCashDrop = () => {
    const suggestedDrop = Math.max(Math.floor((expected - (openSession?.openingAmount || 500)) / 50) * 50, 100);
    setMovementPreset({
      type: 'Egreso',
      category: 'Pase a Bóveda / Caja Fuerte (Cash Drop)',
      concept: 'Remesa de seguridad a caja fuerte por exceso de efectivo en mostrador',
      amount: suggestedDrop,
      voucherType: 'Vale de Egreso / Remesa',
      voucherNumber: `REM-${new Date().toLocaleDateString('es-PE').replace(/\//g, '')}-${Math.floor(Math.random() * 900 + 100)}`
    });
    setDialog('movement');
  };

  // Filtrado y búsqueda de movimientos
  const displayedMovements = movements.filter((item) => {
    if (movementFilter === 'INGRESO' && item.type !== 'Ingreso') return false;
    if (movementFilter === 'EGRESO' && item.type !== 'Egreso') return false;
    if (movementFilter === 'CASH_DROP') {
      const c = String(typeof item.concept === 'string' ? item.concept : '').toLowerCase();
      if (!c.includes('bóveda') && !c.includes('drop') && !c.includes('remesa')) return false;
    }
    if (movementSearch.trim()) {
      const term = movementSearch.toLowerCase();
      const c = String(typeof item.concept === 'string' ? item.concept : '').toLowerCase();
      const r = String(item.referenceId || '').toLowerCase();
      const resp = String(item.responsible || '').toLowerCase();
      if (!c.includes(term) && !r.includes(term) && !resp.includes(term)) return false;
    }
    return true;
  });

  const isLongShift = openSession && (Date.now() - new Date(openSession.openedAt).getTime()) > 12 * 60 * 60 * 1000;

  return (
    <ResourceState status={cashResourceStatus} error={cashRequest.error} onRetry={retryCash} loadingFallback={<CashLoadingSkeleton />} emptyTitle="Caja sin sesiones" emptyDescription="Todavía no hay turnos de caja registrados.">
    <div className="view-container cash-dashboard">
      {cashRequest.status === 'error' && hasCashData ? <div className="alert-banner alert-banner-danger" role="alert"><span>{cashRequest.error}</span> <button type="button" className="btn btn-sm btn-outline" onClick={retryCash}>Reintentar</button></div> : null}

      {/* Encabezado Ejecutivo Limpio (Sin duplicidades) */}
      <div className="cash-dashboard-header">
        <div>
          <div className="cash-dashboard-kicker">
            <span className="cash-dashboard-brand">
              Park Plaza · Front Desk & POS
            </span>
            <span className="cash-dashboard-module">
              Módulo de Tesorería & Caja
            </span>
          </div>
          <h2 className="cash-dashboard-title">
            Control de Caja & Turnos
          </h2>
          <p className="cash-dashboard-description">
            Apertura por turno, movimientos categorizados, arqueo ciego, control de remesas e historial auditable.
          </p>
        </div>

        {/* Chip de Estado en la esquina superior derecha */}
        <div className="cash-session-status">
          {openSession ? (
            <div className="cash-session-status-active">
              <span  className="cash-session-status-dot" />
              <div>
                <strong className="cash-session-status-title">
                  Turno Activo: {openSession.shift}
                </strong>
                <span className="cash-session-status-responsible">
                  Responsable: {openSession.responsible}
                </span>
              </div>
            </div>
          ) : (
            <div className="cash-session-status-closed">
              <span  className="cash-session-status-closed-dot" />
              <strong className="cash-session-status-closed-title">Caja Cerrada</strong>
            </div>
          )}
        </div>
      </div>

      {/* Workspace Principal en 2 Columnas */}
      <div className="cash-dashboard-grid cash-workspace">
        {/* ============================================================ */}
        {/* COLUMNA 1: Panel de Control del Turno y Botonera (Izquierda) */}
        {/* ============================================================ */}
        <div className="cash-shift-column">
          {openSession ? (
            <div className="cash-shift-card">
              {/* Resplandor decorativo dorado de fondo */}
              <div  className="cash-shift-decoration" />

              {/* Cabecera del Turno con Avatar */}
              <div className="cash-shift-header">
                <div className="cash-shift-identity">
                  <div className="cash-shift-avatar">
                    {openSession.responsible?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div>
                    <div className="cash-shift-role">
                      Cajero en Turno
                    </div>
                    <strong className="cash-shift-responsible">
                      {openSession.responsible}
                    </strong>
                  </div>
                </div>

                <span className="cash-shift-badge">
                  <span  className="cash-shift-badge-dot" />
                  {openSession.shift}
                </span>
              </div>

              {/* Tiempo Transcurrido del Turno */}
              <div className="cash-shift-duration">
                <div className="cash-shift-opened">
                  <Clock size={14} color="#f59e0b" />
                  <span>Apertura: {displayDateTime(openSession.openedAt)}</span>
                </div>
                <strong className="cash-shift-elapsed">
                  {getShiftElapsed(openSession.openedAt)}
                </strong>
              </div>

              {isLongShift && (
                <div className="cash-long-shift-alert">
                  <AlertTriangle size={14} />
                  <span>Turno prolongado (+12h). Se sugiere realizar el arqueo y cierre.</span>
                </div>
              )}

              {/* Barra de Límite de Seguridad en Gaveta (Gauge) */}
              <div className="cash-safety-gauge">
                <div className="cash-safety-gauge-header">
                  <span className="cash-safety-label">Límite de Mostrador</span>
                  <span className="cash-safety-values">
                    {formatMoney(expected)} / {formatMoney(CASH_SAFETY_LIMIT)}
                  </span>
                </div>
                <div className="cash-safety-track">
                  <div
                    className={`cash-safety-progress ${isCashExceeded ? 'is-exceeded' : ''}`}
                    style={{ '--cash-safety-width': `${cashLimitPercentage}%` }}
                  />
                </div>
                {isCashExceeded ? (
                  <div className="cash-safety-alert">
                    <ShieldAlert size={12} />
                    <span>Excedente en gaveta. Realice un pase a bóveda.</span>
                  </div>
                ) : (
                  <div className="cash-safety-status">
                    Nivel de efectivo seguro en mostrador ({cashLimitPercentage}%)
                  </div>
                )}
              </div>

              {/* Botonera Operativa Integrada */}
              <div className="cash-quick-actions">
                <div className="cash-quick-actions-title">
                  Acciones Rápidas
                </div>

                <div className="cash-primary-actions">
                  <PermissionButton
                    actionType="CASH_MOVEMENT"
                    className="btn btn-sm btn-primary cash-movement-action"
                    onClick={() => { setMovementPreset(null); setDialog('movement'); }}
                  >
                    <Plus size={15} />
                    <span>Movimiento</span>
                  </PermissionButton>

                  <PermissionButton
                    actionType="CASH_COUNT"
                    className="btn btn-sm btn-outline cash-count-action"
                    onClick={() => setDialog('count')}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Arqueo</span>
                  </PermissionButton>
                </div>

                <div className="cash-secondary-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline cash-ticket-action"
                    onClick={() => setReportSession(session)}
                    title="Ver / Imprimir Comprobante Corte Z"
                  >
                    <Receipt size={14} />
                    <span>Ticket Z</span>
                  </button>

                  <PermissionButton
                    actionType="CASH_CLOSE"
                    className="btn btn-sm btn-outline cash-close-action"
                    onClick={() => setDialog('close')}
                  >
                    <Lock size={14} />
                    <span>Cerrar caja</span>
                  </PermissionButton>
                </div>

                {isCashExceeded && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary cash-drop-action"
                    onClick={handleTriggerCashDrop}
                    title="Realizar pase de remesa a bóveda por exceso de efectivo en gaveta"
                  >
                    <ShieldAlert size={15} />
                    <span>Pase a Bóveda (Cash Drop)</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="cash-closed-state">
              <div className="cash-closed-icon">
                <Lock size={26} />
              </div>
              <h3 className="cash-closed-title">
                Caja Cerrada
              </h3>
              <p className="cash-closed-description">
                No hay ningún turno activo. Inicie un nuevo turno para admitir ingresos y egresos de mostrador.
              </p>
              <PermissionButton actionType="CASH_OPEN" className="btn btn-primary cash-open-action" onClick={() => setDialog('open')}>
                Abrir nuevo turno de caja
              </PermissionButton>
            </div>
          )}

          {/* Tarjeta Informativa de Atajos & Control */}
          <div className="cash-policy-card">
            <div className="cash-policy-title">
              <Sparkles size={15} color="#d97706" />
              <span>Políticas Operativas de Turno</span>
            </div>
            <div className="cash-policy-list">
              <div>• <strong>Arqueo ciego obligatorio:</strong> Realice conteo sin condicionamiento de saldo.</div>
              <div>• <strong>Tope de seguridad:</strong> Máx {formatMoney(CASH_SAFETY_LIMIT)} en gaveta física.</div>
              <div>• <strong>Corte Z:</strong> Entregar ticket impreso y firmado al relevo o supervisor.</div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* COLUMNA 2: Centro Financiero y Movimientos en Vivo (Derecha) */}
        {/* ============================================================ */}
        <div className="cash-finance-column">
          {/* Banner de Seguridad por Exceso de Efectivo (Cash Drop) */}
          {isCashExceeded && (
            <div className="cash-drop-banner">
              <div className="cash-drop-content">
                <div className="cash-drop-icon">
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <strong className="cash-drop-title">
                    Límite de seguridad en mostrador alcanzado (Saldo en gaveta: {formatMoney(expected)})
                  </strong>
                  <span className="cash-drop-description">
                    El saldo en efectivo excede el límite recomendado de {formatMoney(CASH_SAFETY_LIMIT)}. Realice un pase de remesa a bóveda (Cash Drop) para minimizar riesgos.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary cash-drop-action-primary"
                onClick={handleTriggerCashDrop}
              >
                <ShieldAlert size={15} />
                <span>Pase a Bóveda Ahora</span>
              </button>
            </div>
          )}

          {/* Barra de KPIs Financieros 5 Estrellas (High Contrast & Luxury) */}
          <div className="cash-kpi-grid">
            {/* KPI 1: Fondo Inicial */}
            <div className="cash-kpi-card-initial">
              <div className="cash-kpi-header">
                <span className="cash-kpi-label-initial">
                  Fondo Inicial
                </span>
                <div className="cash-kpi-icon-initial">
                  <Building2 size={15} />
                </div>
              </div>
              <strong className="cash-kpi-value-initial">
                {formatMoney(session?.openingAmount)}
              </strong>
              <span className="cash-kpi-meta-initial">Fondo base en apertura</span>
            </div>

            {/* KPI 2: Ingresos del Turno */}
            <div className="cash-kpi-card-income">
              <div className="cash-kpi-header">
                <span className="cash-kpi-label-income">
                  Ingresos Turno
                </span>
                <div className="cash-kpi-icon-income">
                  <TrendingUp size={15} />
                </div>
              </div>
              <strong className="cash-kpi-value-income">
                +{formatMoney(income)}
              </strong>
              <span className="cash-kpi-meta-income">
                {incomeMovements.length} {incomeMovements.length === 1 ? 'cobro' : 'cobros'} en turno
              </span>
            </div>

            {/* KPI 3: Egresos del Turno */}
            <div className="cash-kpi-card-expense">
              <div className="cash-kpi-header">
                <span className="cash-kpi-label-expense">
                  Egresos Turno
                </span>
                <div className="cash-kpi-icon-expense">
                  <TrendingDown size={15} />
                </div>
              </div>
              <strong className="cash-kpi-value-expense">
                -{formatMoney(expenses)}
              </strong>
              <span className="cash-kpi-meta-expense">
                {expenseMovements.length} {expenseMovements.length === 1 ? 'salida' : 'salidas'} en turno
              </span>
            </div>

            {/* KPI 4: Esperado en Gaveta (KPI Estrella) */}
            <div className="cash-kpi-card-expected">
              <div className="cash-kpi-header">
                <span className="cash-kpi-label-expected">
                  Esperado en Gaveta
                </span>
                <div className="cash-kpi-icon-expected">
                  <DollarSign size={15} />
                </div>
              </div>
              <strong className="cash-kpi-value-expected">
                {formatMoney(expected)}
              </strong>
              <div className="cash-kpi-footer">
                <span>Cuadre teórico</span>
                <span className="cash-kpi-difference">
                  {session?.difference == null ? 'Por arquear' : formatMoney(session.difference)}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Movimientos del Turno con Filtros y Buscador */}
          <div className="cash-movements-card">
            {/* Header de la tarjeta */}
            <div className="cash-movements-header">
              <div>
                <h3 className="cash-movements-title">
                  Movimientos de la Sesión
                </h3>
                <span className="cash-movements-count">
                  {displayedMovements.length} transacciones registradas en efectivo
                </span>
              </div>

              {/* Buscador Rápido */}
              <div className="cash-movement-search">
                <Search size={14} className="cash-movement-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar movimiento..."
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                 className="cash-movement-search-input" />
              </div>
            </div>

            {/* Barra de Filtros Píldora */}
            <div className="cash-movement-filters">
              <div className="cash-movement-filter-label">
                <Filter size={14} className="cash-movement-filter-icon" />
                <span className="cash-movement-filter-title">
                  Filtrar movimientos:
                </span>
              </div>
              <div className="cash-movement-filter-tabs">
                {[
                  { key: 'ALL', label: `Todos (${movements.length})` },
                  { key: 'INGRESO', label: `Ingresos (+) (${incomeMovements.length})` },
                  { key: 'EGRESO', label: `Egresos (-) (${expenseMovements.length})` },
                  { key: 'CASH_DROP', label: 'Pases a Bóveda 🛡️' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`btn btn-xs ${movementFilter === tab.key ? 'btn-primary' : 'btn-outline'} cash-movement-filter-tab`}
                    onClick={() => setMovementFilter(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabla Estilizada */}
            <div className="cash-movement-table-wrap">
              <table className="data-table cash-movement-table">
                <thead>
                  <tr className="cash-movement-table-header">
                    <th className="cash-movement-header-cell">Hora / ID</th>
                    <th className="cash-movement-header-cell">Tipo</th>
                    <th className="cash-movement-header-cell">Concepto & Categoría</th>
                    <th className="cash-movement-header-cell">Comprobante</th>
                    <th className="cash-movement-header-cell">Responsable</th>
                    <th className="cash-movement-amount-header">Importe (PEN)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMovements.length ? displayedMovements.map((item) => {
                    const isIncome = item.type === 'Ingreso';
                    const isExpense = item.type === 'Egreso';
                    return (
                      <tr key={item.id} className="cash-movement-row">
                        <td className="cash-movement-time-cell">
                          <span className="cash-movement-time">{new Date(item.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="cash-movement-id">#{item.id.slice(0, 6)}</span>
                        </td>
                        <td className="cash-movement-type-cell">
                          <span className="cash-movement-type">
                            {isIncome ? <ArrowUpRight size={12} /> : isExpense ? <ArrowDownRight size={12} /> : null}
                            {item.type}
                          </span>
                        </td>
                        <td className="cash-movement-concept">
                          {item.concept}
                        </td>
                        <td className="cash-movement-reference">
                          {item.referenceId || '—'}
                        </td>
                        <td className="cash-movement-responsible">
                          {item.responsible}
                        </td>
                        <td className="cash-session-movement-amount">
                          {isIncome ? '+' : isExpense ? '-' : ''}{formatMoney(item.amount)}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} className="cash-movement-empty">
                        No se encontraron movimientos registrados con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial de Turnos de Caja (Auditoría) */}
          <section className="cash-session-history">
            <div className="cash-session-history-header">
              <div>
                <span className="cash-session-history-eyebrow">
                  Auditoría
                </span>
                <h3 className="cash-session-history-title">
                  Historial de sesiones
                </h3>
              </div>
              <span className="cash-session-history-count">
                {state.cashSessions.length} turnos registrados
              </span>
            </div>

            <div className="record-list cash-session-history-list">
              {state.cashSessions.map((item) => {
                const isExact = item.difference != null && Math.abs(item.difference) < 0.01;
                return (
                  <article key={item.id} className="cash-session-history-item">
                    <div>
                      <div className="cash-session-history-item-header">
                        <strong className="cash-session-history-item-title">
                          Turno {item.shift} · {item.responsible}
                        </strong>
                        <span className="cash-session-history-item-id">
                          #{item.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <span className="cash-session-history-item-dates">
                        Apertura: {displayDateTime(item.openedAt)} · Cierre: {displayDateTime(item.closedAt)}
                      </span>
                    </div>

                    <div className="cash-session-history-item-actions">
                      <div className="cash-session-difference">
                        <span className="cash-session-difference-label">Diferencia</span>
                        <strong className="cash-session-difference-value">
                          {item.difference == null ? 'Pendiente' : isExact ? 'Cuadre Exacto' : formatMoney(item.difference)}
                        </strong>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline cash-session-report-action"
                        onClick={() => setReportSession(item)}
                        title="Ver e Imprimir Comprobante Corte Z"
                      >
                        <Receipt size={14} />
                        <span>Ticket Z</span>
                      </button>

                      <StatusBadge>{item.status}</StatusBadge>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Diálogos modales del sistema */}
      <Dialog open={dialog === 'open'} onClose={() => setDialog(null)} title="Abrir nuevo turno de caja">
        <CashOpenForm onClose={() => setDialog(null)} notify={notify} />
      </Dialog>

      <Dialog open={dialog === 'movement'} onClose={() => { setDialog(null); setMovementPreset(null); }} title="Movimiento de Caja · Ingreso / Egreso">
        <CashMovementEnhancedForm
          initialPreset={movementPreset}
          onClose={() => { setDialog(null); setMovementPreset(null); }}
          notify={notify}
        />
      </Dialog>

      <Dialog open={dialog === 'count' || dialog === 'close'} onClose={() => setDialog(null)} title={dialog === 'close' ? 'Cerrar caja · Arqueo final' : 'Registrar arqueo de caja'}>
        <CashCountForm
          close={dialog === 'close'}
          expected={expected}
          onClose={() => setDialog(null)}
          onSessionClosed={(closed) => {
            setDialog(null);
            setReportSession(closed);
          }}
          notify={notify}
        />
      </Dialog>

      <CashZReportModal
        open={Boolean(reportSession)}
        onClose={() => setReportSession(null)}
        session={reportSession}
        movements={state.cashMovements}
      />
    </div>
    </ResourceState>
  );
}
