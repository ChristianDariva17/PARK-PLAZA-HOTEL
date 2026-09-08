import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search, AlertTriangle, Plus, Lock, Unlock, History, TrendingUp, TrendingDown, Clock, Sparkles, DollarSign, Package, Check, RefreshCw, ArrowUpRight, ArrowDownRight, SlidersHorizontal, Eye, Edit, RotateCcw, Building2, Receipt, ShieldAlert, Filter } from 'lucide-react';
import {
  formatMoney,
  getOrderRequirements,
  getOrderShortages,
  getReservationAvailability,
  isReservationArrivalExpired,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  RESERVATION_STATUSES,
  selectClientName,
  validateReservation,
} from '../../domain/hotelModel';
import { useHotel } from '../../state/hotelContext';
import { CashDenominationsCalculator } from '../../cash/CashDenominationsCalculator.jsx';
import { CashZReportModal } from '../../cash/CashZReportModal.jsx';
import { CashMovementEnhancedForm } from '../../cash/CashMovementEnhancedForm.jsx';
import { PermissionButton } from '../auth/PermissionButton';
import { useActionPermission } from '../auth/useActionPermission';
import { Dialog, Drawer, Tabs, TabPanel } from '../ui/Overlay';
import { FilterBar } from '../ui/FilterBar';
import { DataTable, DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from './SharedViewParts';
import { useRestaurantResource } from '../../restaurant/useRestaurantResource';
import { mapMaintenancePriorityToApi, mapMaintenanceStatusToApi, readMaintenancePhoto } from '../../maintenance/maintenanceModel';

const displayDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('es-PE') : 'No registrado';
const displayDateTime = (value) => value ? new Date(value).toLocaleString('es-PE') : 'No registrado';
const addDays = (days) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
const inventoryAvailable = (item) => Math.round((Number(item?.stock ?? 0) - Number(item?.reserved ?? 0)) * 100) / 100;
const run = (execute, action, notify, successTitle, successMessage) => {
  const result = execute(action);
  notify(result.ok ? successTitle : 'Operación rechazada', result.ok ? successMessage : (result.error || result.message || 'No se pudo completar la operación.'), result.ok ? 'success' : 'error');
  return result.ok;
};

function ReservationEditor({ reservation, onClose, notify }) {
  const { state, execute } = useHotel();
  const allowed = useActionPermission(reservation ? 'RESERVATION_UPDATE' : 'RESERVATION_CONFIRM');
  const [form, setForm] = useState(reservation ? {
    clientId: reservation.clientId, roomId: reservation.roomId, checkIn: reservation.checkIn, checkOut: reservation.checkOut,
    guests: reservation.guests, extraGuests: reservation.extraGuests, services: reservation.services, arrivalLimit: reservation.arrivalLimit,
    paymentMethod: reservation.paymentMethod, operationNumber: '', reason: '',
  } : { clientId: state.clients[0]?.id || '', roomId: '', checkIn: addDays(1), checkOut: addDays(3), guests: 1, extraGuests: 0, services: [], arrivalLimit: '20:00', paymentMethod: 'Yape', operationNumber: '', reason: '' });
  const availableRooms = getReservationAvailability(state, form.checkIn, form.checkOut, reservation?.id);
  const room = state.rooms.find((item) => item.id === form.roomId);
  const error = validateReservation(state, { ...form, guests: Number(form.guests), extraGuests: Number(form.extraGuests) }, reservation?.id);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    const payload = { ...form, guests: Number(form.guests), extraGuests: Number(form.extraGuests) };
    const action = reservation ? { type: 'RESERVATION_UPDATE', reservationId: reservation.id, payload, reason: form.reason } : { type: 'RESERVATION_CONFIRM', payload };
    if (run(execute, action, notify, reservation ? 'Reserva reprogramada' : 'Reserva confirmada', reservation ? 'Fechas, habitación, importe y contrato quedaron sincronizados.' : 'Se generaron reserva, adelanto, contrato y auditoría.')) onClose();
  };
  const toggleService = (service) => set('services', form.services.includes(service) ? form.services.filter((item) => item !== service) : [...form.services, service]);
  if (!allowed) return null;
  return <form className="form-grid" onSubmit={submit}>
    <label className="span-2">Cliente<select value={form.clientId} onChange={(event) => set('clientId', event.target.value)}>{state.clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.documentNumber}</option>)}</select></label>
    <label>Ingreso<input type="date" required value={form.checkIn} onChange={(event) => set('checkIn', event.target.value)} /></label>
    <label>Salida<input type="date" required value={form.checkOut} onChange={(event) => set('checkOut', event.target.value)} /></label>
    <label className="span-2">Habitación por intervalo<select required value={form.roomId} onChange={(event) => set('roomId', event.target.value)}><option value="">Seleccionar</option>{state.rooms.map((item) => { const available = availableRooms.some((entry) => entry.id === item.id); return <option key={item.id} value={item.id} disabled={!available}>{item.id} · {item.category} · {available ? 'Disponible para el rango' : 'No disponible'}</option>; })}</select><small>{availableRooms.length} habitación(es) sin solapamiento para las fechas elegidas.</small></label>
    <label>Huéspedes<input type="number" min="1" max={room?.capacity || 1} value={form.guests} onChange={(event) => set('guests', event.target.value)} /></label>
    <label>Adicionales<input type="number" min="0" value={form.extraGuests} onChange={(event) => set('extraGuests', event.target.value)} /></label>
    <label>Hora límite<input type="time" value={form.arrivalLimit} onChange={(event) => set('arrivalLimit', event.target.value)} /></label>
    <label>Método de adelanto<select value={form.paymentMethod} disabled={Boolean(reservation)} onChange={(event) => set('paymentMethod', event.target.value)}>{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></label>
    <fieldset className="span-2 option-fieldset"><legend>Servicios</legend>{['Desayuno', 'Piscina', 'Mirador', 'Cochera'].map((service) => <label className="check-option" key={service}><input type="checkbox" checked={form.services.includes(service)} onChange={() => toggleService(service)} />{service}</label>)}</fieldset>
    {reservation ? <label className="span-2">Motivo de reprogramación<textarea required value={form.reason} onChange={(event) => set('reason', event.target.value)} /></label> : <label className="span-2">Número de operación<input value={form.operationNumber} onChange={(event) => set('operationNumber', event.target.value)} /></label>}
    {error ? <div className="alert-banner alert-banner-danger span-2">{error}</div> : <div className="alert-banner alert-banner-success span-2">Intervalo y capacidad disponibles.</div>}
    <div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button className="btn btn-primary" disabled={Boolean(error)}>{reservation ? 'Guardar reprogramación' : 'Confirmar reserva'}</button></div>
  </form>;
}

function ReservationStatusDialog({ operation, onClose, notify }) {
  const { execute } = useHotel();
  const allowed = useActionPermission('RESERVATION_STATUS');
  const [reason, setReason] = useState('');
  const submit = (event) => {
    event.preventDefault();
    if (run(execute, { type: 'RESERVATION_STATUS', reservationId: operation.reservation.id, status: operation.status, reason }, notify, 'Reserva actualizada', `${operation.reservation.id} quedó como ${operation.status}.`)) onClose();
  };
  if (!allowed) return null;
  return <form className="form-grid" onSubmit={submit}><div className="alert-banner alert-banner-warning span-2">La reserva y sus registros económicos permanecen visibles para auditoría.</div><label className="span-2">Motivo<textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose}>Volver</button><button className="btn btn-primary">Confirmar {operation.status.toLowerCase()}</button></div></form>;
}

export function OperationalReservationsView({ notify }) {
  const { state } = useHotel();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [editor, setEditor] = useState(undefined);
  const [selectedId, setSelectedId] = useState(null);
  const [operation, setOperation] = useState(null);
  const deferred = useDeferredValue(query.toLowerCase());
  const records = state.reservations.filter((item) => `${item.id} ${item.roomId} ${selectClientName(state, item.clientId)}`.toLowerCase().includes(deferred) && (status === 'Todos' || item.status === status));
  const selected = state.reservations.find((item) => item.id === selectedId);
  const editable = selected && ['Pendiente', 'Confirmada'].includes(selected.status);
  const arrivalExpired = selected && isReservationArrivalExpired(selected);
  return <div className="view-container">
    <PageHeader metadata="Disponibilidad por intervalo · auditoría completa" title="Reservas" description="Creación, reprogramación, cancelación, no-show y vencimiento sin doble reserva." action={<PermissionButton actionType="RESERVATION_CONFIRM" className="btn btn-primary" onClick={() => setEditor(null)}>Nueva reserva</PermissionButton>} />
    <MetricStrip items={[{ label: 'Total', value: state.reservations.length }, { label: 'Confirmadas', value: state.reservations.filter((item) => item.status === 'Confirmada').length }, { label: 'Presentes', value: state.reservations.filter((item) => item.status === 'Cliente presente').length }, { label: 'Canceladas', value: state.reservations.filter((item) => item.status === 'Cancelada').length }, { label: 'No-show / vencidas', value: state.reservations.filter((item) => ['No presentado', 'Vencida'].includes(item.status)).length }]} />
    <div className="filter-bar"><label className="search-label"><Search size={16} /><input aria-label="Buscar reservas" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Reserva, huésped o habitación" /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{RESERVATION_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><span className="filter-result">{records.length} reservas</span></div>
    <DataTable caption="Reservas por intervalo y estado" columns={['Reserva', 'Cliente', 'Habitación', 'Intervalo', 'Total / saldo', 'Estado', 'Acciones']} emptyTitle="Sin reservas">{records.length ? records.map((item) => <tr key={item.id}><td><strong>{item.id}</strong></td><td>{selectClientName(state, item.clientId)}</td><td>{item.roomId} · {item.category}</td><td>{displayDate(item.checkIn)} a {displayDate(item.checkOut)}</td><td>{formatMoney(item.total)}<br /><small>Saldo contractual {formatMoney(item.balance)}</small>{item.refundableCredit > 0 ? <><br /><small>Crédito reembolsable {formatMoney(item.refundableCredit)}</small></> : null}</td><td><StatusBadge>{item.status}</StatusBadge></td><td><button className="btn btn-sm btn-outline" onClick={() => setSelectedId(item.id)}>Gestionar</button></td></tr>) : null}</DataTable>
    <Drawer open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected?.id || 'Reserva'} description={selected ? `${displayDate(selected.checkIn)} a ${displayDate(selected.checkOut)}` : ''}>{selected ? <div className="detail-stack"><DetailGrid items={[{ label: 'Cliente', value: selectClientName(state, selected.clientId) }, { label: 'Habitación', value: `${selected.roomId} · ${selected.category}` }, { label: 'Estado', node: <StatusBadge>{selected.status}</StatusBadge> }, { label: 'Saldo contractual', value: formatMoney(selected.balance) }, { label: 'Crédito reembolsable', value: formatMoney(selected.refundableCredit || 0), detail: selected.refundableCredit > 0 ? 'Excedente de adelanto preservado' : 'Sin excedente' }, { label: 'Huéspedes', value: selected.guests }, { label: 'Contrato', value: selected.contractId }, { label: 'Motivo de estado', value: selected.statusReason || 'No aplica' }]} /><div className="inline-actions">{editable ? <PermissionButton actionType="RESERVATION_UPDATE" className="btn btn-outline" onClick={() => setEditor(selected)}>Editar / reprogramar</PermissionButton> : null}{editable ? <PermissionButton actionType="RESERVATION_STATUS" className="btn btn-outline" onClick={() => setOperation({ reservation: selected, status: 'Cancelada' })}>Cancelar reserva</PermissionButton> : null}{editable && arrivalExpired ? <PermissionButton actionType="RESERVATION_STATUS" className="btn btn-outline" onClick={() => setOperation({ reservation: selected, status: 'No presentado' })}>Marcar no-show</PermissionButton> : null}{editable && arrivalExpired ? <PermissionButton actionType="RESERVATION_STATUS" className="btn btn-outline" onClick={() => setOperation({ reservation: selected, status: 'Vencida' })}>Expirar</PermissionButton> : null}</div></div> : null}</Drawer>
    <Dialog open={editor !== undefined} onClose={() => setEditor(undefined)} title={editor ? `Editar ${editor.id}` : 'Nueva reserva'} description="La disponibilidad se calcula para el intervalo completo." wide><ReservationEditor reservation={editor || null} onClose={() => setEditor(undefined)} notify={notify} /></Dialog>
    <Dialog open={Boolean(operation)} onClose={() => setOperation(null)} title={operation ? `${operation.status}: ${operation.reservation.id}` : 'Actualizar reserva'}>{operation ? <ReservationStatusDialog operation={operation} onClose={() => { setOperation(null); setSelectedId(null); }} notify={notify} /> : null}</Dialog>
  </div>;
}

// Helper Components for Incidents and Maintenance
function StatusStepper({ currentStatus, steps }) {
  const currentIndex = steps.indexOf(currentStatus);
  return (
    <div className="status-stepper-container">
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;

        return (
          <div key={step} className={`status-step ${isCompleted ? 'step-completed' : isActive ? 'step-active' : 'step-pending'}`}>
            <div className={`status-step-dot ${isCompleted ? 'step-dot-completed' : isActive ? 'step-dot-active' : 'step-dot-pending'}`} />
            {idx < steps.length - 1 && (
              <div className={`status-step-line step-line-${isCompleted ? 'completed' : 'pending'}`} />
            )}
            <span className={`status-step-label step-label-${isActive ? 'active' : 'pending'}`}>{step}</span>
          </div>
        );
      })}
    </div>
  );
}

function PriorityTag({ priority }) {
  const norm = String(priority || '').toLowerCase().trim();
  let icon = '⚡';

  if (norm === 'urgente' || norm === 'urgent') {
    icon = '🚨';
  } else if (norm === 'alta' || norm === 'high') {
    icon = '⚠️';
  } else if (norm === 'media' || norm === 'medium') {
    icon = '⏱️';
  } else if (norm === 'baja' || norm === 'low') {
    icon = '📋';
  }

  return (
    <span className={`priority-tag priority-tag-${norm || 'default'}`}>
      <span>{icon}</span> {priority}
    </span>
  );
}

function getMaintenanceTypeIcon(type = '') {
  const t = type.toLowerCase();
  if (t.includes('aire') || t.includes('clima')) return '❄️';
  if (t.includes('plomer') || t.includes('agua') || t.includes('ducha') || t.includes('baño')) return '🚿';
  if (t.includes('electr') || t.includes('luz') || t.includes('tomacorriente')) return '⚡';
  if (t.includes('cerra') || t.includes('puerta') || t.includes('chapa')) return '🔑';
  if (t.includes('tv') || t.includes('tele') || t.includes('pantalla')) return '📺';
  if (t.includes('mueble') || t.includes('cama') || t.includes('silla')) return '🛏️';
  return '🛠️';
}

const COMMON_MAINTENANCE_PRESETS = [
  { label: '❄️ A/C no enfría', type: 'Aire acondicionado', desc: 'El sistema de climatización no enfría y presenta bajo flujo de aire.', priority: 'Alta' },
  { label: '🚿 Fuga en Ducha/Lavamanos', type: 'Plomería', desc: 'Goteo continuo y filtración en el área de grifería del baño.', priority: 'Urgente' },
  { label: '⚡ Falla en Tomacorrientes', type: 'Electricidad', desc: 'Tomacorriente sin energía eléctrica en la cabecera.', priority: 'Media' },
  { label: '🔑 Cerradura Bloqueada', type: 'Cerraduras', desc: 'La tarjeta electrónica no es reconocida por la cerradura de la puerta.', priority: 'Urgente' },
  { label: '📺 Smart TV sin señal', type: 'Televisión', desc: 'Televisor no conecta al servicio de streaming ni canales HD.', priority: 'Baja' },
  { label: '💡 Luminaria Fundida', type: 'Electricidad', desc: 'Foco de iluminación principal parpadea o está apagado.', priority: 'Baja' },
];

function MaintenanceCreateForm({ onClose, notify }) {
  const { state, execute, maintenanceCommands } = useHotel();
  const allowed = useActionPermission('MAINTENANCE_CREATE');
  const [form, setForm] = useState({
    roomId: state.rooms[0]?.id || '',
    type: 'Aire acondicionado',
    description: '',
    priority: 'Media',
    assignedTo: 'Por asignar',
    severe: false,
    evidence: '',
    photo: null,
  });
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const applyPreset = (preset) => {
    setForm((current) => ({
      ...current,
      type: preset.type,
      description: preset.desc,
      priority: preset.priority,
      severe: preset.priority === 'Urgente',
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    if (maintenanceCommands) {
      try {
        const photoEvidence = await readMaintenancePhoto(form.photo);
        await maintenanceCommands.create({
          roomId: form.roomId || undefined,
          description: `[${form.type}] ${form.description}`,
          priority: mapMaintenancePriorityToApi(form.priority),
          responsible: form.assignedTo || undefined,
          blocksRoom: Boolean(form.severe),
          evidence: photoEvidence || form.evidence || undefined,
        });
        notify('Ticket creado', 'Ticket de mantenimiento registrado exitosamente en el servidor.', 'success');
        onClose();
      } catch (error) {
        notify('Error al crear ticket', error.message, 'error');
      } finally {
        setBusy(false);
      }
    } else {
      if (run(execute, { type: 'MAINTENANCE_CREATE', payload: form }, notify, 'Ticket creado', 'Ticket, incidencia y estado de habitación quedaron vinculados.')) onClose();
      setBusy(false);
    }
  };

  if (!allowed) return null;

  return (
    <form className="form-grid maintenance-create-form" onSubmit={submit}>
      {/* Presets Bar */}
      <div className="span-2 maintenance-presets">
        <div className="maintenance-presets-title">
          Plantillas Rápidas de Avería Frecuente:
        </div>
        <div className="maintenance-presets-list">
          {COMMON_MAINTENANCE_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
             className="maintenance-preset-button">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="maintenance-field">
        <span>Habitación Afectada</span>
        <select value={form.roomId} onChange={(event) => set('roomId', event.target.value)}>
          {state.rooms.map((room) => (
            <option key={room.id} value={room.id}>
              Habitación {room.number} (Piso {room.floor}) — {room.status}
            </option>
          ))}
        </select>
      </label>

      <label className="maintenance-field">
        <span>Tipo de Avería</span>
        <input required value={form.type} onChange={(event) => set('type', event.target.value)} placeholder="Ej. Climatización, Plomería, Electricidad..." />
      </label>

      <label className="maintenance-field">
        <span>Nivel de Prioridad & SLA</span>
        <select value={form.priority} onChange={(event) => set('priority', event.target.value)}>
          <option value="Baja">🟢 Baja (Atención dentro de 24h)</option>
          <option value="Media">🔵 Media (Atención dentro de 6h)</option>
          <option value="Alta">🟡 Alta (Atención dentro de 2h)</option>
          <option value="Urgente">🔴 Urgente (Atención Inmediata)</option>
        </select>
      </label>

      <label className="maintenance-field">
        <span>Técnico Responsable</span>
        <input value={form.assignedTo} onChange={(event) => set('assignedTo', event.target.value)} placeholder="Ej: Téc. Carlos Mendoza / Por asignar" />
      </label>

      <label className="span-2 maintenance-field">
        <span>Descripción Detallada del Problema</span>
        <textarea required rows={3} value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="Describa la falla observada, ruidos, fugas o partes averiadas..." />
      </label>

      <label className="span-2 maintenance-field">
        <span>Enlace de Evidencia / Documentación (Opcional)</span>
        <input value={form.evidence} onChange={(event) => set('evidence', event.target.value)} placeholder="https://... URL de reporte, foto o manual" />
      </label>

      <label className="span-2 maintenance-field">
        <span>Fotografía de la Avería (Adjuntar archivo)</span>
        <input type="file" accept="image/*" onChange={(event) => set('photo', event.target.files?.[0] || null)} />
        {form.photo ? <small className="form-helper">Archivo seleccionado: {form.photo.name}</small> : null}
      </label>

      <div className={`span-2 maintenance-severe ${form.severe ? 'is-severe' : ''}`}>
        <label className="maintenance-severe-label">
          <input type="checkbox" checked={form.severe} onChange={(event) => set('severe', event.target.checked)} className="maintenance-severe-checkbox" />
          <div>
            <strong className={`maintenance-severe-title ${form.severe ? 'is-severe' : ''}`}>
              🔒 Bloquear Habitación Inmediatamente (Fuera de Servicio)
            </strong>
            <div className={`maintenance-severe-help ${form.severe ? 'is-severe' : ''}`}>
              La habitación no podrá ser asignada a nuevas reservas hasta que el ticket sea completamente resuelto y cerrado.
            </div>
          </div>
        </label>
      </div>

      <div className="form-actions span-2 maintenance-form-actions">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Registrando ticket…' : 'Crear Ticket de Mantenimiento'}
        </button>
      </div>
    </form>
  );
}

function MaintenanceManager({ ticket, onClose, notify }) {
  const { execute, maintenanceCommands } = useHotel();
  const canUpdate = useActionPermission('MAINTENANCE_UPDATE');
  const progressActionType = ticket.status === 'Cerrado' ? 'MAINTENANCE_REOPEN' : 'MAINTENANCE_PROGRESS';
  const canProgress = useActionPermission(progressActionType);
  const [form, setForm] = useState({ assignedTo: ticket.assignedTo, priority: ticket.priority, evidence: '', solution: ticket.solution || '', releaseRoom: ticket.blocksRoom });
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy(true);
    if (maintenanceCommands) {
      try {
        await maintenanceCommands.update(ticket.id, {
          responsible: form.assignedTo,
          priority: mapMaintenancePriorityToApi(form.priority),
          solution: form.solution || undefined,
          evidence: form.evidence || undefined,
        });
        notify('Ticket actualizado', 'Responsable, prioridad y solución quedaron sincronizados.', 'success');
      } catch (error) {
        notify('Error al actualizar ticket', error.message, 'error');
      } finally {
        setBusy(false);
      }
    } else {
      run(execute, { type: 'MAINTENANCE_UPDATE', ticketId: ticket.id, payload: form }, notify, 'Ticket actualizado', 'Responsable, prioridad y evidencia se sincronizaron con la incidencia.');
      setBusy(false);
    }
  };

  const progress = async (action) => {
    setBusy(true);
    if (maintenanceCommands) {
      try {
        await maintenanceCommands.progress(ticket.id, {
          action,
          expectedStatus: mapMaintenanceStatusToApi(ticket.status),
          ...(action === 'assign' ? { responsible: form.assignedTo } : {}),
          ...(action === 'resolve' ? { solution: form.solution, evidence: form.evidence || undefined } : {}),
          ...(action === 'close' ? { releaseRoom: form.releaseRoom } : {}),
        });
        notify('Ticket actualizado', 'La acción quedó registrada correctamente.', 'success');
        onClose();
      } catch (error) {
        notify('Error al avanzar ticket', error.message, 'error');
      } finally {
        setBusy(false);
      }
    } else {
      if (run(execute, { type: 'MAINTENANCE_PROGRESS', ticketId: ticket.id, expectedStatus: ticket.status, action }, notify, 'Ticket actualizado', 'La acción quedó registrada correctamente.')) onClose();
      setBusy(false);
    }
  };

  const nextAction = {
    Pendiente: ['assign', '👤 Asignar Técnico e Iniciar'],
    Asignado: ['start', '🛠️ Iniciar Trabajo de Reparación'],
    'En reparacion': ['resolve', '✅ Marcar como Resuelto'],
    'En reparación': ['resolve', '✅ Marcar como Resuelto'],
    Solucionado: ['close', '🔒 Cerrar Ticket y Liberar'],
    Cerrado: ['reopen', '🔄 Reabrir Ticket Operativo'],
  }[ticket.status];

  if (!canUpdate && !canProgress) return null;

  return (
    <div className="maintenance-manager">
      {/* Header Banner */}
      <div className="maintenance-ticket-header">
        <div className="maintenance-ticket-heading">
          <span className="maintenance-ticket-icon">{getMaintenanceTypeIcon(ticket.description)}</span>
          <div>
            <div className="maintenance-ticket-meta">
              Ticket #{ticket.id.slice(0, 8)} · Habitación {ticket.room?.number || ticket.roomId}
            </div>
            <strong className="maintenance-ticket-title">{ticket.description.replace(/^\[.*?\]\s*/, '')}</strong>
          </div>
        </div>
        <div className="maintenance-ticket-status">
          <PriorityTag priority={ticket.priority} />
          <span className="maintenance-status-label">
            Estado: {ticket.status}
          </span>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="maintenance-progress">
        <StatusStepper currentStatus={ticket.status} steps={['Pendiente', 'Asignado', 'En reparación', 'Solucionado', 'Cerrado']} />
      </div>

      {/* Form Fields */}
      <div className="form-grid maintenance-manager-form">
        <label className="maintenance-field">
          <span>Técnico Responsable Asignado</span>
          <input value={form.assignedTo} onChange={(event) => set('assignedTo', event.target.value)} placeholder="Nombre del técnico responsable" />
        </label>

        <label className="maintenance-field">
          <span>Prioridad del Ticket</span>
          <select value={form.priority} onChange={(event) => set('priority', event.target.value)}>
            {['Baja', 'Media', 'Alta', 'Urgente'].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="span-2 maintenance-field">
          <span>Notas de Evidencia / Diagnóstico</span>
          <input value={form.evidence} onChange={(event) => set('evidence', event.target.value)} placeholder="URL de fotos de reparación, informes o notas técnicas" />
        </label>

        <label className="span-2 maintenance-field">
          <span>Solución Técnica / Informe de Cierre</span>
          <textarea rows={3} value={form.solution} onChange={(event) => set('solution', event.target.value)} placeholder="Detalle los repuestos cambiados, calibración realizada o motivo de resolución..." />
        </label>

        {(ticket.status === 'Solucionado' || ticket.status === 'En reparación' || ticket.status === 'En reparacion') && ticket.blocksRoom ? (
          <div className="span-2 maintenance-release-room">
            <label className="maintenance-release-label">
              <input type="checkbox" checked={form.releaseRoom} onChange={(event) => set('releaseRoom', event.target.checked)} className="maintenance-release-checkbox" />
              <strong>
                🔓 Liberar habitación y reincorporar al inventario disponible al cerrar ticket
              </strong>
            </label>
          </div>
        ) : null}

        <div className="form-actions span-2 maintenance-manager-actions">
          {canUpdate ? (
            <PermissionButton actionType="MAINTENANCE_UPDATE" className="btn btn-outline" disabled={busy} onClick={save}>
              {busy ? 'Guardando…' : 'Guardar Cambios'}
            </PermissionButton>
          ) : <div />}

          {canProgress && nextAction ? (
            <PermissionButton actionType={progressActionType} className="btn btn-primary" disabled={busy} onClick={() => progress(nextAction[0])}>
              {busy ? 'Procesando…' : nextAction[1]}
            </PermissionButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OperationalMaintenanceView({ notify }) {
  const { state } = useHotel();
  const canUpdateMaintenance = useActionPermission('MAINTENANCE_UPDATE');
  const canProgressMaintenance = useActionPermission('MAINTENANCE_PROGRESS');
  const canReopenMaintenance = useActionPermission('MAINTENANCE_REOPEN');

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // Custom filter states
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todos');
  const [roomQuery, setRoomQuery] = useState('');

  const selected = state.maintenanceTickets.find((item) => item.id === selectedId);

  // Apply filters
  const filteredTickets = state.maintenanceTickets.filter((ticket) => {
    const normStatus = ticket.status === 'En reparacion' ? 'En reparación' : ticket.status;
    const matchesStatus = statusFilter === 'Todos' || normStatus === statusFilter;
    const matchesPriority = priorityFilter === 'Todos' || ticket.priority === priorityFilter;
    const roomNumber = ticket.room?.number ?? state.rooms.find((room) => room.id === ticket.roomId)?.number;
    const matchesRoom = !roomQuery || roomNumber?.toLowerCase().includes(roomQuery.toLowerCase()) || ticket.description?.toLowerCase().includes(roomQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesRoom;
  });

  const MAINTENANCE_STATUS_STEPS = ['Pendiente', 'Asignado', 'En reparación', 'Solucionado', 'Cerrado'];

  const pendingCount = state.maintenanceTickets.filter((item) => item.status !== 'Cerrado').length;
  const inRepairCount = state.maintenanceTickets.filter((item) => item.status === 'En reparación' || item.status === 'En reparacion').length;
  const urgentCount = state.maintenanceTickets.filter((item) => item.priority === 'Urgente' || item.priority === 'urgent').length;
  const closedCount = state.maintenanceTickets.filter((item) => item.status === 'Cerrado').length;

  return (
    <div className="view-container">

      <PageHeader
        actionType="MAINTENANCE_CREATE"
        metadata="Mantenimiento preventivo y correctivo"
        title="Mantenimiento"
        description="Gestión integral de tickets, asignaciones técnicas, avances operativos y liberación de habitaciones."
        action={
          <PermissionButton actionType="MAINTENANCE_CREATE" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Nuevo ticket
          </PermissionButton>
        }
      />

      {/* Modern KPI Strip */}
      <div className="maintenance-metric-grid">
        <div className="maintenance-metric-card">
          <div>
            <div className="maintenance-metric-label">Pendientes de Cierre</div>
            <div className="maintenance-metric-value">{pendingCount}</div>
          </div>
          <span className="maintenance-metric-icon">⏳</span>
        </div>

        <div className="maintenance-metric-card">
          <div>
            <div className="maintenance-metric-label">En Reparación</div>
            <div className="maintenance-metric-value">{inRepairCount}</div>
          </div>
          <span className="maintenance-metric-icon">🛠️</span>
        </div>

        <div className="maintenance-metric-card">
          <div>
            <div className="maintenance-metric-label">Urgentes / Críticos</div>
            <div className="maintenance-metric-value">{urgentCount}</div>
          </div>
          <span className="maintenance-metric-icon">🚨</span>
        </div>

        <div className="maintenance-metric-card">
          <div>
            <div className="maintenance-metric-label">Cerrados / Resueltos</div>
            <div className="maintenance-metric-value">{closedCount}</div>
          </div>
          <span className="maintenance-metric-icon">✅</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="custom-filter-bar">
        <label className="maintenance-filter-search">
          <span>Búsqueda Rápida</span>
          <input
            type="text"
            placeholder="Buscar por hab. 101, climatización..."
            value={roomQuery}
            onChange={(e) => setRoomQuery(e.target.value)}
          />
        </label>

        <label>
          <span>Filtrar por Estado</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="Todos">Todos los estados</option>
            {MAINTENANCE_STATUS_STEPS.map((step) => (
              <option key={step} value={step}>{step}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Filtrar por Prioridad</span>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="Todos">Todas las prioridades</option>
            {['Baja', 'Media', 'Alta', 'Urgente'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Ticket Cards Grid */}
      {filteredTickets.length > 0 ? (
        <div className="maintenance-grid">
          {filteredTickets.map((ticket) => {
            const room = ticket.room ?? state.rooms.find((item) => item.id === ticket.roomId);
            const pClass = `priority-${ticket.priority}`;
            const typeIcon = getMaintenanceTypeIcon(ticket.description);

            return (
              <article className={`maintenance-card ${pClass}`} key={ticket.id}>
                <div>
                   <div className="row-between maintenance-card-heading">
                     <div className="maintenance-card-title-group">
                       <span className="maintenance-card-icon">{typeIcon}</span>
                      <div>
                         <span className="maintenance-card-room">
                          Habitación {room?.number || 'General'}
                        </span>
                         <h3 className="maintenance-card-title">
                          {ticket.description.replace(/^\[.*?\]\s*/, '')}
                        </h3>
                      </div>
                    </div>
                    <StatusBadge>{ticket.status}</StatusBadge>
                  </div>

                   <div className="maintenance-card-tags">
                    <PriorityTag priority={ticket.priority} />
                    {ticket.blocksRoom ? (
                       <span className="maintenance-lock-tag is-blocking">
                        <Lock size={11} /> Bloquea Habitación
                      </span>
                    ) : (
                       <span className="maintenance-lock-tag">
                        <Unlock size={11} /> Sin Bloqueo
                      </span>
                    )}
                  </div>

                  <DetailGrid compact items={[
                    { label: 'Responsable', value: ticket.assignedTo || 'Por asignar' },
                    { label: 'Habitación', value: room ? `Hab. ${room.number}` : 'General', detail: room?.status },
                    { label: 'Evidencias', value: ticket.evidence?.length ? '1 adjunto' : 'Sin evidencias' },
                    { label: 'Solución', value: ticket.solution || 'En diagnóstico' }
                  ]} />
                </div>

                 <div className="maintenance-card-footer">
                  <StatusStepper currentStatus={ticket.status} steps={MAINTENANCE_STATUS_STEPS} />

                   <div className="maintenance-card-actions">
                    {(canUpdateMaintenance || (ticket.status === 'Cerrado' ? canReopenMaintenance : canProgressMaintenance)) ? (
                      <button
                         className="btn btn-outline btn-sm"
                        onClick={() => setSelectedId(ticket.id)}
                      >
                        Gestionar Ticket
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Sin tickets de mantenimiento" description="No se encontraron tickets con los filtros aplicados." />
      )}

      {/* Dialogs */}
      <Dialog open={open} onClose={() => setOpen(false)} title="Nuevo Ticket de Mantenimiento" wide>
        <MaintenanceCreateForm onClose={() => setOpen(false)} notify={notify} />
      </Dialog>

      <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `Gestión Operativa de Mantenimiento · Hab. ${selected.room?.number || selected.roomId}` : 'Gestionar ticket'} wide>
        {selected ? <MaintenanceManager ticket={selected} onClose={() => setSelectedId(null)} notify={notify} /> : null}
      </Dialog>
    </div>
  );
}

function OrderEditor({ order, sourceFilter, onClose, notify }) {
  const { state, restaurantCommands } = useHotel();
  const allowed = useActionPermission(order ? 'ORDER_UPDATE' : 'ORDER_CREATE');
  const activeStays = state.stays.filter((item) => item.status === 'Activa');
  const [form, setForm] = useState(order ? { source: order.source, stayId: order.stayId || '', recipeId: order.items[0]?.recipeId || state.recipes[0]?.id, quantity: order.items[0]?.quantity || 1, paymentMethod: order.paymentMethod, comment: order.comment, estimatedMinutes: order.estimatedMinutes } : { source: sourceFilter || 'Habitación', stayId: activeStays[0]?.id || '', recipeId: state.recipes[0]?.id || '', quantity: 1, paymentMethod: 'Cargar a la habitación', comment: '', estimatedMinutes: 25 });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const payload = { source: form.source, stayId: form.source === 'Habitación' ? form.stayId : null, items: [{ recipeId: form.recipeId, quantity: Number(form.quantity) }], paymentMethod: form.source === 'Habitación' ? form.paymentMethod : form.paymentMethod === 'Cargar a la habitación' ? 'Efectivo' : form.paymentMethod, comment: form.comment, estimatedMinutes: Number(form.estimatedMinutes) };
  
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (order) {
        await restaurantCommands.updateOrderCommand(order.id, payload, idempotencyKey);
        notify('Pedido editado', 'El pedido quedó visible y auditable.', 'success');
      } else {
        await restaurantCommands.createOrderCommand(payload, idempotencyKey);
        notify('Pedido creado', 'El pedido quedó visible y auditable.', 'success');
      }
      onClose();
    } catch (error) {
      if (error.type === 'ambiguous') {
        setSubmitError('Resultado ambiguo de red. Intentá refrescar los pedidos o reintentar la operación.');
      } else if (error.type === 'conflict') {
        setSubmitError('Hubo un conflicto al procesar la orden. Ya existe o fue modificada por otro usuario.');
      } else {
        setSubmitError(error.message || 'Ocurrió un error al procesar el pedido.');
      }
    } finally {
      setSubmitting(false);
    }
  };
  if (!allowed) return null;
  return <form className="form-grid" onSubmit={submit}>
    <label>Origen<select value={form.source} disabled={Boolean(sourceFilter)} onChange={(event) => set('source', event.target.value)}><option>Habitación</option><option>Barra</option><option>Terraza</option></select></label>
    {form.source === 'Habitación' ? <label>Estadía<select value={form.stayId} onChange={(event) => set('stayId', event.target.value)}>{activeStays.map((stay) => <option key={stay.id} value={stay.id}>{stay.id} · Hab. {stay.roomId} · {selectClientName(state, stay.clientId)}</option>)}</select></label> : <label>Punto de venta<input value={form.source} disabled /></label>}
    <label>Producto<select value={form.recipeId} onChange={(event) => set('recipeId', event.target.value)}>{state.recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name} · {formatMoney(recipe.salePrice)}</option>)}</select></label>
    <label>Cantidad<input type="number" min="1" value={form.quantity} onChange={(event) => set('quantity', event.target.value)} /></label>
    <label>Método de pago<select value={form.paymentMethod} onChange={(event) => set('paymentMethod', event.target.value)}>{['Cargar a la habitación', ...PAYMENT_METHODS].map((item) => <option key={item}>{item}</option>)}</select></label>
    <label>ETA (min)<input type="number" min="1" value={form.estimatedMinutes} onChange={(event) => set('estimatedMinutes', event.target.value)} /></label>
    <label className="span-2">Comentario<textarea value={form.comment} onChange={(event) => set('comment', event.target.value)} /></label>
    {submitError && <div className="alert-banner alert-banner-danger span-2">{submitError}</div>}
    <div className="form-actions span-2">
      <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>Cancelar</button>
      <button className="btn btn-primary" disabled={submitting}>{submitting ? 'Procesando...' : order ? 'Guardar pedido' : 'Crear pedido'}</button>
    </div>
  </form>;
}

export function OperationalOrdersView({ notify, sourceFilter = null, title = 'Pedidos QR', description = 'Creación, edición, preparación, entrega, pago y cancelación auditable.' }) {
  const { state, restaurantCommands } = useHotel();
  const ordersResource = useRestaurantResource(state, restaurantCommands, 'orders');
  const inventoryResource = useRestaurantResource(state, restaurantCommands, 'inventory');
  const menuResource = useRestaurantResource(state, restaurantCommands, 'menu');
  
  const canCreate = useActionPermission('ORDER_CREATE');
  const canUpdate = useActionPermission('ORDER_UPDATE');
  const canAdvanceOrder = useActionPermission('ORDER_ADVANCE');
  const canCancelOrder = useActionPermission('ORDER_CANCEL');
  const [status, setStatus] = useState('Todos');
  const [editor, setEditor] = useState(undefined);
  
  const [advancing, setAdvancing] = useState(null);
  const records = ordersResource.data.filter((item) => (!sourceFilter || item.source === sourceFilter) && (status === 'Todos' || item.status === status));
  
  const advance = async (order) => {
    if (advancing) return;
    setAdvancing(order.id);
    const idempotencyKey = crypto.randomUUID();
    try {
      await restaurantCommands.advanceOrderCommand(order.id, { expectedStatus: order.status }, idempotencyKey);
      notify('Pedido actualizado', 'Inventario, cuenta y caja se aplicaron según el nuevo estado.', 'success');
    } catch (error) {
      notify('Error al actualizar pedido', error.message || 'Error de red o servidor.', 'error');
    } finally {
      setAdvancing(null);
    }
  };
  
  const cancel = async (order) => {
    if (!window.confirm(`¿Cancelar el pedido ${order.id}?`)) return;
    if (advancing) return;
    setAdvancing(order.id);
    const idempotencyKey = crypto.randomUUID();
    try {
      await restaurantCommands.cancelOrderCommand(order.id, { reason: 'Cancelación operativa solicitada desde la vista' }, idempotencyKey);
      notify('Pedido cancelado', 'El pedido permanece visible y cualquier reserva de inventario fue liberada.', 'success');
    } catch (error) {
      notify('Error al cancelar pedido', error.message || 'Error de red o servidor.', 'error');
    } finally {
      setAdvancing(null);
    }
  };
  
  const missingDependencies = [];
  if (inventoryResource.status !== 'success') missingDependencies.push('Inventario');
  if (menuResource.status !== 'success') missingDependencies.push('Menú');
  
  return <div className="view-container">
    <PageHeader actionType="ORDER_CREATE" metadata={sourceFilter ? `Origen ${sourceFilter}` : 'Habitación · Barra · Terraza'} title={title} description={description} action={canCreate ? <button className="btn btn-primary" onClick={() => setEditor(null)}>Nuevo pedido</button> : null} />
    <MetricStrip items={[{ label: 'Visibles', value: records.length }, { label: 'Editables', value: records.filter((item) => ['Pedido recibido', 'Confirmado'].includes(item.status)).length }, { label: 'En preparación', value: records.filter((item) => item.status === 'En preparación').length }, { label: 'Pagados', value: records.filter((item) => item.status === 'Pagado').length }, { label: 'Cancelados', value: records.filter((item) => item.status === 'Cancelado').length }]} />
    
    {missingDependencies.length > 0 && (
      <div className="alert-banner alert-banner-warning">
        Métricas limitadas. Faltan dependencias: {missingDependencies.join(', ')}.
        {(inventoryResource.isForbidden || menuResource.isForbidden) && " (Sin permisos suficientes)"}
      </div>
    )}
    
    <div className="filter-bar">
      <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option>{ORDER_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
    </div>
    
    {ordersResource.status === 'loading' ? (
      <div className="alert-banner alert-banner-info">Cargando pedidos...</div>
    ) : ordersResource.status === 'error' ? (
      <div className="alert-banner alert-banner-danger">
        {ordersResource.error} <button className="btn btn-sm btn-outline" onClick={() => ordersResource.reload()}>Reintentar</button>
      </div>
    ) : ordersResource.isForbidden ? (
      <div className="alert-banner alert-banner-danger">No tienes permiso para ver los pedidos.</div>
    ) : null}

    {(ordersResource.status === 'success' || ordersResource.data.length > 0) && (
      <div className="order-record-grid">
        {records.map((order) => { 
          const shortages = (order.status === 'Confirmado' && missingDependencies.length === 0) ? getOrderShortages(state, order) : []; 
          const requirements = missingDependencies.length === 0 ? getOrderRequirements(state, order) : []; 
          const canEdit = canUpdate && ['Pedido recibido', 'Confirmado'].includes(order.status); 
          const canCancel = canCancelOrder && ['Pedido recibido', 'Confirmado', 'En preparación'].includes(order.status); 
          const canAdvance = canAdvanceOrder && ORDER_STATUSES.indexOf(order.status) >= 0 && ORDER_STATUSES.indexOf(order.status) < ORDER_STATUSES.indexOf('Pagado'); 
          return <article className="card order-record" key={order.id}>
            <div className="row-between">
              <div><span className="eyebrow">{order.id} · {order.source}</span><h3>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</h3></div>
              <StatusBadge>{order.status}</StatusBadge>
            </div>
            <DetailGrid compact items={[{ label: 'Destino', value: order.roomId ? `Hab. ${order.roomId}` : order.amenityReservationId ? `Zona/Amenidad #${order.amenityReservationId.slice(0, 8)}` : (order.deliveryMode || order.source) }, { label: 'Pago', value: order.paymentMethod, detail: order.accountingStage }, { label: 'Inventario', value: order.inventoryStage }, { label: 'Total', value: formatMoney(order.total) }]} />
            <div className="chip-row">
              {requirements.map((requirement, index) => { 
                const item = inventoryResource.data.find((entry) => entry.id === requirement.inventoryId); 
                return <span className="chip" key={`${requirement.inventoryId}-${index}`}>{item?.name}: {requirement.quantity} {item?.unit}</span>; 
              })}
            </div>
            {shortages.length > 0 ? <div className="alert-banner alert-banner-danger">Falta {shortages.map((item) => `${item.name}: ${item.required - item.available} ${item.unit}`).join(', ')}.</div> : null}
            <div className="inline-actions">
              {canEdit ? <button className="btn btn-sm btn-outline" onClick={() => setEditor(order)} disabled={advancing === order.id}>Editar</button> : null}
              {canAdvance ? <button className="btn btn-sm btn-primary" onClick={() => advance(order)} disabled={advancing === order.id}>{advancing === order.id ? 'Avanzando...' : 'Avanzar'}</button> : null}
              {canCancel ? <button className="btn btn-sm btn-outline" onClick={() => cancel(order)} disabled={advancing === order.id}>Cancelar</button> : null}
            </div>
          </article>; 
        })}
      </div>
    )}
    {!records.length && ordersResource.status === 'success' ? <EmptyState title="Sin pedidos" /> : null}
    
    <Dialog open={editor !== undefined} onClose={() => setEditor(undefined)} title={editor ? `Editar ${editor.id}` : 'Nuevo pedido'} wide><OrderEditor order={editor || null} sourceFilter={sourceFilter} onClose={() => setEditor(undefined)} notify={notify} /></Dialog>
  </div>;
}

// ─── Luxury Hotel Inventory Helpers ──────────────────────────────────────────
const getInventoryCategory = (name = '', unit = '') => {
  const n = (name || '').toLowerCase();
  const u = (unit || '').toLowerCase();
  if (u === 'oz' || n.includes('pisco') || n.includes('licor') || n.includes('ron') || n.includes('gin') || n.includes('vodka') || n.includes('vino') || n.includes('whisky') || n.includes('cerveza') || n.includes('jarabe') || n.includes('amargo') || n.includes('curaçao') || n.includes('trago')) {
    return { id: 'bar', label: 'Bar & Coctelería', icon: '🍸' };
  }
  if (n.includes('lomo') || n.includes('pollo') || n.includes('carne') || n.includes('panceta') || n.includes('bife') || n.includes('tocino') || n.includes('costilla')) {
    return { id: 'carnes', label: 'Carnes & Aves', icon: '🥩' };
  }
  if (n.includes('pescado') || n.includes('corvina') || n.includes('marisco') || n.includes('calamar') || n.includes('langostino') || n.includes('pulpo') || n.includes('concha') || n.includes('camaron') || n.includes('ceviche')) {
    return { id: 'pescados', label: 'Pescados & Mariscos', icon: '🐟' };
  }
  if (n.includes('cebolla') || n.includes('limon') || n.includes('limón') || n.includes('aji') || n.includes('ají') || n.includes('tomate') || n.includes('menta') || n.includes('culantro') || n.includes('papa') || n.includes('choclo') || n.includes('camote') || n.includes('palta') || n.includes('lechuga') || n.includes('hierba') || n.includes('rocoto') || n.includes('fruta')) {
    return { id: 'frescos', label: 'Frescos & Verduras', icon: '🥬' };
  }
  if (n.includes('queso') || n.includes('leche') || n.includes('huevo') || n.includes('mantequilla') || n.includes('crema')) {
    return { id: 'lacteos', label: 'Lácteos & Huevos', icon: '🧀' };
  }
  if (n.includes('arroz') || n.includes('harina') || n.includes('fideo') || n.includes('pasta') || n.includes('aceite') || n.includes('vinagre') || n.includes('salsa') || n.includes('azucar') || n.includes('sal') || n.includes('pimienta') || n.includes('sillao') || n.includes('kion')) {
    return { id: 'abarrotes', label: 'Abarrotes & Secos', icon: '🍚' };
  }
  return { id: 'suministros', label: 'Insumos Generales', icon: '📦' };
};

const getCleanSku = (item) => {
  if (!item?.id) return 'INS-0000';
  const cleanId = String(item.id).replace(/-/g, '').slice(-4).toUpperCase();
  return `INS-${cleanId}`;
};

// ─── Inventory Item Editor Modal ─────────────────────────────────────────────
function InventoryItemEditor({ item, onClose, notify }) {
  const { state, inventoryCommands } = useHotel();
  const canCreate = useActionPermission('INVENTORY_ITEM_CREATE');
  const canUpdate = useActionPermission('INVENTORY_ITEM_UPDATE');
  const allowed = item ? canUpdate : canCreate;

  const suppliersList = state.suppliers || [];

  const [form, setForm] = useState(item ? {
    name: item.name || '',
    unit: item.unit || 'unidad',
    lot: item.lot || '',
    minimum: item.minimum !== undefined ? item.minimum : 1,
    cost: item.cost !== undefined ? item.cost : 0,
    supplierId: item.supplierId || '',
  } : {
    name: '',
    unit: 'Litro',
    lot: '',
    minimum: 2,
    cost: 0,
    supplierId: '',
  });

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showAdjustPrompt, setShowAdjustPrompt] = useState(false);
  const [createdItem, setCreatedItem] = useState(null);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const buildBody = () => {
    const minimum = Number(form.minimum);
    const cost = Number(form.cost);
    if (!form.name.trim() || form.name.trim().length < 2) return { error: 'El nombre debe tener entre 2 y 160 caracteres.' };
    if (!form.unit.trim()) return { error: 'La unidad de medida es obligatoria.' };
    if (!Number.isFinite(minimum) || minimum < 0) return { error: 'El stock mínimo debe ser un número mayor o igual a 0.' };
    if (!Number.isFinite(cost) || cost < 0) return { error: 'El costo unitario debe ser un número mayor o igual a 0.' };
    return {
      body: {
        name: form.name.trim(),
        unit: form.unit.trim().slice(0, 40),
        lot: form.lot.trim() || null,
        minimum,
        cost,
        supplierId: form.supplierId.trim() || null,
      }
    };
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const { body, error } = buildBody();
    if (error) { setFormError(error); return; }
    setPending(true);
    try {
      if (item) {
        await inventoryCommands.updateItem(item.id, body);
        notify('Insumo actualizado', `${body.name} actualizado en almacén.`, 'success');
        onClose();
      } else {
        const created = await inventoryCommands.createItem(body);
        notify('Insumo registrado', `${body.name} se agregó al catálogo de almacén.`, 'success');
        setCreatedItem(created);
        setShowAdjustPrompt(true);
      }
    } catch (err) {
      const status = err?.status || err?.data?.statusCode;
      if (status === 401) { notify('Sesión vencida', 'Iniciá sesión nuevamente.', 'error'); return; }
      if (status === 403) { notify('Sin permiso', 'No tenés permiso para esta operación.', 'error'); return; }
      setFormError(err?.data?.message || err?.message || 'No se pudo guardar el insumo.');
    } finally {
      setPending(false);
    }
  };

  if (!allowed) return null;

  if (showAdjustPrompt && createdItem) {
    return (
      <div className="detail-stack">
        <div className="alert-banner alert-banner-info">
          El insumo <strong>{createdItem.name}</strong> fue creado con stock 0. ¿Deseas registrar su stock inicial mediante un ajuste?
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar sin ajustar</button>
          <button type="button" className="btn btn-primary" onClick={() => { setShowAdjustPrompt(false); onClose(); }}>
            Registrar stock inicial
          </button>
        </div>
      </div>
    );
  }

  const categoryInfo = getInventoryCategory(form.name, form.unit);

  return (
    <form className="form-grid" onSubmit={submit}>
      {/* Live Item Preview Banner */}
      <div className="span-2 inventory-editor-preview">
        <div className="inventory-editor-preview-main">
          <div className="inventory-editor-preview-icon">
            {categoryInfo.icon}
          </div>
          <div>
            <span className="inventory-editor-preview-category">
              {categoryInfo.label}
            </span>
            <h4 className="inventory-editor-preview-name">
              {form.name.trim() || 'Nombre del Insumo / Mercadería'}
            </h4>
          </div>
        </div>
        <div className="inventory-editor-preview-cost">
          <span className="inventory-editor-preview-cost-label">Costo Unitario</span>
          <strong className="inventory-editor-preview-cost-value">
            {Number(form.cost) > 0 ? formatMoney(Number(form.cost)) : 'S/ 0.00'}
          </strong>
        </div>
      </div>

      <label className="span-2">
        Nombre Oficial del Insumo *
        <input
          required
          value={form.name}
          maxLength={160}
          placeholder="Ej: Pisco Quebranta 42°, Lomo Fino de Res, Aceite de Oliva Extra Virgen..."
          onChange={(e) => set('name', e.target.value)}
          disabled={pending}
          className="inventory-editor-name-input" />
      </label>

      <label>
        Unidad de Medida Oficial *
        <div className="inventory-editor-unit-controls">
          <input
            required
            value={form.unit}
            maxLength={40}
            placeholder="Litro, kg, oz, und..."
            onChange={(e) => set('unit', e.target.value)}
            disabled={pending}
            className="inventory-editor-unit-input" />
          <select
            value=""
            onChange={(e) => { if (e.target.value) set('unit', e.target.value); }}
            disabled={pending}
            className="inventory-editor-unit-suggestion">
            <option value="">Sugerir...</option>
            <option value="Litro">Litro (L)</option>
            <option value="kg">Kilo (kg)</option>
            <option value="g">Gramo (g)</option>
            <option value="oz">Onza (oz)</option>
            <option value="und">Unidad (und)</option>
            <option value="botella">Botella</option>
            <option value="paquete">Paquete</option>
          </select>
        </div>
      </label>

      <label>
        Lote o Partida de Recepción
        <input
          value={form.lot}
          maxLength={60}
          placeholder="Ej: LOT-2026-09, Sin lote..."
          onChange={(e) => set('lot', e.target.value)}
          disabled={pending}
        />
      </label>

      <label>
        Stock Mínimo de Alerta *
        <input
          type="number"
          min="0"
          step="any"
          required
          value={form.minimum}
          onChange={(e) => set('minimum', e.target.value)}
          disabled={pending}
        />
      </label>

      <label>
        Costo Unitario de Adquisición (S/ PEN) *
          <div className="inventory-editor-cost-control">
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.cost}
            onChange={(e) => set('cost', e.target.value)}
            disabled={pending}
            className="inventory-editor-cost-input" />
          <span className="inventory-editor-currency">
            S/
          </span>
        </div>
      </label>

      <label className="span-2">
        Proveedor Habitual Homologado
        <select
          value={form.supplierId}
          onChange={(e) => set('supplierId', e.target.value)}
          disabled={pending}
          className="inventory-editor-supplier-select">
          <option value="">Sin proveedor asignado</option>
          {suppliersList.map((sup) => (
            <option key={sup.id} value={sup.id}>
              {sup.tradeName || sup.legalName} ({sup.taxId || 'RUC'})
            </option>
          ))}
        </select>
      </label>

      {formError ? <div className="alert-banner alert-banner-danger span-2" role="alert">{formError}</div> : null}

      <div className="form-actions span-2 inventory-editor-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancelar</button>
        <button className="btn btn-primary inventory-editor-submit" disabled={pending}>
          {pending ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}
          {pending ? 'Guardando…' : (item ? 'Guardar Cambios' : 'Registrar Insumo')}
        </button>
      </div>
    </form>
  );
}

// ─── Inventory Adjustment Modal with Live Calculator ─────────────────────────
function InventoryAdjustment({ item, onClose, notify }) {
  const { inventoryCommands } = useHotel();
  const allowed = useActionPermission('INVENTORY_ADJUST');
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState('Entrada');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState(null);

  const currentStock = Number(item.stock) || 0;
  const currentReserved = Number(item.reserved) || 0;
  const currentAvailable = currentStock - currentReserved;
  const adjustmentNum = Number(quantity) || 0;
  const resultantStock = Math.max(0, currentStock + adjustmentNum);
  const resultantAvailable = resultantStock - currentReserved;

  const setQuickAdjustment = (val) => {
    setQuantity(String(val));
    if (val > 0 && type === 'Merma') setType('Entrada');
    if (val < 0 && type === 'Entrada') setType('Merma');
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) {
      setFormError('Indicá una cantidad distinta de cero para el ajuste.');
      return;
    }
    setPending(true);
    try {
      await inventoryCommands.adjustStock(item.id, {
        quantity: qty,
        type,
        note: note.trim().slice(0, 300) || null,
      });
      notify('Ajuste confirmado', `${item.name}: ${qty > 0 ? '+' : ''}${qty} ${item.unit} (${type}).`, 'success');
      onClose();
    } catch (err) {
      const status = err?.status || err?.data?.statusCode;
      if (status === 401) { notify('Sesión vencida', 'Iniciá sesión nuevamente.', 'error'); setPending(false); return; }
      if (status === 403) { notify('Sin permiso', 'No tenés permiso para ajustar inventario.', 'error'); setPending(false); return; }
      if (status === 404) {
        notify('Insumo no encontrado', 'El insumo fue modificado o ya no existe.', 'error');
        inventoryCommands.reloadInventory().catch(() => {});
        onClose();
        return;
      }
      setFormError(err?.data?.message || err?.message || 'No se pudo confirmar el ajuste.');
    } finally {
      setPending(false);
    }
  };

  if (!allowed) return null;

  return (
    <form className="form-grid" onSubmit={submit}>
      {/* Visual Live Stock Transition Display */}
      <div className="span-2 inv-adjust-display">
        <div>
          <span className="inventory-adjust-label">
            Stock Actual
          </span>
          <strong className="inventory-adjust-current-value">
            {currentStock} <small className="inventory-adjust-unit">{item.unit}</small>
          </strong>
          <span className="inventory-adjust-available">
            Disp: {currentAvailable} {item.unit}
          </span>
        </div>

        <div className="inventory-adjust-symbol">
          {adjustmentNum >= 0 ? '+' : '−'}
        </div>

        <div>
          <span className="inventory-adjust-label">
            Ajuste
          </span>
          <strong className="inventory-adjust-value">
            {adjustmentNum !== 0 ? `${adjustmentNum > 0 ? '+' : ''}${adjustmentNum}` : '0'} <small className="inventory-adjust-unit">{item.unit}</small>
          </strong>
          <span className="inventory-adjust-type">
            {type}
          </span>
        </div>

        <div className="inventory-adjust-result-symbol">
          =
        </div>

        <div>
          <span className="inventory-adjust-label">
            Stock Resultante
          </span>
          <strong className="inventory-adjust-result-value">
            {resultantStock} <small className="inventory-adjust-unit">{item.unit}</small>
          </strong>
          <span className="inventory-adjust-result-status">
            {resultantAvailable < Number(item.minimum) ? '⚠️ Quedará bajo mínimo' : '🟢 Stock suficiente'}
          </span>
        </div>
      </div>

      {/* Quick Buttons for One-Click Adjustment */}
      <div className="span-2 inventory-adjust-quick-actions">
        <span className="inventory-adjust-quick-label">
          Ajuste rápido:
        </span>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(1)}>+1</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(5)}>+5</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(10)}>+10</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(25)}>+25</button>
        <button type="button" className="inv-quick-qty-btn inventory-adjust-negative" onClick={() => setQuickAdjustment(-1)}>-1</button>
        <button type="button" className="inv-quick-qty-btn inventory-adjust-negative" onClick={() => setQuickAdjustment(-5)}>-5</button>
        <button type="button" className="inv-quick-qty-btn inventory-adjust-negative" onClick={() => setQuickAdjustment(-10)}>-10</button>
      </div>

      <label>
        Cantidad de Ajuste ({item.unit}) *
        <input
          type="number"
          step="any"
          required
          placeholder="Ej: 5 ó -2"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={pending}
         className="inventory-adjust-quantity-input" />
        <small>Valores positivos suman stock; negativos descuentan merma o consumo.</small>
      </label>

      <label>
        Motivo / Tipo Operativo *
        <select value={type} onChange={(e) => setType(e.target.value)} disabled={pending}>
          <option value="Entrada">Entrada (Compra / Recepción de Proveedor)</option>
          <option value="Ajuste">Ajuste Físico (Inventario Periódico)</option>
          <option value="Merma">Merma / Rotura / Vencimiento</option>
          <option value="Consumo">Consumo Evento / Degustación Especial</option>
          <option value="Devolucion">Devolución a Proveedor</option>
        </select>
      </label>

      <label className="span-2">
        Nota de Auditoría o Referencia
        <textarea
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: Factura F001-492, rotura en barra durante evento, conteo de fin de mes..."
          disabled={pending}
          rows={2}
        />
      </label>

      {formError ? <div className="alert-banner alert-banner-danger span-2" role="alert">{formError}</div> : null}

      <div className="form-actions span-2 inventory-adjust-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancelar</button>
        <button className="btn btn-primary inventory-adjust-submit" disabled={pending}>
          {pending ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}
          {pending ? 'Registrando…' : 'Confirmar Ajuste'}
        </button>
      </div>
    </form>
  );
}

// ─── Kardex / History Modal for Specific Item ────────────────────────────────
function InventoryKardexModal({ item, ledgerEntries, onClose }) {
  if (!item) return null;
  const filteredLedger = ledgerEntries.filter((e) => e.inventoryItemId === item.id);
  const categoryInfo = getInventoryCategory(item.name, item.unit);
  const currentStock = Number(item.stock) || 0;
  const unitCost = Number(item.cost) || 0;
  const totalValuation = Math.round(currentStock * unitCost * 100) / 100;

  return (
    <Dialog open={true} onClose={onClose} title={`Kardex Operativo: ${item.name}`} wide>
      <div className="detail-stack">
        {/* Item Header Snapshot */}
        <div className="inventory-kardex-summary">
          <div>
            <span className="inventory-kardex-label">Rubro</span>
            <strong className="inventory-kardex-category">
              {categoryInfo.icon} {categoryInfo.label}
            </strong>
          </div>
          <div>
            <span className="inventory-kardex-label">Stock Físico Actual</span>
            <strong className="inventory-kardex-stock">
              {item.stock} {item.unit}
            </strong>
          </div>
          <div>
            <span className="inventory-kardex-label">Stock Disponible</span>
            <strong className="inventory-kardex-available">
              {inventoryAvailable(item)} {item.unit}
            </strong>
          </div>
          <div>
            <span className="inventory-kardex-label">Stock Mínimo</span>
            <strong className="inventory-kardex-minimum">
              {item.minimum} {item.unit}
            </strong>
          </div>
          <div>
            <span className="inventory-kardex-label">Valorización en Almacén</span>
            <strong className="inventory-kardex-valuation">
              {formatMoney(totalValuation)}
            </strong>
          </div>
        </div>

        {/* Ledger History Table */}
        <h4 className="inventory-kardex-title">
          Libro de Movimientos Históricos ({filteredLedger.length})
        </h4>

        {filteredLedger.length === 0 ? (
          <div className="inventory-kardex-empty">
            <Package size={28} color="var(--color-muted)"  className="inventory-kardex-empty-icon" />
            <p className="inventory-kardex-empty-text">
              Este insumo no tiene movimientos registrados en el libro aún.
            </p>
          </div>
        ) : (
          <div className="inventory-kardex-table-container">
            <table className="custom-table inventory-kardex-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Tipo</th>
                  <th className="inventory-kardex-quantity-header">Cantidad</th>
                  <th>Referencia</th>
                  <th>Nota / Glosa</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map((entry) => {
                  const qty = Number(entry.quantity);
                  const isPositive = qty > 0;
                  return (
                    <tr key={entry.id}>
                      <td className="inventory-kardex-date">{displayDateTime(entry.createdAt)}</td>
                      <td>
                        <span className="inventory-kardex-type">
                          {entry.type}
                        </span>
                      </td>
                      <td className="inventory-kardex-quantity">
                        {isPositive ? '+' : ''}{qty} {item.unit}
                      </td>
                      <td>{entry.referenceId || 'Manual'}</td>
                      <td>{entry.note || '—'}</td>
                      <td className="inventory-kardex-responsible">{entry.responsible || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions inventory-kardex-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar Kardex</button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Archive Inventory Dialog ────────────────────────────────────────────────
function ArchiveInventoryDialog({ item, onClose, notify }) {
  const { inventoryCommands } = useHotel();
  const allowed = useActionPermission('INVENTORY_ITEM_ARCHIVE');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 300) {
      setFormError('El motivo debe tener entre 3 y 300 caracteres.');
      return;
    }
    setPending(true);
    try {
      await inventoryCommands.archiveItem(item.id, { reason: trimmed });
      notify('Insumo archivado', `${item.name} ha sido archivado. Podrás reactivarlo en cualquier momento.`, 'success');
      onClose();
    } catch (err) {
      const status = err?.status || err?.data?.statusCode;
      if (status === 401) { notify('Sesión vencida', 'Iniciá sesión nuevamente.', 'error'); setPending(false); return; }
      if (status === 403) { notify('Sin permiso', 'No tenés permiso para archivar insumos.', 'error'); setPending(false); return; }
      setFormError(err?.data?.message || err?.message || 'No se pudo confirmar el archivado.');
    } finally {
      setPending(false);
    }
  };

  if (!allowed) return null;
  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="alert-banner alert-banner-danger span-2">
        Esta acción pausará y archivará <strong>{item.name}</strong>. Permanecerá disponible en el historial del libro y podrás reactivarlo.
      </div>
      <label className="span-2">
        Motivo del archivado *
        <textarea
          required
          minLength={3}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: Insumo discontinuado por el proveedor o reemplazado por nueva marca..."
          disabled={pending}
          rows={3}
        />
        <small>{reason.length}/300 caracteres</small>
      </label>
      {formError ? <div className="alert-banner alert-banner-danger span-2" role="alert">{formError}</div> : null}
      <div className="form-actions span-2">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancelar</button>
        <button className="btn btn-danger" disabled={pending}>{pending ? 'Archivando…' : 'Confirmar Archivado'}</button>
      </div>
    </form>
  );
}

// ─── Main Operational Inventory View (Luxury 5★ Edition) ─────────────────────
export function OperationalInventoryView({ notify }) {
  const { state, inventoryCommands, restaurantCommands } = useHotel();
  const inventoryResource = useRestaurantResource(state, restaurantCommands, 'inventory');
  const ledgerResource = useRestaurantResource(state, restaurantCommands, 'inventoryLedger');

  const canCreate = useActionPermission('INVENTORY_ITEM_CREATE');
  const canUpdate = useActionPermission('INVENTORY_ITEM_UPDATE');
  const canAdjust = useActionPermission('INVENTORY_ADJUST');
  const canArchive = useActionPermission('INVENTORY_ITEM_ARCHIVE');

  const [tab, setTab] = useState('productos');
  const [segment, setSegment] = useState('todos'); // 'todos' | 'bar' | 'carnes' | 'pescados' | 'frescos' | 'lacteos' | 'abarrotes' | 'suministros'
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos'); // 'todos' | 'optimo' | 'bajo_minimo' | 'agotados' | 'archivados'
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'stock_asc' | 'stock_desc' | 'value_desc'
  const [editor, setEditor] = useState(undefined);
  const [adjustId, setAdjustId] = useState(null);
  const [archiveItem, setArchiveItem] = useState(null);
  const [kardexItem, setKardexItem] = useState(null);

  const inventoryStatus = inventoryResource.status;
  const ledgerStatus = ledgerResource.status;
  const suppliersMap = useMemo(() => new Map((state.suppliers || []).map(s => [s.id, s])), [state.suppliers]);

  const isArchived = (item) => item.status === 'archived' || item.status === 'Archivado';
  const isBelowMin = (item) => !isArchived(item) && inventoryAvailable(item) <= Number(item.minimum) && inventoryAvailable(item) > 0;
  const isCritical = (item) => !isArchived(item) && inventoryAvailable(item) <= 0;

  // Total valuation: sum of (stock * cost)
  const totalValuation = useMemo(() => {
    return inventoryResource.data.reduce((sum, item) => {
      if (isArchived(item)) return sum;
      return sum + (Number(item.stock) || 0) * (Number(item.cost) || 0);
    }, 0);
  }, [inventoryResource.data]);

  // Segment counts
  const segmentStats = useMemo(() => {
    const stats = { todos: inventoryResource.data.length };
    inventoryResource.data.forEach((i) => {
      const cat = getInventoryCategory(i.name, i.unit).id;
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return stats;
  }, [inventoryResource.data]);

  // Filter & Sort records
  const records = useMemo(() => {
    let list = inventoryResource.data.filter((item) => {
      // 1. Segment filter
      if (segment !== 'todos') {
        const cat = getInventoryCategory(item.name, item.unit).id;
        if (cat !== segment) return false;
      }

      // 2. Status filter
      if (statusFilter === 'archivados' && !isArchived(item)) return false;
      if (statusFilter !== 'archivados' && isArchived(item) && statusFilter !== 'todos') return false;
      if (statusFilter === 'bajo_minimo' && !isBelowMin(item)) return false;
      if (statusFilter === 'agotados' && !isCritical(item)) return false;
      if (statusFilter === 'optimo' && (isBelowMin(item) || isCritical(item) || isArchived(item))) return false;

      // 3. Search query
      if (query.trim()) {
        const q = query.toLowerCase();
        const sku = getCleanSku(item).toLowerCase();
        const sup = (item.supplierName || (item.supplierId && suppliersMap.get(item.supplierId)?.tradeName) || '').toLowerCase();
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchLot = (item.lot || '').toLowerCase().includes(q);
        const matchSku = sku.includes(q);
        const matchSup = sup.includes(q);
        if (!matchName && !matchLot && !matchSku && !matchSup) return false;
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'stock_asc') return (Number(a.stock) || 0) - (Number(b.stock) || 0);
      if (sortBy === 'stock_desc') return (Number(b.stock) || 0) - (Number(a.stock) || 0);
      if (sortBy === 'value_desc') {
        const valA = (Number(a.stock) || 0) * (Number(a.cost) || 0);
        const valB = (Number(b.stock) || 0) * (Number(b.cost) || 0);
        return valB - valA;
      }
      return 0;
    });
  }, [inventoryResource.data, segment, statusFilter, query, sortBy, suppliersMap]);

  const adjustment = inventoryResource.data.find((item) => item.id === adjustId);

  const handleReactivate = async (item) => {
    try {
      await inventoryCommands.reactivateItem(item.id);
      notify('Insumo reactivado', `${item.name} ahora está activo en el inventario.`, 'success');
    } catch (err) {
      notify('Error al reactivar', err.message || 'No se pudo reactivar el insumo.', 'error');
    }
  };

  return (
    <div className="view-container">
      {/* ─── Luxury Page Header ────────────────────────────────────────────── */}
      <PageHeader
        actionType="INVENTORY_ITEM_CREATE"
        metadata="Control Físico & Valorización de Almacén 5★"
        title="Inventario de Insumos"
        description="Gestión de materias primas, control de existencias, libro de movimientos y costos de adquisición del hotel."
        action={
          canCreate ? (
            <button
              type="button"
              className="btn btn-primary inventory-page-create"
              onClick={() => setEditor(null)}
            >
              <Plus size={16} /> Nuevo Insumo
            </button>
          ) : null
        }
      />

      {/* ─── Enriched Metric Strip with Total Valuation ────────────────────── */}
      <MetricStrip items={[
        { label: 'Total Insumos', value: inventoryResource.data.length },
        { label: 'Valorización Almacén', value: formatMoney(totalValuation) },
        { label: 'Insumos Activos', value: inventoryResource.data.filter((i) => !isArchived(i)).length },
        { label: 'Bajo Mínimo (Reponer)', value: inventoryResource.data.filter(isBelowMin).length },
        { label: 'Sin Stock (Agotados)', value: inventoryResource.data.filter(isCritical).length },
        { label: 'Movimientos en Libro', value: ledgerResource.data.length },
      ]} />

      {inventoryResource.data.some(isCritical) ? (
        <div className="alert-banner alert-banner-danger inventory-critical-alert">
          <AlertTriangle size={16} />
          <span>Existen insumos con stock agotado o sobre-reservado que requieren compra urgente para no interrumpir el servicio.</span>
        </div>
      ) : null}

      {(inventoryResource.isForbidden || ledgerResource.isForbidden) ? (
        <div className="alert-banner alert-banner-warning">No tienes permisos suficientes para ver todas las secciones de este módulo.</div>
      ) : null}

      {/* ─── Main Tabs: Insumos vs Libro de Movimientos ───────────────────── */}
      <Tabs label="Inventario y libro" activeTab={tab} onChange={setTab} tabs={[
        { id: 'productos', label: `Insumos en Almacén (${inventoryResource.data.length})` },
        { id: 'ledger', label: `Libro de Movimientos (${ledgerResource.data.length})` },
      ]} />

      <TabPanel active={tab === 'productos'} label="Insumos">
        {inventoryStatus === 'loading' ? (
          <div className="alert-banner alert-banner-info" role="status">Cargando inventario físico…</div>
        ) : inventoryStatus === 'error' ? (
          <div className="alert-banner alert-banner-danger">
            {inventoryResource.error || 'No se pudo cargar el inventario.'}
            <button className="btn btn-sm btn-outline inventory-retry" onClick={() => inventoryResource.reload()}>Reintentar</button>
          </div>
        ) : inventoryStatus === 'forbidden' ? (
          <div className="alert-banner alert-banner-danger">No tienes permiso para ver el inventario físico.</div>
        ) : null}

        {(inventoryStatus !== 'loading' && inventoryStatus !== 'forbidden') ? (
          <>
            {/* ─── Department / Rubro Quick Segment Buttons ────────────────── */}
            <div className="inv-segments-bar">
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'todos' ? 'active' : ''}`}
                onClick={() => setSegment('todos')}
              >
                ✨ Todos <span className="inv-segment-badge">{segmentStats.todos || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'bar' ? 'active' : ''}`}
                onClick={() => setSegment('bar')}
              >
                🍸 Bar & Coctelería <span className="inv-segment-badge">{segmentStats.bar || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'carnes' ? 'active' : ''}`}
                onClick={() => setSegment('carnes')}
              >
                🥩 Carnes & Aves <span className="inv-segment-badge">{segmentStats.carnes || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'pescados' ? 'active' : ''}`}
                onClick={() => setSegment('pescados')}
              >
                🐟 Pescados & Mariscos <span className="inv-segment-badge">{segmentStats.pescados || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'frescos' ? 'active' : ''}`}
                onClick={() => setSegment('frescos')}
              >
                🥬 Frescos & Frutas <span className="inv-segment-badge">{segmentStats.frescos || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'abarrotes' ? 'active' : ''}`}
                onClick={() => setSegment('abarrotes')}
              >
                🍚 Abarrotes & Secos <span className="inv-segment-badge">{segmentStats.abarrotes || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'lacteos' ? 'active' : ''}`}
                onClick={() => setSegment('lacteos')}
              >
                🧀 Lácteos & Huevos <span className="inv-segment-badge">{segmentStats.lacteos || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'suministros' ? 'active' : ''}`}
                onClick={() => setSegment('suministros')}
              >
                📦 Insumos Varios <span className="inv-segment-badge">{segmentStats.suministros || 0}</span>
              </button>
            </div>

            {/* ─── Filter & Search Toolbar ──────────────────────────────────── */}
            <FilterBar label="Filtros de inventario" className="inventory-filter-toolbar">
              <div className="inventory-filter-group">
                <label className="search-label inventory-filter-search">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por insumo, SKU, lote o proveedor..."
                    aria-label="Buscar insumos"
                  />
                </label>
                <label className="inventory-filter-status">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="todos">Todos los estados</option>
                    <option value="optimo">🟢 Stock Óptimo</option>
                    <option value="bajo_minimo">🟡 Bajo Mínimo (Reponer)</option>
                    <option value="agotados">🔴 Agotados (0 stock)</option>
                    <option value="archivados">📦 Archivados</option>
                  </select>
                </label>
                <label className="inventory-filter-sort">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="name">Nombre: A - Z</option>
                    <option value="stock_asc">Stock: Menor a Mayor</option>
                    <option value="stock_desc">Stock: Mayor a Menor</option>
                    <option value="value_desc">Mayor Valorización (S/)</option>
                  </select>
                </label>
              </div>

              <div className="inventory-filter-result">
                <span className="filter-result">{records.length} insumos listados</span>
              </div>
            </FilterBar>

            {/* ─── Table View (Directorio de Almacén) ───────────────────────── */}
            <DataTable
              caption="Stock físico, reservado y disponible con valorización"
              columns={['Insumo / Rubro', 'Físico / Salud', 'Reservado', 'Disponible', 'Costo Unit. / Valor', 'Proveedor', 'Estado', 'Acciones']}
              emptyTitle="Sin insumos coincidentes"
            >
              {records.length ? records.map((item) => {
                const archived = isArchived(item);
                const belowMin = isBelowMin(item);
                const critical = isCritical(item);
                const category = getInventoryCategory(item.name, item.unit);
                const sku = getCleanSku(item);
                const stockNum = Number(item.stock) || 0;
                const minNum = Number(item.minimum) || 1;
                const availableNum = inventoryAvailable(item);
                const costNum = Number(item.cost) || 0;
                const lineValuation = Math.round(stockNum * costNum * 100) / 100;
                const healthRatio = minNum > 0 ? Math.min(100, Math.max(0, (stockNum / minNum) * 50)) : 100;

                // Resolved supplier name
                const resolvedSupplierName = item.supplierName || (item.supplierId && suppliersMap.get(item.supplierId)?.tradeName) || (item.supplierId && suppliersMap.get(item.supplierId)?.legalName) || null;

                return (
                  <tr key={item.id} className="inventory-row">
                    {/* 1. Name, Rubro & SKU */}
                    <td>
                      <div className="inventory-item-cell">
                        <div className="inventory-item-icon">
                          {category.icon}
                        </div>
                        <div>
                          <strong className="inventory-item-name">{item.name}</strong>
                          <div className="inventory-item-meta">
                            <span className="inventory-item-sku">
                              {sku}
                            </span>
                            <span className="inventory-item-lot">
                              {item.lot ? `Lote: ${item.lot}` : 'Sin lote'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Physical Stock & Health Bar */}
                    <td className="inventory-stock-cell">
                      <div className="inventory-stock-value">
                        <strong className="inventory-stock-number">{item.stock}</strong>
                        <span className="inventory-stock-unit">{item.unit}</span>
                      </div>
                      <div className="inv-health-bar" title={`Stock Físico: ${item.stock} / Mínimo: ${item.minimum}`}>
                        <div
                        className={`inv-health-fill ${critical ? 'critical' : belowMin ? 'warning' : 'optimal'} health-ratio-${healthRatio >= 75 ? 'high' : healthRatio >= 35 ? 'medium' : 'low'}`}
                        />
                      </div>
                      <small className="inventory-stock-minimum">Min: {item.minimum} {item.unit}</small>
                    </td>

                    {/* 3. Reserved */}
                    <td>
                      <span className="inventory-reserved-value">
                        {item.reserved} {item.unit}
                      </span>
                    </td>

                    {/* 4. Available with Smart Pill */}
                    <td>
                      <div className="inventory-available-cell">
                        <strong className="inventory-available-value">
                          {availableNum} {item.unit}
                        </strong>
                        {critical ? (
                          <span className="inv-status-pill critical">🔴 Agotado</span>
                        ) : belowMin ? (
                          <span className="inv-status-pill warning">⚠️ Reponer</span>
                        ) : (
                          <span className="inv-status-pill optimal">🟢 Óptimo</span>
                        )}
                      </div>
                    </td>

                    {/* 5. Unit Cost & Total Line Value */}
                    <td>
                      <div className="inventory-cost-cell">
                        <span className="inventory-cost-unit">
                          Unit: {formatMoney(costNum)}
                        </span>
                        <strong className="inventory-line-value">
                          {formatMoney(lineValuation)}
                        </strong>
                      </div>
                    </td>

                    {/* 6. Supplier */}
                    <td>
                      {resolvedSupplierName ? (
                        <div className="inventory-supplier-value">
                          <Building2 size={13} color="var(--color-gold)" />
                          <span className="inventory-supplier-name">{resolvedSupplierName}</span>
                        </div>
                      ) : (
                        <span className="inventory-no-supplier">
                          Sin proveedor
                        </span>
                      )}
                    </td>

                    {/* 7. Status */}
                    <td>
                      <StatusBadge>{archived ? 'Archivado' : 'Activo'}</StatusBadge>
                    </td>

                    {/* 8. Quick Actions */}
                    <td>
                      <div className="quick-actions-row inventory-row-actions">
                        {!archived ? (
                          <>
                            {canAdjust ? (
                              <button
                                type="button"
                                className="quick-action-btn btn-action-view inventory-adjust-action"
                                data-tooltip="Ajustar stock (Entrada / Merma)"
                                onClick={() => setAdjustId(item.id)}
                              >
                                <Plus size={13} />
                                <span className="inventory-action-label">Ajustar</span>
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className="quick-action-btn inventory-kardex-action"
                              data-tooltip="Ver Kardex / Historial de movimientos"
                              onClick={() => setKardexItem(item)}
                            >
                              <History size={13} />
                              <span className="inventory-action-label">Kardex</span>
                            </button>

                            {canUpdate ? (
                              <button
                                type="button"
                                className="quick-action-btn btn-action-edit"
                                data-tooltip="Editar ficha del insumo"
                                onClick={() => setEditor(item)}
                              >
                                <Edit size={13} />
                              </button>
                            ) : null}

                            {canArchive ? (
                              <button
                                type="button"
                                className="quick-action-btn btn-action-lock"
                                data-tooltip="Pausar y archivar insumo"
                                onClick={() => setArchiveItem(item)}
                              >
                                <Lock size={13} />
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline inventory-reactivate-action"
                            onClick={() => handleReactivate(item)}
                          >
                            <RotateCcw size={12} /> Reactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : null}
            </DataTable>
          </>
        ) : null}
      </TabPanel>

      {/* ─── Tab 2: Full Ledger (Libro de Movimientos General) ─────────────── */}
      <TabPanel active={tab === 'ledger'} label="Libro de movimientos">
        {ledgerStatus === 'loading' ? (
          <div className="alert-banner alert-banner-info" role="status">Cargando libro de movimientos…</div>
        ) : ledgerStatus === 'error' ? (
          <div className="alert-banner alert-banner-danger">
            {ledgerResource.error || 'No se pudo cargar el libro.'}
            <button className="btn btn-sm btn-outline ledger-retry-action" onClick={() => ledgerResource.reload()}>Reintentar</button>
          </div>
        ) : ledgerStatus === 'forbidden' ? (
          <div className="alert-banner alert-banner-danger">No tienes permiso para ver el libro de movimientos.</div>
        ) : null}

        {(ledgerStatus !== 'loading' && ledgerStatus !== 'forbidden') ? (
          <DataTable
            caption="Auditoría completa de entradas, mermas y ajustes de inventario"
            columns={['Fecha y Hora', 'Insumo / Rubro', 'Tipo de Movimiento', 'Cantidad', 'Referencia', 'Nota / Glosa', 'Responsable']}
          >
            {ledgerResource.data.length ? ledgerResource.data.map((entry) => {
              const item = inventoryResource.data.find((record) => record.id === entry.inventoryItemId);
              const cat = item ? getInventoryCategory(item.name, item.unit) : null;
              const qty = Number(entry.quantity);
              const isPositive = qty > 0;

              return (
                <tr key={entry.id}>
                  <td className="ledger-date">{displayDateTime(entry.createdAt)}</td>
                  <td>
                    {item ? (
                      <div className="ledger-item-cell">
                        <span>{cat?.icon || '📦'}</span>
                        <div>
                          <strong className="ledger-item-name">{item.name}</strong>
                          <br />
                          <small className="ledger-item-meta">{getCleanSku(item)} · Lote: {item.lot || 'Sin lote'}</small>
                        </div>
                      </div>
                    ) : (
                      <span className="ledger-item-unavailable">Insumo no disponible</span>
                    )}
                  </td>
                  <td>
                    <span className="ledger-movement-type">
                      {entry.type}
                    </span>
                  </td>
                  <td className="ledger-quantity">
                    {isPositive ? '+' : ''}{qty}{item ? ` ${item.unit}` : ''}
                  </td>
                  <td>{entry.referenceId || 'Manual'}</td>
                  <td>{entry.note || '—'}</td>
                  <td className="ledger-responsible">{entry.responsible || '—'}</td>
                </tr>
              );
            }) : null}
          </DataTable>
        ) : null}
      </TabPanel>

      {/* ─── Modals ──────────────────────────────────────────────────────────── */}
      {/* 1. Modal Nuevo / Editar Insumo */}
      <Dialog open={editor !== undefined} onClose={() => setEditor(undefined)} title={editor ? `Editar Ficha: ${editor.name}` : 'Nuevo Insumo para Almacén'} wide>
        <InventoryItemEditor item={editor || null} onClose={() => setEditor(undefined)} notify={notify} />
      </Dialog>

      {/* 2. Modal Ajuste con Calculadora en Vivo */}
      <Dialog open={Boolean(adjustment)} onClose={() => setAdjustId(null)} title={adjustment ? `Registrar Ajuste: ${adjustment.name}` : 'Ajuste de Stock'} wide>
        {adjustment ? <InventoryAdjustment item={adjustment} onClose={() => setAdjustId(null)} notify={notify} /> : null}
      </Dialog>

      {/* 3. Modal Archivar Insumo */}
      <Dialog open={Boolean(archiveItem)} onClose={() => setArchiveItem(null)} title={archiveItem ? `Archivar: ${archiveItem.name}` : 'Archivar insumo'}>
        {archiveItem ? <ArchiveInventoryDialog item={archiveItem} onClose={() => setArchiveItem(null)} notify={notify} /> : null}
      </Dialog>

      {/* 4. Drawer / Modal Kardex Histórico por Insumo */}
      {kardexItem && (
        <InventoryKardexModal
          item={kardexItem}
          ledgerEntries={ledgerResource.data}
          onClose={() => setKardexItem(null)}
        />
      )}
    </div>
  );
}


function CashOpenForm({ onClose, notify }) {
  const { cashCommands } = useHotel();
  const allowed = useActionPermission('CASH_OPEN');
  const [form, setForm] = useState({ responsible: '', shift: 'Mañana', openingAmount: 0, notes: '' });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (cashCommands) {
      try {
        await cashCommands.open(form);
        notify('Caja abierta', 'El turno quedó disponible para registrar movimientos.', 'success');
        onClose();
      } catch (error) {
        notify('Error al abrir caja', error.message, 'error');
      }
    }
  };
  if (!allowed) return null;
  return <form className="form-grid" onSubmit={submit}><label className="span-2">Responsable<input required value={form.responsible} onChange={(event) => set('responsible', event.target.value)} /></label><label>Turno<select value={form.shift} onChange={(event) => set('shift', event.target.value)}><option>Mañana</option><option>Tarde</option><option>Noche</option></select></label><label>Fondo inicial<input type="number" min="0" step="any" value={form.openingAmount} onChange={(event) => set('openingAmount', event.target.value)} /></label><label className="span-2">Notas<textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} /></label><div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Abrir caja</button></div></form>;
}

function CashCountForm({ close, expected, onClose, onSessionClosed, notify }) {
  const { state, cashCommands } = useHotel();
  const allowed = useActionPermission(close ? 'CASH_CLOSE' : 'CASH_COUNT');
  const [mode, setMode] = useState('calculator'); // 'calculator' | 'manual'
  const [blindMode, setBlindMode] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [countedAmount, setCountedAmount] = useState(expected);
  const [breakdownSummary, setBreakdownSummary] = useState('');
  const [note, setNote] = useState('');

  const difference = Number(countedAmount) - expected;
  const isDiscrepancy = Math.abs(difference) >= 5.00;

  const submit = async (event) => {
    event.preventDefault();
    if (cashCommands) {
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
      }
    }
  };

  if (!allowed) return null;

  return (
    <form className="form-grid cash-count-form" onSubmit={submit}>
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
        <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary">{close ? 'Cerrar caja' : 'Guardar arqueo'}</button>
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

export function OperationalCashView({ notify }) {
  const { state, cashCommands } = useHotel();
  const [dialog, setDialog] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [reportSession, setReportSession] = useState(null);
  const [movementPreset, setMovementPreset] = useState(null);
  const [movementFilter, setMovementFilter] = useState('ALL'); // 'ALL' | 'INGRESO' | 'EGRESO' | 'CASH_DROP'
  const [movementSearch, setMovementSearch] = useState('');

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
    <div className="view-container cash-dashboard">

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
  );
}

const COMMON_INCIDENT_PRESETS = [
  { label: '🧹 Limpieza Profunda Extra', type: 'Limpieza', desc: 'Requiere aspirado profundo, cambio de sábanas y desinfección integral.', priority: 'Media' },
  { label: '💧 Derrame / Filtración', type: 'Limpieza', desc: 'Derrame de líquidos en alfombra y piso que requiere secado urgente.', priority: 'Alta', blocksRoom: true },
  { label: '🔧 Falla Técnica Reportada', type: 'Mantenimiento', desc: 'Huésped reporta falla en equipamiento o mobiliario de la habitación.', priority: 'Alta' },
  { label: '🔊 Reporte de Ruido / Confort', type: 'Servicio', desc: 'Reclamo por ruidos molestos en pasillo o habitación continua.', priority: 'Media' },
  { label: '🧴 Falta Toallas / Amenities', type: 'Servicio', desc: 'Reposición inmediata de toallas de baño, shampoo y kit de amenidades.', priority: 'Baja' },
  { label: '📦 Objeto Olvidado', type: 'Servicio', desc: 'Huésped olvidó pertenencias personales en la habitación tras el check-out.', priority: 'Baja' },
];

function getIncidentTypeIcon(type = '') {
  const t = type.toLowerCase();
  if (t.includes('limp') || t.includes('clean')) return '🧹';
  if (t.includes('mant') || t.includes('repar')) return '🔧';
  if (t.includes('serv') || t.includes('huesped') || t.includes('room')) return '🛎️';
  if (t.includes('segur') || t.includes('llave')) return '🛡️';
  return '⚠️';
}

function IncidentEditor({ incident, onClose, notify }) {
  const { state, execute, incidentCommands } = useHotel();
  const canCreate = useActionPermission('INCIDENT_CREATE');
  const canUpdate = useActionPermission('INCIDENT_UPDATE');
  const progressActionType = incident?.status === 'Cerrada' ? 'INCIDENT_REOPEN' : 'INCIDENT_PROGRESS';
  const canProgress = useActionPermission(progressActionType);
  const [form, setForm] = useState(incident ? {
    responsible: incident.responsible,
    priority: incident.priority,
    evidence: '',
    solution: incident.solution || '',
    note: '',
    releaseRoom: incident.blocksRoom,
  } : {
    type: 'Limpieza',
    roomId: '',
    description: '',
    priority: 'Media',
    responsible: 'Por asignar',
    evidence: '',
    blocksRoom: false,
  });
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const applyPreset = (preset) => {
    setForm((current) => ({
      ...current,
      type: preset.type,
      description: preset.desc,
      priority: preset.priority,
      blocksRoom: Boolean(preset.blocksRoom),
    }));
  };

  if (incident) {
    const save = async () => {
      setBusy(true);
      if (incidentCommands) {
        try {
          await incidentCommands.update(incident.id, {
            responsible: form.responsible,
            priority: form.priority,
            solution: form.solution || undefined,
            evidence: form.evidence || undefined,
          });
          notify('Incidencia actualizada', 'Responsable, prioridad y solución quedaron sincronizados.', 'success');
        } catch (error) {
          notify('Error al actualizar incidencia', error.message, 'error');
        } finally {
          setBusy(false);
        }
      } else {
        run(execute, { type: 'INCIDENT_UPDATE', incidentId: incident.id, payload: form }, notify, 'Incidencia actualizada', 'Responsable, prioridad y evidencia quedaron sincronizados.');
        setBusy(false);
      }
    };

    const advance = async () => {
      setBusy(true);
      if (incidentCommands) {
        try {
          await incidentCommands.progress(incident.id, incident.status);
          notify('Incidencia avanzada', 'La incidencia avanzó de estado exitosamente.', 'success');
          onClose();
        } catch (error) {
          notify('Error al avanzar incidencia', error.message, 'error');
        } finally {
          setBusy(false);
        }
      } else {
        if (run(execute, { type: 'INCIDENT_PROGRESS', incidentId: incident.id, expectedStatus: incident.status, note: form.note || form.solution }, notify, 'Incidencia avanzada', 'El origen vinculado y la habitación quedaron sincronizados.')) onClose();
        setBusy(false);
      }
    };

    const reopen = async () => {
      setBusy(true);
      if (incidentCommands) {
        try {
          await incidentCommands.progress(incident.id, 'closed');
          notify('Incidencia reabierta', 'La incidencia volvió a proceso y la habitación recuperó el bloqueo.', 'success');
          onClose();
        } catch (error) {
          notify('Error al reabrir incidencia', error.message, 'error');
        } finally {
          setBusy(false);
        }
      } else {
        if (run(execute, { type: 'INCIDENT_REOPEN', incidentId: incident.id, reason: form.note }, notify, 'Incidencia reabierta', 'La habitación recuperó su bloqueo cuando correspondiera.'));
        setBusy(false);
      }
    };

    if (!canUpdate && !canProgress) return null;

    const room = state.rooms.find((r) => r.id === incident.roomId || r.number === incident.roomId);
    const roomLabel = room ? `Habitación ${room.number} (Piso ${room.floor})` : incident.roomId ? `Habitación ${incident.roomId}` : 'Incidencia General';

    const nextActionLabel = {
      Pendiente: 'Iniciar Atención',
      Asignada: 'Comenzar Proceso',
      'En proceso': 'Marcar como Resuelta',
      Resuelta: 'Aprobar y Cerrar Incidencia',
      Cerrada: 'Reabrir Incidencia',
    }[incident.status] || 'Avanzar Estado';

    return (
      <div className="incident-detail">
        {/* Header Banner */}
        <div className="incident-banner">
          <div className="incident-banner-content">
            <span className="incident-type-icon">{getIncidentTypeIcon(incident.type)}</span>
            <div>
              <div className="incident-reference">
                INC-{incident.id.slice(0, 8).toUpperCase()} · {incident.type}
              </div>
              <strong className="incident-room">{roomLabel}</strong>
            </div>
          </div>
          <div className="incident-status">
            <PriorityTag priority={incident.priority} />
            <span className="incident-status-label">
              Estado: {incident.status}
            </span>
          </div>
        </div>

        {/* Stepper */}
        <div className="incident-stepper">
          <StatusStepper currentStatus={incident.status} steps={['Pendiente', 'Asignada', 'En proceso', 'Resuelta', 'Cerrada']} />
        </div>

        {/* Description info */}
        <div className="incident-description">
          <div className="incident-description-label">
            Descripción Reportada:
          </div>
          <div className="incident-description-text">
            {incident.description}
          </div>
        </div>

        {/* Form Fields */}
        <div className="form-grid incident-form">
          <label className="incident-field">
            <span>Personal Responsable Asignado</span>
            <input value={form.responsible} onChange={(event) => set('responsible', event.target.value)} placeholder="Personal encargado" />
          </label>

          <label className="incident-field">
            <span>Prioridad</span>
            <select value={form.priority} onChange={(event) => set('priority', event.target.value)}>
              {['Baja', 'Media', 'Alta', 'Urgente'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="span-2 incident-field">
            <span>Nueva Evidencia / Enlace</span>
            <input value={form.evidence} onChange={(event) => set('evidence', event.target.value)} placeholder="URL de fotos o comprobante de solución" />
          </label>

          <label className="span-2 incident-field">
            <span>Solución / Informe de Atención</span>
            <textarea rows={2} value={form.solution} onChange={(event) => set('solution', event.target.value)} placeholder="Detalle la solución aplicada para resolver la incidencia..." />
          </label>

          <label className="span-2 incident-field">
            <span>Nota Interna / Motivo</span>
            <textarea rows={2} value={form.note} onChange={(event) => set('note', event.target.value)} placeholder="Observaciones adicionales para el historial..." />
          </label>

          {incident.blocksRoom && (incident.status === 'Resuelta' || incident.status === 'En proceso') ? (
            <div className="span-2 incident-room-release">
              <label className="incident-room-release-label">
                <input type="checkbox" checked={form.releaseRoom} onChange={(event) => set('releaseRoom', event.target.checked)}  className="incident-room-release-checkbox" />
                <strong className="incident-room-release-text">
                  🔓 Liberar habitación y reincorporar al inventario disponible al cerrar la incidencia
                </strong>
              </label>
            </div>
          ) : null}

          <div className="form-actions span-2 incident-form-actions">
            {canUpdate ? (
              <PermissionButton actionType="INCIDENT_UPDATE" className="btn btn-outline incident-save-action" disabled={busy} onClick={save}>
                {busy ? 'Guardando…' : 'Guardar Cambios'}
              </PermissionButton>
            ) : <div />}

            {canProgress ? (
              incident.status === 'Cerrada' ? (
                <PermissionButton actionType={progressActionType} className="btn btn-outline incident-reopen-action" disabled={busy} onClick={reopen}>
                  {busy ? 'Procesando…' : '🔄 Reabrir Incidencia'}
                </PermissionButton>
              ) : (
                <PermissionButton actionType={progressActionType} className="btn btn-primary incident-advance-action" disabled={busy} onClick={advance}>
                  {busy ? 'Procesando…' : nextActionLabel}
                </PermissionButton>
              )
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (!canCreate) return null;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    if (incidentCommands) {
      try {
        await incidentCommands.create({
          type: form.type,
          roomId: form.roomId || undefined,
          description: form.description,
          priority: form.priority,
          responsible: form.responsible || undefined,
          blocksRoom: Boolean(form.blocksRoom),
          evidence: form.evidence || undefined,
        });
        notify('Incidencia creada', 'La incidencia quedó registrada exitosamente en el servidor.', 'success');
        onClose();
      } catch (error) {
        notify('Error al crear incidencia', error.message, 'error');
      } finally {
        setBusy(false);
      }
    } else {
      if (run(execute, { type: 'INCIDENT_CREATE', payload: form }, notify, 'Incidencia creada', 'El registro y el bloqueo operativo quedaron auditados.')) onClose();
      setBusy(false);
    }
  };

  return (
    <form className="form-grid incident-create-form" onSubmit={submit}>
      {/* Presets Bar */}
      <div className="span-2 incident-presets">
        <div className="incident-presets-label">
          Plantillas Rápidas de Incidencia Frecuente:
        </div>
        <div className="incident-preset-list">
          {COMMON_INCIDENT_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
             className="incident-preset-button">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label className="incident-create-field">
        <span>Tipo de Incidencia</span>
        <select value={form.type} onChange={(event) => set('type', event.target.value)}>
          <option value="Limpieza">🧹 Limpieza</option>
          <option value="Mantenimiento">🔧 Mantenimiento</option>
          <option value="Servicio">🛎️ Servicio / Atención</option>
        </select>
      </label>

      <label className="incident-create-field">
        <span>Habitación Afectada</span>
        <select value={form.roomId} onChange={(event) => set('roomId', event.target.value)}>
          <option value="">🏢 Sin habitación (Incidencia General)</option>
          {state.rooms.map((room) => (
            <option key={room.id} value={room.id}>
              Habitación {room.number} (Piso {room.floor}) — {room.status}
            </option>
          ))}
        </select>
      </label>

      <label className="incident-create-field">
        <span>Nivel de Prioridad & SLA</span>
        <select value={form.priority} onChange={(event) => set('priority', event.target.value)}>
          <option value="Baja">🟢 Baja (Atención dentro de 24h)</option>
          <option value="Media">🔵 Media (Atención dentro de 6h)</option>
          <option value="Alta">🟡 Alta (Atención dentro de 2h)</option>
          <option value="Urgente">🔴 Urgente (Atención Inmediata)</option>
        </select>
      </label>

      <label className="incident-create-field">
        <span>Responsable Inicial</span>
        <input value={form.responsible} onChange={(event) => set('responsible', event.target.value)} placeholder="Ej: Personal de piso / Por asignar" />
      </label>

      <label className="span-2 incident-create-field">
        <span>Descripción del Suceso</span>
        <textarea required rows={3} value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="Describa la incidencia reportada en detalle..." />
      </label>

      <label className="span-2 incident-create-field">
        <span>Evidencia / URL de Referencia (Opcional)</span>
        <input value={form.evidence} onChange={(event) => set('evidence', event.target.value)} placeholder="https://... URL de foto o referencia" />
      </label>

      <div className="span-2 incident-room-block">
        <label className="incident-room-block-label">
          <input type="checkbox" disabled={!form.roomId} checked={form.blocksRoom} onChange={(event) => set('blocksRoom', event.target.checked)}  className="incident-room-block-checkbox" />
          <div>
            <strong className="incident-room-block-title">
              🔒 Bloquear Operativamente la Habitación (Fuera de Servicio)
            </strong>
            <div className="incident-room-block-help">
              {form.roomId ? 'La habitación no podrá ser asignada a reservas mientras la incidencia permanezca activa.' : 'Seleccione una habitación para habilitar el bloqueo preventivo.'}
            </div>
          </div>
        </label>
      </div>

      <div className="form-actions span-2 incident-create-actions">
        <button type="button" className="btn btn-outline incident-cancel-action" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary incident-create-action" disabled={busy}>
          {busy ? 'Registrando incidencia…' : 'Crear Incidencia'}
        </button>
      </div>
    </form>
  );
}

export function OperationalIncidentsView({ notify }) {
  const { state } = useHotel();
  const canUpdateIncident = useActionPermission('INCIDENT_UPDATE');
  const canProgressIncident = useActionPermission('INCIDENT_PROGRESS');
  const canReopenIncident = useActionPermission('INCIDENT_REOPEN');

  const [editor, setEditor] = useState(undefined);

  // Custom filters
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todos');
  const [roomQuery, setRoomQuery] = useState('');

  // Helper to get friendly room
  const getRoom = (roomId) => state.rooms.find((r) => r.id === roomId || r.number === roomId);

  // Filter the incidents
  const filteredIncidents = state.incidents.filter((incident) => {
    const matchesType = typeFilter === 'Todos' || incident.type === typeFilter;
    const matchesStatus = statusFilter === 'Todos' || incident.status === statusFilter;
    const matchesPriority = priorityFilter === 'Todos' || incident.priority === priorityFilter;

    const room = getRoom(incident.roomId);
    const roomStr = (room?.number || incident.roomId || '').toLowerCase();
    const descStr = (incident.description || '').toLowerCase();
    const query = roomQuery.toLowerCase();
    const matchesRoom = !query || roomStr.includes(query) || descStr.includes(query);

    return matchesStatus && matchesType && matchesPriority && matchesRoom;
  });

  const INCIDENT_STATUS_STEPS = ['Pendiente', 'Asignada', 'En proceso', 'Resuelta', 'Cerrada'];

  const pendingCount = state.incidents.filter((item) => item.status !== 'Cerrada').length;
  const inProcessCount = state.incidents.filter((item) => item.status === 'En proceso' || item.status === 'Asignada').length;
  const urgentCount = state.incidents.filter((item) => item.priority === 'Urgente' || item.priority === 'urgent').length;
  const closedCount = state.incidents.filter((item) => item.status === 'Cerrada').length;

  return (
    <div className="view-container">

      <PageHeader
        actionType="INCIDENT_CREATE"
        metadata="Cola y control de fallas del hotel"
        title="Incidencias"
        description="Monitoreo centralizado de incidencias de limpieza, mantenimiento y servicio con bloqueo preventivo."
        action={
          <PermissionButton actionType="INCIDENT_CREATE" className="btn btn-primary incident-new-action" onClick={() => setEditor(null)}>
            <Plus size={16} /> Nueva incidencia
          </PermissionButton>
        }
      />

      {/* Modern KPI Strip */}
      <div className="incident-metric-grid">
        <div className="incident-metric-card incident-metric-pending">
          <div>
            <div className="incident-metric-label">Pendientes de Cierre</div>
            <div className="incident-metric-value incident-metric-pending-value">{pendingCount}</div>
          </div>
          <span className="incident-metric-icon">⏳</span>
        </div>

        <div className="incident-metric-card incident-metric-in-process">
          <div>
            <div className="incident-metric-label">En Proceso</div>
            <div className="incident-metric-value incident-metric-in-process-value">{inProcessCount}</div>
          </div>
          <span className="incident-metric-icon">🔄</span>
        </div>

        <div className="incident-metric-card incident-metric-urgent">
          <div>
            <div className="incident-metric-urgent-label">Urgentes / Críticas</div>
            <div className="incident-metric-value incident-metric-urgent-value">{urgentCount}</div>
          </div>
          <span className="incident-metric-icon">🚨</span>
        </div>

        <div className="incident-metric-card incident-metric-closed">
          <div>
            <div className="incident-metric-label">Cerradas / Resueltas</div>
            <div className="incident-metric-value incident-metric-closed-value">{closedCount}</div>
          </div>
          <span className="incident-metric-icon">✅</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="custom-filter-bar">
        <label className="incident-filter-search">
          <span>Búsqueda Rápida</span>
          <input
            type="text"
            placeholder="Buscar por hab. 101, alfombra, ruido..."
            value={roomQuery}
            onChange={(e) => setRoomQuery(e.target.value)}
          />
        </label>

        <label>
          <span>Filtrar por Tipo</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="Todos">Todos los tipos</option>
            <option value="Limpieza">🧹 Limpieza</option>
            <option value="Mantenimiento">🔧 Mantenimiento</option>
            <option value="Servicio">🛎️ Servicio</option>
          </select>
        </label>

        <label>
          <span>Filtrar por Estado</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="Todos">Todos los estados</option>
            {INCIDENT_STATUS_STEPS.map((step) => (
              <option key={step} value={step}>{step}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Filtrar por Prioridad</span>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="Todos">Todas las prioridades</option>
            {['Baja', 'Media', 'Alta', 'Urgente'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Incidents Grid */}
      {filteredIncidents.length > 0 ? (
        <div className="incident-grid">
          {filteredIncidents.map((incident) => {
            const room = getRoom(incident.roomId);
            const roomNumber = room ? `Habitación ${room.number}` : incident.roomId ? `Habitación ${incident.roomId}` : 'General / Sin Hab.';
            const pClass = `priority-${incident.priority}`;
            const typeIcon = getIncidentTypeIcon(incident.type);
            const shortId = incident.id.length > 12 ? `INC-${incident.id.slice(0, 8).toUpperCase()}` : incident.id;

            return (
              <article className={`incident-card ${pClass}`} key={incident.id}>
                <div>
                  <div className="row-between incident-card-header">
                    <div className="incident-card-identity">
                      <span className="incident-card-icon">{typeIcon}</span>
                      <div>
                        <span className="incident-card-reference">
                          {shortId} · {incident.type}
                        </span>
                        <h3 className="incident-card-room">
                          {roomNumber}
                        </h3>
                      </div>
                    </div>
                    <StatusBadge>{incident.status}</StatusBadge>
                  </div>

                  <p className="incident-card-description">
                    {incident.description}
                  </p>

                  <div className="incident-card-meta">
                    <PriorityTag priority={incident.priority} />
                    {incident.blocksRoom ? (
                      <span className="incident-card-blocked">
                        <Lock size={11} /> Bloquea Habitación
                      </span>
                    ) : (
                      <span className="incident-card-unblocked">
                        <Unlock size={11} /> Sin Bloqueo
                      </span>
                    )}
                  </div>

                  <DetailGrid compact items={[
                    { label: 'Responsable', value: incident.responsible || 'Por asignar' },
                    { label: 'Habitación', value: room ? `Hab. ${room.number}` : 'General', detail: room?.status },
                    { label: 'Evidencias', value: incident.evidence?.length ? '1 adjunto' : 'Sin evidencias' },
                    { label: 'Solución', value: incident.solution || 'En seguimiento' }
                  ]} />
                </div>

                <div className="incident-card-footer">
                  <StatusStepper currentStatus={incident.status} steps={INCIDENT_STATUS_STEPS} />

                  <div className="incident-card-actions">
                    {(canUpdateIncident || (incident.status === 'Cerrada' ? canReopenIncident : canProgressIncident)) ? (
                      <button
                        className="btn btn-outline btn-sm incident-manage-action"
                        onClick={() => setEditor(incident)}
                      >
                        Gestionar Incidencia
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Sin incidencias" description="No se encontraron incidencias con los filtros aplicados." />
      )}

      {/* Dialog */}
      <Dialog
        open={editor !== undefined}
        onClose={() => setEditor(undefined)}
        title={editor ? `Gestión de Incidencia · ${editor.id.length > 12 ? `INC-${editor.id.slice(0, 8).toUpperCase()}` : editor.id}` : 'Nueva Incidencia'}
        wide
      >
        <IncidentEditor incident={editor || null} onClose={() => setEditor(undefined)} notify={notify} />
      </Dialog>
    </div>
  );
}

function SupplierEditor({ supplier, onClose, notify }) {
  const { execute } = useHotel();
  const allowed = useActionPermission(supplier ? 'SUPPLIER_UPDATE' : 'SUPPLIER_CREATE');
  const [form, setForm] = useState(supplier ? { ...supplier, productsText: supplier.products.join(', ') } : { businessName: '', ruc: '', contact: '', phone: '', email: '', productsText: '', averageDeliveryDays: 1, primary: false });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event) => { event.preventDefault(); const payload = { ...form, products: form.productsText.split(',').map((item) => item.trim()).filter(Boolean), averageDeliveryDays: Number(form.averageDeliveryDays) }; delete payload.productsText; const action = supplier ? { type: 'SUPPLIER_UPDATE', supplierId: supplier.id, payload } : { type: 'SUPPLIER_CREATE', payload }; if (run(execute, action, notify, supplier ? 'Proveedor actualizado' : 'Proveedor creado', 'El proveedor quedó disponible para los lotes de inventario.')) onClose(); };
  if (!allowed) return null;
  return <form className="form-grid" onSubmit={submit}><label className="span-2">Razón social<input required value={form.businessName} onChange={(event) => set('businessName', event.target.value)} /></label><label>RUC<input required value={form.ruc} onChange={(event) => set('ruc', event.target.value)} /></label><label>Contacto<input value={form.contact} onChange={(event) => set('contact', event.target.value)} /></label><label>Teléfono<input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></label><label>Correo<input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></label><label className="span-2">Categorías separadas por coma<input value={form.productsText} onChange={(event) => set('productsText', event.target.value)} /></label><label>Días de entrega<input type="number" min="0" value={form.averageDeliveryDays} onChange={(event) => set('averageDeliveryDays', event.target.value)} /></label><label className="toggle-row"><input type="checkbox" checked={form.primary} onChange={(event) => set('primary', event.target.checked)} /><span>Proveedor principal</span></label><div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Guardar proveedor</button></div></form>;
}

export function OperationalSuppliersView({ notify }) {
  const { state, execute } = useHotel();
  const [editor, setEditor] = useState(undefined);
  const archive = (supplier) => run(execute, { type: 'SUPPLIER_ARCHIVE', supplierId: supplier.id, reason: 'Archivado desde proveedores' }, notify, 'Proveedor archivado', 'El proveedor permanece en el historial.');
  return <div className="view-container"><PageHeader actionType="SUPPLIER_CREATE" metadata="CRUD sin eliminación física" title="Proveedores" description="Altas, actualización y archivado con control de lotes activos." action={<PermissionButton actionType="SUPPLIER_CREATE" className="btn btn-primary" onClick={() => setEditor(null)}>Nuevo proveedor</PermissionButton>} /><MetricStrip items={[{ label: 'Proveedores', value: state.suppliers.length }, { label: 'Activos', value: state.suppliers.filter((item) => item.status !== 'Archivado').length }, { label: 'Principales', value: state.suppliers.filter((item) => item.primary && item.status !== 'Archivado').length }, { label: 'Lotes vinculados', value: state.inventory.filter((item) => item.supplierId).length }]} /><div className="operation-cards">{state.suppliers.map((supplier) => <article className="card operation-card" key={supplier.id}><div className="row-between"><div><span className="eyebrow">{supplier.id} · RUC {supplier.ruc}</span><h3>{supplier.businessName}</h3></div><StatusBadge>{supplier.status || 'Activo'}</StatusBadge></div><DetailGrid compact items={[{ label: 'Contacto', value: supplier.contact }, { label: 'Teléfono', value: supplier.phone }, { label: 'Correo', value: supplier.email }, { label: 'Entrega', value: `${supplier.averageDeliveryDays} día(s)` }, { label: 'Categorías', value: supplier.products.join(', ') || 'Sin categorías' }, { label: 'Lotes activos', value: state.inventory.filter((item) => item.supplierId === supplier.id && item.status !== 'Archivado').length }]} /><div className="inline-actions">{supplier.status !== 'Archivado' ? <><PermissionButton actionType="SUPPLIER_UPDATE" className="btn btn-outline" onClick={() => setEditor(supplier)}>Editar</PermissionButton><PermissionButton actionType="SUPPLIER_ARCHIVE" className="btn btn-outline" onClick={() => archive(supplier)}>Archivar</PermissionButton></> : <span>Histórico</span>}</div></article>)}</div><Dialog open={editor !== undefined} onClose={() => setEditor(undefined)} title={editor ? `Editar ${editor.id}` : 'Nuevo proveedor'} wide><SupplierEditor supplier={editor || null} onClose={() => setEditor(undefined)} notify={notify} /></Dialog></div>;
}
