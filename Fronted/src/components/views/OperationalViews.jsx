import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Search, Wrench, AlertTriangle, Plus, Lock, Unlock, Hammer, History, TrendingUp, TrendingDown, Clock, Sparkles, DollarSign, Package, Check, RefreshCw, X, ArrowUpRight, ArrowDownRight, SlidersHorizontal, Eye, EyeOff, Edit, RotateCcw, Building2, Layers, Tag, Receipt, ShieldAlert, Filter } from 'lucide-react';
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
import { CASH_PAYMENT_METHODS } from '../../cash/cashModel';
import { CashDenominationsCalculator } from '../../cash/CashDenominationsCalculator.jsx';
import { CashZReportModal } from '../../cash/CashZReportModal.jsx';
import { CashMovementEnhancedForm } from '../../cash/CashMovementEnhancedForm.jsx';
import { PermissionButton } from '../auth/PermissionButton';
import { useActionPermission } from '../auth/useActionPermission';
import { Dialog, Drawer, Tabs, TabPanel } from '../ui/Overlay';
import { DataTable, DetailGrid, EmptyState, MetricStrip, PageHeader, SectionHeader, StatusBadge } from './SharedViewParts';
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
    <div className="status-stepper-container" style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '14px 0 8px 0', gap: '4px' }}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentIndex;
        const isActive = idx === currentIndex;

        let color = 'var(--color-muted)';
        if (isCompleted) {
          color = 'var(--color-success)';
        } else if (isActive) {
          color = 'var(--color-primary)';
        }

        return (
          <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: color,
              zIndex: 2,
              boxShadow: isActive ? '0 0 0 3px rgba(15, 60, 44, 0.2)' : 'none',
              transition: 'all 0.2s ease'
            }} />
            {idx < steps.length - 1 && (
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '3px',
                width: '100%',
                height: '2px',
                backgroundColor: isCompleted ? 'var(--color-success)' : 'var(--color-border)',
                zIndex: 1
              }} />
            )}
            <span style={{
              fontSize: '9px',
              fontWeight: isActive ? '700' : '500',
              color: isActive ? 'var(--color-primary)' : 'var(--color-muted)',
              marginTop: '4px',
              textAlign: 'center',
              whiteSpace: 'nowrap'
            }}>{step}</span>
          </div>
        );
      })}
    </div>
  );
}

function PriorityTag({ priority }) {
  const norm = String(priority || '').toLowerCase().trim();
  let bg = '#f1f5f9';
  let color = '#475569';
  let border = '#cbd5e1';
  let icon = '⚡';

  if (norm === 'urgente' || norm === 'urgent') {
    bg = 'rgba(239, 68, 68, 0.12)';
    color = '#dc2626';
    border = 'rgba(239, 68, 68, 0.3)';
    icon = '🚨';
  } else if (norm === 'alta' || norm === 'high') {
    bg = 'rgba(245, 158, 11, 0.12)';
    color = '#d97706';
    border = 'rgba(245, 158, 11, 0.3)';
    icon = '⚠️';
  } else if (norm === 'media' || norm === 'medium') {
    bg = 'rgba(14, 165, 233, 0.12)';
    color = '#0284c7';
    border = 'rgba(14, 165, 233, 0.3)';
    icon = '⏱️';
  } else if (norm === 'baja' || norm === 'low') {
    bg = 'rgba(100, 116, 139, 0.12)';
    color = '#64748b';
    border = 'rgba(100, 116, 139, 0.25)';
    icon = '📋';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 9px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      background: bg,
      color: color,
      border: `1px solid ${border}`,
      letterSpacing: '0.02em',
    }}>
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
    <form className="form-grid" onSubmit={submit} style={{ gap: '14px' }}>
      {/* Presets Bar */}
      <div className="span-2" style={{ background: 'var(--color-surface-soft)', padding: '12px 14px', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Plantillas Rápidas de Avería Frecuente:
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {COMMON_MAINTENANCE_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
              style={{
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '11.5px',
                fontWeight: '600',
                background: '#fff',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Habitación Afectada</span>
        <select value={form.roomId} onChange={(event) => set('roomId', event.target.value)}>
          {state.rooms.map((room) => (
            <option key={room.id} value={room.id}>
              Habitación {room.number} (Piso {room.floor}) — {room.status}
            </option>
          ))}
        </select>
      </label>

      <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Tipo de Avería</span>
        <input required value={form.type} onChange={(event) => set('type', event.target.value)} placeholder="Ej. Climatización, Plomería, Electricidad..." />
      </label>

      <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Nivel de Prioridad & SLA</span>
        <select value={form.priority} onChange={(event) => set('priority', event.target.value)}>
          <option value="Baja">🟢 Baja (Atención dentro de 24h)</option>
          <option value="Media">🔵 Media (Atención dentro de 6h)</option>
          <option value="Alta">🟡 Alta (Atención dentro de 2h)</option>
          <option value="Urgente">🔴 Urgente (Atención Inmediata)</option>
        </select>
      </label>

      <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Técnico Responsable</span>
        <input value={form.assignedTo} onChange={(event) => set('assignedTo', event.target.value)} placeholder="Ej: Téc. Carlos Mendoza / Por asignar" />
      </label>

      <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Descripción Detallada del Problema</span>
        <textarea required rows={3} value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="Describa la falla observada, ruidos, fugas o partes averiadas..." />
      </label>

      <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Enlace de Evidencia / Documentación (Opcional)</span>
        <input value={form.evidence} onChange={(event) => set('evidence', event.target.value)} placeholder="https://... URL de reporte, foto o manual" />
      </label>

      <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Fotografía de la Avería (Adjuntar archivo)</span>
        <input type="file" accept="image/*" onChange={(event) => set('photo', event.target.files?.[0] || null)} />
        {form.photo ? <small style={{ color: 'var(--color-primary)', fontWeight: '600', marginTop: '4px' }}>Archivo seleccionado: {form.photo.name}</small> : null}
      </label>

      <div className="span-2" style={{ background: form.severe ? '#fef2f2' : 'var(--color-surface-soft)', border: form.severe ? '1.5px solid #f87171' : '1px solid var(--color-border)', borderRadius: '14px', padding: '14px', transition: 'all 0.2s ease' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
          <input type="checkbox" checked={form.severe} onChange={(event) => set('severe', event.target.checked)} style={{ width: '18px', height: '18px' }} />
          <div>
            <strong style={{ fontSize: '13px', color: form.severe ? '#991b1b' : 'var(--color-text)' }}>
              🔒 Bloquear Habitación Inmediatamente (Fuera de Servicio)
            </strong>
            <div style={{ fontSize: '11.5px', color: form.severe ? '#b91c1c' : 'var(--color-muted)', marginTop: '2px' }}>
              La habitación no podrá ser asignada a nuevas reservas hasta que el ticket sea completamente resuelto y cerrado.
            </div>
          </div>
        </label>
      </div>

      <div className="form-actions span-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose} style={{ padding: '10px 20px', borderRadius: '12px' }}>
          Cancelar
        </button>
        <button className="btn btn-primary" disabled={busy} style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: '700' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Banner */}
      <div style={{ background: 'linear-gradient(135deg, var(--color-navy), var(--color-navy-deep))', color: '#fff', padding: '16px 20px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '28px' }}>{getMaintenanceTypeIcon(ticket.description)}</span>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Ticket #{ticket.id.slice(0, 8)} · Habitación {ticket.room?.number || ticket.roomId}
            </div>
            <strong style={{ fontSize: '16px', color: '#fff' }}>{ticket.description.replace(/^\[.*?\]\s*/, '')}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <PriorityTag priority={ticket.priority} />
          <span style={{ background: 'rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: '700', color: '#fff' }}>
            Estado: {ticket.status}
          </span>
        </div>
      </div>

      {/* Progress Stepper */}
      <div style={{ background: 'var(--color-surface-soft)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
        <StatusStepper currentStatus={ticket.status} steps={['Pendiente', 'Asignado', 'En reparación', 'Solucionado', 'Cerrado']} />
      </div>

      {/* Form Fields */}
      <div className="form-grid" style={{ gap: '12px' }}>
        <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
          <span>Técnico Responsable Asignado</span>
          <input value={form.assignedTo} onChange={(event) => set('assignedTo', event.target.value)} placeholder="Nombre del técnico responsable" />
        </label>

        <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
          <span>Prioridad del Ticket</span>
          <select value={form.priority} onChange={(event) => set('priority', event.target.value)}>
            {['Baja', 'Media', 'Alta', 'Urgente'].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
          <span>Notas de Evidencia / Diagnóstico</span>
          <input value={form.evidence} onChange={(event) => set('evidence', event.target.value)} placeholder="URL de fotos de reparación, informes o notas técnicas" />
        </label>

        <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
          <span>Solución Técnica / Informe de Cierre</span>
          <textarea rows={3} value={form.solution} onChange={(event) => set('solution', event.target.value)} placeholder="Detalle los repuestos cambiados, calibración realizada o motivo de resolución..." />
        </label>

        {(ticket.status === 'Solucionado' || ticket.status === 'En reparación' || ticket.status === 'En reparacion') && ticket.blocksRoom ? (
          <div className="span-2" style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '12px', padding: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
              <input type="checkbox" checked={form.releaseRoom} onChange={(event) => set('releaseRoom', event.target.checked)} style={{ width: '16px', height: '16px' }} />
              <strong style={{ fontSize: '12.5px', color: '#065f46' }}>
                🔓 Liberar habitación y reincorporar al inventario disponible al cerrar ticket
              </strong>
            </label>
          </div>
        ) : null}

        <div className="form-actions span-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {canUpdate ? (
            <PermissionButton actionType="MAINTENANCE_UPDATE" className="btn btn-outline" disabled={busy} onClick={save} style={{ padding: '10px 20px', borderRadius: '12px' }}>
              {busy ? 'Guardando…' : 'Guardar Cambios'}
            </PermissionButton>
          ) : <div />}

          {canProgress && nextAction ? (
            <PermissionButton actionType={progressActionType} className="btn btn-primary" disabled={busy} onClick={() => progress(nextAction[0])} style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: '700' }}>
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
      <style>{`
        .maintenance-metric-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }
        .maintenance-metric-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }
        .maintenance-metric-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-card);
        }
        .custom-filter-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          background: var(--color-surface);
          padding: 16px 20px;
          border-radius: 16px;
          border: 1px solid var(--color-border);
          margin-bottom: 20px;
          align-items: center;
          box-shadow: var(--shadow-sm);
        }
        .custom-filter-bar label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-weight: 700;
          font-size: 11.5px;
          color: var(--color-navy-soft);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .custom-filter-bar select, .custom-filter-bar input {
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          font-size: 13px;
          outline: none;
          min-width: 170px;
          transition: all 0.2s ease;
        }
        .custom-filter-bar select:focus, .custom-filter-bar input:focus {
          border-color: var(--color-gold);
          box-shadow: 0 0 0 3px rgba(197, 157, 95, 0.15);
        }
        .maintenance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 18px;
          margin-top: 8px;
        }
        .maintenance-card {
          position: relative;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }
        .maintenance-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(15,23,42,0.08);
        }
        .maintenance-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
        }
        .priority-Baja::before, .priority-low::before { background-color: #94a3b8; }
        .priority-Media::before, .priority-medium::before { background-color: #0284c7; }
        .priority-Alta::before, .priority-high::before { background-color: #d97706; }
        .priority-Urgente::before, .priority-urgent::before { background-color: #dc2626; }
      `}</style>

      <PageHeader
        actionType="MAINTENANCE_CREATE"
        metadata="Mantenimiento preventivo y correctivo"
        title="Mantenimiento"
        description="Gestión integral de tickets, asignaciones técnicas, avances operativos y liberación de habitaciones."
        action={
          <PermissionButton actionType="MAINTENANCE_CREATE" className="btn btn-primary" onClick={() => setOpen(true)} style={{ borderRadius: '12px', padding: '10px 20px', fontWeight: '700' }}>
            <Plus size={16} style={{ marginRight: '6px' }} /> Nuevo ticket
          </PermissionButton>
        }
      />

      {/* Modern KPI Strip */}
      <div className="maintenance-metric-grid">
        <div className="maintenance-metric-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendientes de Cierre</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--color-navy-deep)', marginTop: '2px' }}>{pendingCount}</div>
          </div>
          <span style={{ fontSize: '26px' }}>⏳</span>
        </div>

        <div className="maintenance-metric-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>En Reparación</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#0284c7', marginTop: '2px' }}>{inRepairCount}</div>
          </div>
          <span style={{ fontSize: '26px' }}>🛠️</span>
        </div>

        <div className="maintenance-metric-card" style={{ borderLeft: '4px solid #dc2626', background: urgentCount > 0 ? '#fef2f2' : undefined }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: urgentCount > 0 ? '#991b1b' : 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgentes / Críticos</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626', marginTop: '2px' }}>{urgentCount}</div>
          </div>
          <span style={{ fontSize: '26px' }}>🚨</span>
        </div>

        <div className="maintenance-metric-card" style={{ borderLeft: '4px solid #059669' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cerrados / Resueltos</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#059669', marginTop: '2px' }}>{closedCount}</div>
          </div>
          <span style={{ fontSize: '26px' }}>✅</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="custom-filter-bar">
        <label style={{ flex: '1 1 200px' }}>
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
                  <div className="row-between" style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{typeIcon}</span>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Habitación {room?.number || 'General'}
                        </span>
                        <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--color-navy-deep)', margin: '2px 0 0' }}>
                          {ticket.description.replace(/^\[.*?\]\s*/, '')}
                        </h3>
                      </div>
                    </div>
                    <StatusBadge>{ticket.status}</StatusBadge>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    <PriorityTag priority={ticket.priority} />
                    {ticket.blocksRoom ? (
                      <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={11} /> Bloquea Habitación
                      </span>
                    ) : (
                      <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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

                <div style={{ marginTop: '14px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                  <StatusStepper currentStatus={ticket.status} steps={MAINTENANCE_STATUS_STEPS} />

                  <div style={{ marginTop: '14px' }}>
                    {(canUpdateMaintenance || (ticket.status === 'Cerrado' ? canReopenMaintenance : canProgressMaintenance)) ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ width: '100%', borderRadius: '10px', fontWeight: '700', padding: '8px 12px' }}
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
  const { state, execute } = useHotel();
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
  const { state, execute, restaurantCommands } = useHotel();
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
export const getInventoryCategory = (name = '', unit = '') => {
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

export const getCleanSku = (item) => {
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
      <div className="span-2" style={{
        background: 'linear-gradient(135deg, var(--color-navy, #0f2942) 0%, #1e3a5f 100%)',
        borderRadius: 10,
        padding: '14px 18px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        border: '1px solid rgba(212, 175, 55, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(212, 175, 55, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22
          }}>
            {categoryInfo.icon}
          </div>
          <div>
            <span style={{ fontSize: 10.5, textTransform: 'uppercase', fontWeight: 800, color: 'var(--color-gold, #c59d5f)', letterSpacing: '0.05em' }}>
              {categoryInfo.label}
            </span>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
              {form.name.trim() || 'Nombre del Insumo / Mercadería'}
            </h4>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', display: 'block' }}>Costo Unitario</span>
          <strong style={{ fontSize: 18, color: 'var(--color-gold, #c59d5f)' }}>
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
          style={{ fontSize: 13.5, fontWeight: 600 }}
        />
      </label>

      <label>
        Unidad de Medida Oficial *
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            required
            value={form.unit}
            maxLength={40}
            placeholder="Litro, kg, oz, und..."
            onChange={(e) => set('unit', e.target.value)}
            disabled={pending}
            style={{ flex: 1 }}
          />
          <select
            value=""
            onChange={(e) => { if (e.target.value) set('unit', e.target.value); }}
            disabled={pending}
            style={{ width: '110px', fontSize: 11.5 }}
          >
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
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.cost}
            onChange={(e) => set('cost', e.target.value)}
            disabled={pending}
            style={{ paddingLeft: '32px', fontWeight: 700 }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--color-navy)' }}>
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
          style={{ fontSize: 13 }}
        >
          <option value="">Sin proveedor asignado</option>
          {suppliersList.map((sup) => (
            <option key={sup.id} value={sup.id}>
              {sup.tradeName || sup.legalName} ({sup.taxId || 'RUC'})
            </option>
          ))}
        </select>
      </label>

      {formError ? <div className="alert-banner alert-banner-danger span-2" role="alert">{formError}</div> : null}

      <div className="form-actions span-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancelar</button>
        <button className="btn btn-primary" disabled={pending} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
          <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
            Stock Actual
          </span>
          <strong style={{ fontSize: 20, color: 'var(--color-text)' }}>
            {currentStock} <small style={{ fontSize: 12 }}>{item.unit}</small>
          </strong>
          <span style={{ fontSize: 10.5, color: 'var(--color-muted)', display: 'block' }}>
            Disp: {currentAvailable} {item.unit}
          </span>
        </div>

        <div style={{ fontSize: 22, fontWeight: 900, color: adjustmentNum >= 0 ? '#15803d' : '#b91c1c' }}>
          {adjustmentNum >= 0 ? '+' : '−'}
        </div>

        <div>
          <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
            Ajuste
          </span>
          <strong style={{ fontSize: 20, color: adjustmentNum >= 0 ? '#15803d' : '#b91c1c' }}>
            {adjustmentNum !== 0 ? `${adjustmentNum > 0 ? '+' : ''}${adjustmentNum}` : '0'} <small style={{ fontSize: 12 }}>{item.unit}</small>
          </strong>
          <span style={{ fontSize: 10.5, color: 'var(--color-muted)', display: 'block' }}>
            {type}
          </span>
        </div>

        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-navy)' }}>
          =
        </div>

        <div>
          <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 700, textTransform: 'uppercase' }}>
            Stock Resultante
          </span>
          <strong style={{ fontSize: 20, color: 'var(--color-navy)' }}>
            {resultantStock} <small style={{ fontSize: 12 }}>{item.unit}</small>
          </strong>
          <span style={{ fontSize: 10.5, color: resultantAvailable < Number(item.minimum) ? '#b45309' : '#15803d', display: 'block', fontWeight: 700 }}>
            {resultantAvailable < Number(item.minimum) ? '⚠️ Quedará bajo mínimo' : '🟢 Stock suficiente'}
          </span>
        </div>
      </div>

      {/* Quick Buttons for One-Click Adjustment */}
      <div className="span-2" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-muted)', marginRight: 4 }}>
          Ajuste rápido:
        </span>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(1)}>+1</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(5)}>+5</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(10)}>+10</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(25)}>+25</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(-1)} style={{ color: '#b91c1c' }}>-1</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(-5)} style={{ color: '#b91c1c' }}>-5</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(-10)} style={{ color: '#b91c1c' }}>-10</button>
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
          style={{ fontSize: 14, fontWeight: 700 }}
        />
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

      <div className="form-actions span-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancelar</button>
        <button className="btn btn-primary" disabled={pending} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
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
        <div style={{
          background: 'var(--color-surface-soft)',
          padding: '16px',
          borderRadius: 10,
          border: '1px solid var(--color-border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12
        }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block' }}>Rubro</span>
            <strong style={{ fontSize: 13, color: 'var(--color-navy)' }}>
              {categoryInfo.icon} {categoryInfo.label}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block' }}>Stock Físico Actual</span>
            <strong style={{ fontSize: 16, color: 'var(--color-text)' }}>
              {item.stock} {item.unit}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block' }}>Stock Disponible</span>
            <strong style={{ fontSize: 16, color: inventoryAvailable(item) <= Number(item.minimum) ? '#b45309' : '#15803d' }}>
              {inventoryAvailable(item)} {item.unit}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block' }}>Stock Mínimo</span>
            <strong style={{ fontSize: 13, color: 'var(--color-muted)' }}>
              {item.minimum} {item.unit}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block' }}>Valorización en Almacén</span>
            <strong style={{ fontSize: 16, color: 'var(--color-navy)' }}>
              {formatMoney(totalValuation)}
            </strong>
          </div>
        </div>

        {/* Ledger History Table */}
        <h4 style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 800, color: 'var(--color-navy)' }}>
          Libro de Movimientos Históricos ({filteredLedger.length})
        </h4>

        {filteredLedger.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', background: 'var(--color-surface-soft)', borderRadius: 8 }}>
            <Package size={28} color="var(--color-muted)" style={{ margin: '0 auto 6px', display: 'block' }} />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
              Este insumo no tiene movimientos registrados en el libro aún.
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            <table className="custom-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Cantidad</th>
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
                      <td style={{ whiteSpace: 'nowrap' }}>{displayDateTime(entry.createdAt)}</td>
                      <td>
                        <span style={{
                          padding: '2px 7px',
                          borderRadius: 4,
                          fontSize: 10.5,
                          fontWeight: 700,
                          background: entry.type === 'Entrada' ? 'rgba(34, 197, 94, 0.15)' : entry.type === 'Merma' ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-surface-soft)',
                          color: entry.type === 'Entrada' ? '#15803d' : entry.type === 'Merma' ? '#b91c1c' : 'var(--color-text)'
                        }}>
                          {entry.type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: isPositive ? '#15803d' : '#b91c1c' }}>
                        {isPositive ? '+' : ''}{qty} {item.unit}
                      </td>
                      <td>{entry.referenceId || 'Manual'}</td>
                      <td>{entry.note || '—'}</td>
                      <td style={{ color: 'var(--color-muted)' }}>{entry.responsible || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
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
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

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
              className="btn btn-primary"
              onClick={() => setEditor(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700 }}
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
        <div className="alert-banner alert-banner-danger" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
            <button className="btn btn-sm btn-outline" style={{ marginLeft: '12px' }} onClick={() => inventoryResource.reload()}>Reintentar</button>
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
            <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: '280px' }}>
                <label className="search-label" style={{ flex: 1 }}>
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por insumo, SKU, lote o proveedor..."
                    aria-label="Buscar insumos"
                  />
                </label>
                <label style={{ margin: 0 }}>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="todos">Todos los estados</option>
                    <option value="optimo">🟢 Stock Óptimo</option>
                    <option value="bajo_minimo">🟡 Bajo Mínimo (Reponer)</option>
                    <option value="agotados">🔴 Agotados (0 stock)</option>
                    <option value="archivados">📦 Archivados</option>
                  </select>
                </label>
                <label style={{ margin: 0 }}>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="name">Nombre: A - Z</option>
                    <option value="stock_asc">Stock: Menor a Mayor</option>
                    <option value="stock_desc">Stock: Mayor a Menor</option>
                    <option value="value_desc">Mayor Valorización (S/)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="filter-result">{records.length} insumos listados</span>
              </div>
            </div>

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
                  <tr key={item.id} style={{ opacity: archived ? 0.6 : 1 }}>
                    {/* 1. Name, Rubro & SKU */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          background: 'var(--color-navy, #0f172a)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          border: '1px solid rgba(212, 175, 55, 0.4)',
                          flexShrink: 0
                        }}>
                          {category.icon}
                        </div>
                        <div>
                          <strong style={{ fontSize: 13.5, color: 'var(--color-text)' }}>{item.name}</strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--color-surface-soft)', padding: '1px 6px', borderRadius: 4, color: 'var(--color-navy)' }}>
                              {sku}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>
                              {item.lot ? `Lote: ${item.lot}` : 'Sin lote'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Physical Stock & Health Bar */}
                    <td style={{ minWidth: '120px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <strong style={{ fontSize: 14, color: 'var(--color-text)' }}>{item.stock}</strong>
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{item.unit}</span>
                      </div>
                      <div className="inv-health-bar" title={`Stock Físico: ${item.stock} / Mínimo: ${item.minimum}`}>
                        <div
                          className={`inv-health-fill ${critical ? 'critical' : belowMin ? 'warning' : 'optimal'}`}
                          style={{ width: `${healthRatio}%` }}
                        />
                      </div>
                      <small style={{ fontSize: 10, color: 'var(--color-muted)' }}>Min: {item.minimum} {item.unit}</small>
                    </td>

                    {/* 3. Reserved */}
                    <td>
                      <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                        {item.reserved} {item.unit}
                      </span>
                    </td>

                    {/* 4. Available with Smart Pill */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <strong style={{ fontSize: 14, color: critical ? '#b91c1c' : belowMin ? '#b45309' : '#15803d' }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>
                          Unit: {formatMoney(costNum)}
                        </span>
                        <strong style={{ fontSize: 13.5, color: 'var(--color-navy)' }}>
                          {formatMoney(lineValuation)}
                        </strong>
                      </div>
                    </td>

                    {/* 6. Supplier */}
                    <td>
                      {resolvedSupplierName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--color-text)', fontSize: 12 }}>
                          <Building2 size={13} color="var(--color-gold)" />
                          <span style={{ fontWeight: 600 }}>{resolvedSupplierName}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--color-muted)', fontSize: 11, fontStyle: 'italic' }}>
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
                      <div className="quick-actions-row" style={{ justifyContent: 'flex-start', gap: 6 }}>
                        {!archived ? (
                          <>
                            {canAdjust ? (
                              <button
                                type="button"
                                className="quick-action-btn btn-action-view"
                                data-tooltip="Ajustar stock (Entrada / Merma)"
                                onClick={() => setAdjustId(item.id)}
                                style={{ padding: '6px 8px', gap: 4 }}
                              >
                                <Plus size={13} />
                                <span style={{ fontSize: 11, fontWeight: 700 }}>Ajustar</span>
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className="quick-action-btn"
                              data-tooltip="Ver Kardex / Historial de movimientos"
                              onClick={() => setKardexItem(item)}
                              style={{ padding: '6px 8px', gap: 4, background: 'var(--color-surface-soft)' }}
                            >
                              <History size={13} />
                              <span style={{ fontSize: 11, fontWeight: 700 }}>Kardex</span>
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
                            className="btn btn-sm btn-outline"
                            onClick={() => handleReactivate(item)}
                            style={{ fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}
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
            <button className="btn btn-sm btn-outline" style={{ marginLeft: '12px' }} onClick={() => ledgerResource.reload()}>Reintentar</button>
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
                  <td style={{ whiteSpace: 'nowrap' }}>{displayDateTime(entry.createdAt)}</td>
                  <td>
                    {item ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>{cat?.icon || '📦'}</span>
                        <div>
                          <strong style={{ fontSize: 13 }}>{item.name}</strong>
                          <br />
                          <small style={{ color: 'var(--color-muted)' }}>{getCleanSku(item)} · Lote: {item.lot || 'Sin lote'}</small>
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--color-muted)' }}>Insumo no disponible</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      background: entry.type === 'Entrada' ? 'rgba(34, 197, 94, 0.15)' : entry.type === 'Merma' ? 'rgba(239, 68, 68, 0.15)' : 'var(--color-surface-soft)',
                      color: entry.type === 'Entrada' ? '#15803d' : entry.type === 'Merma' ? '#b91c1c' : 'var(--color-navy)'
                    }}>
                      {entry.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 800, color: isPositive ? '#15803d' : '#b91c1c' }}>
                    {isPositive ? '+' : ''}{qty}{item ? ` ${item.unit}` : ''}
                  </td>
                  <td>{entry.referenceId || 'Manual'}</td>
                  <td>{entry.note || '—'}</td>
                  <td style={{ color: 'var(--color-muted)' }}>{entry.responsible || '—'}</td>
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
    <form className="form-grid" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Pestañas de modo y control de Arqueo Ciego */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
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
          className={`btn btn-sm ${blindMode ? 'btn-primary' : 'btn-outline'}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: blindMode ? '#334155' : 'transparent',
            borderColor: blindMode ? '#334155' : '#cbd5e1',
            color: blindMode ? '#ffffff' : '#475569',
          }}
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '10px',
          border: '1px dashed #94a3b8',
          textAlign: 'center',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontWeight: '700', fontSize: '0.85rem' }}>
            <Lock size={16} />
            <span>Modo Arqueo Ciego Activo (Control Antifraude)</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
            El saldo esperado y el cuadre se mantienen ocultos para garantizar un conteo objetivo en gaveta.
          </div>
          <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '0.9rem' }}>
              Efectivo Contado: <strong style={{ color: '#0f172a' }}>{formatMoney(Number(countedAmount) || 0)}</strong>
            </span>
            <button
              type="button"
              className="btn btn-xs btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setRevealed(true)}
            >
              <Eye size={13} />
              <span>Revelar Cuadre</span>
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: '#f8fafc',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Esperado en Sistema</span>
            <strong style={{ fontSize: '1.05rem', color: '#1e293b' }}>{formatMoney(expected)}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total Contado Físico</span>
            <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{formatMoney(Number(countedAmount) || 0)}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Diferencia / Cuadre</span>
            <strong style={{
              fontSize: '1.05rem',
              color: Math.abs(difference) < 0.01 ? '#16a34a' : difference > 0 ? '#d97706' : '#dc2626'
            }}>
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: '#b91c1c',
        }}>
          <AlertTriangle size={16} />
          <span>
            Descuadre de {formatMoney(difference)} detectado. Por política hotelera, debe ingresar una justificación detallada antes de cerrar.
          </span>
        </div>
      )}

      <label className="span-2">
        <span style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
          Observaciones o justificación {isDiscrepancy ? '⚠️ (OBLIGATORIO por descuadre >= S/ 5.00)' : Math.abs(difference) >= 0.01 ? '(Recomendado)' : '(Opcional)'}
        </span>
        <textarea
          value={note}
          required={isDiscrepancy}
          placeholder="Ej: Conteo físico verificado en gaveta. Descuadre atribuible a..."
          onChange={(event) => setNote(event.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: isDiscrepancy ? '1px solid #f87171' : '1px solid #cbd5e1' }}
        />
      </label>

      <div className="form-actions span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
    <div className="view-container" style={{ maxWidth: '1440px', margin: '0 auto', padding: '0 8px 32px' }}>
      <style>{`
        @media (max-width: 1024px) {
          .cash-dashboard-grid {
            grid-template-columns: 1fr !important;
          }
          .cash-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .cash-kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Encabezado Ejecutivo Limpio (Sin duplicidades) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--color-border, #e2e8f0)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.08em',
              color: '#b45309',
              textTransform: 'uppercase',
              backgroundColor: '#fef3c7',
              padding: '3px 8px',
              borderRadius: '6px'
            }}>
              Park Plaza · Front Desk & POS
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-muted, #64748b)' }}>
              Módulo de Tesorería & Caja
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.7rem', fontWeight: '800', color: 'var(--color-navy, #0f172a)', letterSpacing: '-0.02em', fontFamily: 'var(--font-serif, serif)' }}>
            Control de Caja & Turnos
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-muted, #64748b)' }}>
            Apertura por turno, movimientos categorizados, arqueo ciego, control de remesas e historial auditable.
          </p>
        </div>

        {/* Chip de Estado en la esquina superior derecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {openSession ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 16px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '999px',
              boxShadow: '0 2px 8px -2px rgba(22, 163, 74, 0.12)',
            }}>
              <span style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.25)',
              }} />
              <div>
                <strong style={{ fontSize: '12.5px', color: '#15803d', display: 'block', lineHeight: 1.2 }}>
                  Turno Activo: {openSession.shift}
                </strong>
                <span style={{ fontSize: '11px', color: '#4b5563' }}>
                  Responsable: {openSession.responsible}
                </span>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '999px',
            }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
              <strong style={{ fontSize: '12.5px', color: '#64748b' }}>Caja Cerrada</strong>
            </div>
          )}
        </div>
      </div>

      {/* Workspace Principal en 2 Columnas */}
      <div className="cash-dashboard-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(330px, 370px) 1fr',
        gap: '24px',
        alignItems: 'start',
      }}>
        {/* ============================================================ */}
        {/* COLUMNA 1: Panel de Control del Turno y Botonera (Izquierda) */}
        {/* ============================================================ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {openSession ? (
            <div style={{
              background: 'linear-gradient(145deg, #0B132B 0%, #1E293B 100%)',
              color: '#ffffff',
              borderRadius: '18px',
              padding: '24px',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              boxShadow: '0 16px 36px -8px rgba(11, 19, 43, 0.35)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Resplandor decorativo dorado de fondo */}
              <div style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(212, 175, 55, 0.18) 0%, rgba(212, 175, 55, 0) 70%)',
                pointerEvents: 'none',
              }} />

              {/* Cabecera del Turno con Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #d4af37, #f59e0b)',
                    color: '#0f172a',
                    fontWeight: '800',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(212, 175, 55, 0.35)',
                  }}>
                    {openSession.responsible?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700' }}>
                      Cajero en Turno
                    </div>
                    <strong style={{ fontSize: '16px', color: '#f8fafc', display: 'block' }}>
                      {openSession.responsible}
                    </strong>
                  </div>
                </div>

                <span style={{
                  padding: '4px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: '700',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                  {openSession.shift}
                </span>
              </div>

              {/* Tiempo Transcurrido del Turno */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                  <Clock size={14} color="#f59e0b" />
                  <span>Apertura: {displayDateTime(openSession.openedAt)}</span>
                </div>
                <strong style={{ color: isLongShift ? '#f87171' : '#f59e0b', fontSize: '11.5px' }}>
                  {getShiftElapsed(openSession.openedAt)}
                </strong>
              </div>

              {isLongShift && (
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  color: '#fca5a5',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <AlertTriangle size={14} />
                  <span>Turno prolongado (+12h). Se sugiere realizar el arqueo y cierre.</span>
                </div>
              )}

              {/* Barra de Límite de Seguridad en Gaveta (Gauge) */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '12px' }}>
                  <span style={{ color: '#cbd5e1' }}>Límite de Mostrador</span>
                  <span style={{ fontWeight: '700', color: isCashExceeded ? '#f87171' : '#f59e0b' }}>
                    {formatMoney(expected)} / {formatMoney(CASH_SAFETY_LIMIT)}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${cashLimitPercentage}%`,
                    height: '100%',
                    background: isCashExceeded
                      ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                      : cashLimitPercentage > 70
                      ? 'linear-gradient(90deg, #10b981, #f59e0b)'
                      : 'linear-gradient(90deg, #10b981, #059669)',
                    borderRadius: '999px',
                    transition: 'width 0.4s ease-in-out',
                  }} />
                </div>
                {isCashExceeded ? (
                  <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={12} />
                    <span>Excedente en gaveta. Realice un pase a bóveda.</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Nivel de efectivo seguro en mostrador ({cashLimitPercentage}%)
                  </div>
                )}
              </div>

              {/* Botonera Operativa Integrada */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
                  Acciones Rápidas
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <PermissionButton
                    actionType="CASH_MOVEMENT"
                    className="btn btn-sm btn-primary"
                    style={{
                      backgroundColor: '#10b981',
                      borderColor: '#10b981',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '9px 12px',
                    }}
                    onClick={() => { setMovementPreset(null); setDialog('movement'); }}
                  >
                    <Plus size={15} />
                    <span>Movimiento</span>
                  </PermissionButton>

                  <PermissionButton
                    actionType="CASH_COUNT"
                    className="btn btn-sm btn-outline"
                    style={{
                      borderColor: 'rgba(255, 255, 255, 0.25)',
                      color: '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '9px 12px',
                    }}
                    onClick={() => setDialog('count')}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Arqueo</span>
                  </PermissionButton>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    style={{
                      borderColor: 'rgba(212, 175, 55, 0.4)',
                      color: '#fef08a',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '9px 12px',
                    }}
                    onClick={() => setReportSession(session)}
                    title="Ver / Imprimir Comprobante Corte Z"
                  >
                    <Receipt size={14} />
                    <span>Ticket Z</span>
                  </button>

                  <PermissionButton
                    actionType="CASH_CLOSE"
                    className="btn btn-sm btn-outline"
                    style={{
                      borderColor: 'rgba(239, 68, 68, 0.4)',
                      color: '#fca5a5',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '9px 12px',
                    }}
                    onClick={() => setDialog('close')}
                  >
                    <Lock size={14} />
                    <span>Cerrar caja</span>
                  </PermissionButton>
                </div>

                {isCashExceeded && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    style={{
                      backgroundColor: '#d97706',
                      borderColor: '#d97706',
                      marginTop: '4px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '9px 12px',
                    }}
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
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '28px 20px',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.06)',
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#64748b',
              }}>
                <Lock size={26} />
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                Caja Cerrada
              </h3>
              <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                No hay ningún turno activo. Inicie un nuevo turno para admitir ingresos y egresos de mostrador.
              </p>
              <PermissionButton actionType="CASH_OPEN" className="btn btn-primary" style={{ width: '100%' }} onClick={() => setDialog('open')}>
                Abrir nuevo turno de caja
              </PermissionButton>
            </div>
          )}

          {/* Tarjeta Informativa de Atajos & Control */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '18px 20px',
            border: '1px solid var(--color-border, #e2e8f0)',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--color-navy, #0f172a)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} color="#d97706" />
              <span>Políticas Operativas de Turno</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px', color: 'var(--color-muted, #64748b)' }}>
              <div>• <strong>Arqueo ciego obligatorio:</strong> Realice conteo sin condicionamiento de saldo.</div>
              <div>• <strong>Tope de seguridad:</strong> Máx {formatMoney(CASH_SAFETY_LIMIT)} en gaveta física.</div>
              <div>• <strong>Corte Z:</strong> Entregar ticket impreso y firmado al relevo o supervisor.</div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* COLUMNA 2: Centro Financiero y Movimientos en Vivo (Derecha) */}
        {/* ============================================================ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Banner de Seguridad por Exceso de Efectivo (Cash Drop) */}
          {isCashExceeded && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '14px',
              gap: '14px',
              boxShadow: '0 4px 12px -2px rgba(217, 119, 6, 0.12)',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#b45309',
                  flexShrink: 0,
                }}>
                  <ShieldAlert size={22} />
                </div>
                <div>
                  <strong style={{ color: '#92400e', fontSize: '13.5px', display: 'block' }}>
                    Límite de seguridad en mostrador alcanzado (Saldo en gaveta: {formatMoney(expected)})
                  </strong>
                  <span style={{ color: '#78350f', fontSize: '12px' }}>
                    El saldo en efectivo excede el límite recomendado de {formatMoney(CASH_SAFETY_LIMIT)}. Realice un pase de remesa a bóveda (Cash Drop) para minimizar riesgos.
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ backgroundColor: '#d97706', borderColor: '#d97706', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={handleTriggerCashDrop}
              >
                <ShieldAlert size={15} />
                <span>Pase a Bóveda Ahora</span>
              </button>
            </div>
          )}

          {/* Barra de KPIs Financieros 5 Estrellas (High Contrast & Luxury) */}
          <div className="cash-kpi-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '14px',
          }}>
            {/* KPI 1: Fondo Inicial */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '16px 18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Fondo Inicial
                </span>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                  <Building2 size={15} />
                </div>
              </div>
              <strong style={{ fontSize: '1.25rem', color: '#0f172a', display: 'block', fontWeight: '800' }}>
                {formatMoney(session?.openingAmount)}
              </strong>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Fondo base en apertura</span>
            </div>

            {/* KPI 2: Ingresos del Turno */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '16px 18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Ingresos Turno
                </span>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                  <TrendingUp size={15} />
                </div>
              </div>
              <strong style={{ fontSize: '1.25rem', color: '#15803d', display: 'block', fontWeight: '800' }}>
                +{formatMoney(income)}
              </strong>
              <span style={{ fontSize: '11px', color: '#16a34a' }}>
                {incomeMovements.length} {incomeMovements.length === 1 ? 'cobro' : 'cobros'} en turno
              </span>
            </div>

            {/* KPI 3: Egresos del Turno */}
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              padding: '16px 18px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Egresos Turno
                </span>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>
                  <TrendingDown size={15} />
                </div>
              </div>
              <strong style={{ fontSize: '1.25rem', color: '#b91c1c', display: 'block', fontWeight: '800' }}>
                -{formatMoney(expenses)}
              </strong>
              <span style={{ fontSize: '11px', color: '#b91c1c' }}>
                {expenseMovements.length} {expenseMovements.length === 1 ? 'salida' : 'salidas'} en turno
              </span>
            </div>

            {/* KPI 4: Esperado en Gaveta (KPI Estrella) */}
            <div style={{
              background: 'linear-gradient(135deg, #0f172a, #1e293b)',
              color: '#ffffff',
              borderRadius: '14px',
              padding: '16px 18px',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              boxShadow: '0 8px 20px -4px rgba(15, 23, 42, 0.25)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#fef08a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Esperado en Gaveta
                </span>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: 'rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fef08a' }}>
                  <DollarSign size={15} />
                </div>
              </div>
              <strong style={{ fontSize: '1.35rem', color: '#ffffff', display: 'block', fontWeight: '900', letterSpacing: '-0.01em' }}>
                {formatMoney(expected)}
              </strong>
              <div style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                <span>Cuadre teórico</span>
                <span style={{ color: session?.difference == null ? '#fef08a' : Math.abs(session.difference) < 0.01 ? '#86efac' : '#fca5a5' }}>
                  {session?.difference == null ? 'Por arquear' : formatMoney(session.difference)}
                </span>
              </div>
            </div>
          </div>

          {/* Tarjeta de Movimientos del Turno con Filtros y Buscador */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--color-border, #e2e8f0)',
            boxShadow: '0 6px 20px -3px rgba(15, 23, 42, 0.05)',
          }}>
            {/* Header de la tarjeta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--color-navy, #0f172a)' }}>
                  Movimientos de la Sesión
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-muted, #64748b)' }}>
                  {displayedMovements.length} transacciones registradas en efectivo
                </span>
              </div>

              {/* Buscador Rápido */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Buscar movimiento..."
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                  }}
                />
              </div>
            </div>

            {/* Barra de Filtros Píldora */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} style={{ color: '#64748b' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }}>
                  Filtrar movimientos:
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: `Todos (${movements.length})` },
                  { key: 'INGRESO', label: `Ingresos (+) (${incomeMovements.length})` },
                  { key: 'EGRESO', label: `Egresos (-) (${expenseMovements.length})` },
                  { key: 'CASH_DROP', label: 'Pases a Bóveda 🛡️' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`btn btn-xs ${movementFilter === tab.key ? 'btn-primary' : 'btn-outline'}`}
                    style={{ fontSize: '11.5px', padding: '4px 10px', borderRadius: '999px' }}
                    onClick={() => setMovementFilter(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabla Estilizada */}
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 8px' }}>Hora / ID</th>
                    <th style={{ padding: '10px 8px' }}>Tipo</th>
                    <th style={{ padding: '10px 8px' }}>Concepto & Categoría</th>
                    <th style={{ padding: '10px 8px' }}>Comprobante</th>
                    <th style={{ padding: '10px 8px' }}>Responsable</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Importe (PEN)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedMovements.length ? displayedMovements.map((item) => {
                    const isIncome = item.type === 'Ingreso';
                    const isExpense = item.type === 'Egreso';
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc', transition: 'background-color 0.15s' }}>
                        <td style={{ padding: '10px 8px', color: '#475569', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '600', display: 'block' }}>{new Date(item.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>#{item.id.slice(0, 6)}</span>
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: isIncome ? '#f0fdf4' : isExpense ? '#fef2f2' : '#eff6ff',
                            color: isIncome ? '#15803d' : isExpense ? '#b91c1c' : '#1d4ed8',
                            border: `1px solid ${isIncome ? '#bbf7d0' : isExpense ? '#fecaca' : '#bfdbfe'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}>
                            {isIncome ? <ArrowUpRight size={12} /> : isExpense ? <ArrowDownRight size={12} /> : null}
                            {item.type}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px', color: '#1e293b', fontWeight: '500' }}>
                          {item.concept}
                        </td>
                        <td style={{ padding: '10px 8px', color: '#64748b', fontSize: '11.5px', fontFamily: 'var(--font-mono, monospace)' }}>
                          {item.referenceId || '—'}
                        </td>
                        <td style={{ padding: '10px 8px', color: '#475569', fontSize: '11.5px' }}>
                          {item.responsible}
                        </td>
                        <td style={{
                          padding: '10px 8px',
                          textAlign: 'right',
                          fontWeight: '800',
                          fontSize: '13px',
                          color: isIncome ? '#15803d' : isExpense ? '#b91c1c' : '#0f172a',
                        }}>
                          {isIncome ? '+' : isExpense ? '-' : ''}{formatMoney(item.amount)}
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                        No se encontraron movimientos registrados con los filtros seleccionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial de Turnos de Caja (Auditoría) */}
          <section style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid var(--color-border, #e2e8f0)',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Auditoría
                </span>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  Historial de sesiones
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {state.cashSessions.length} turnos registrados
              </span>
            </div>

            <div className="record-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {state.cashSessions.map((item) => {
                const isExact = item.difference != null && Math.abs(item.difference) < 0.01;
                return (
                  <article key={item.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                          Turno {item.shift} · {item.responsible}
                        </strong>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                          #{item.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                        Apertura: {displayDateTime(item.openedAt)} · Cierre: {displayDateTime(item.closedAt)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '10px', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Diferencia</span>
                        <strong style={{
                          fontSize: '12px',
                          color: item.difference == null ? '#64748b' : isExact ? '#16a34a' : '#dc2626',
                        }}>
                          {item.difference == null ? 'Pendiente' : isExact ? 'Cuadre Exacto' : formatMoney(item.difference)}
                        </strong>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header Banner */}
        <div style={{ background: 'linear-gradient(135deg, var(--color-navy), var(--color-navy-deep))', color: '#fff', padding: '16px 20px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>{getIncidentTypeIcon(incident.type)}</span>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                INC-{incident.id.slice(0, 8).toUpperCase()} · {incident.type}
              </div>
              <strong style={{ fontSize: '16px', color: '#fff' }}>{roomLabel}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <PriorityTag priority={incident.priority} />
            <span style={{ background: 'rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: '700', color: '#fff' }}>
              Estado: {incident.status}
            </span>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ background: 'var(--color-surface-soft)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
          <StatusStepper currentStatus={incident.status} steps={['Pendiente', 'Asignada', 'En proceso', 'Resuelta', 'Cerrada']} />
        </div>

        {/* Description info */}
        <div style={{ background: 'var(--color-surface-soft)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Descripción Reportada:
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--color-text)', fontWeight: '500' }}>
            {incident.description}
          </div>
        </div>

        {/* Form Fields */}
        <div className="form-grid" style={{ gap: '12px' }}>
          <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
            <span>Personal Responsable Asignado</span>
            <input value={form.responsible} onChange={(event) => set('responsible', event.target.value)} placeholder="Personal encargado" />
          </label>

          <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
            <span>Prioridad</span>
            <select value={form.priority} onChange={(event) => set('priority', event.target.value)}>
              {['Baja', 'Media', 'Alta', 'Urgente'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
            <span>Nueva Evidencia / Enlace</span>
            <input value={form.evidence} onChange={(event) => set('evidence', event.target.value)} placeholder="URL de fotos o comprobante de solución" />
          </label>

          <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
            <span>Solución / Informe de Atención</span>
            <textarea rows={2} value={form.solution} onChange={(event) => set('solution', event.target.value)} placeholder="Detalle la solución aplicada para resolver la incidencia..." />
          </label>

          <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
            <span>Nota Interna / Motivo</span>
            <textarea rows={2} value={form.note} onChange={(event) => set('note', event.target.value)} placeholder="Observaciones adicionales para el historial..." />
          </label>

          {incident.blocksRoom && (incident.status === 'Resuelta' || incident.status === 'En proceso') ? (
            <div className="span-2" style={{ background: '#ecfdf5', border: '1.5px solid #a7f3d0', borderRadius: '12px', padding: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                <input type="checkbox" checked={form.releaseRoom} onChange={(event) => set('releaseRoom', event.target.checked)} style={{ width: '16px', height: '16px' }} />
                <strong style={{ fontSize: '12.5px', color: '#065f46' }}>
                  🔓 Liberar habitación y reincorporar al inventario disponible al cerrar la incidencia
                </strong>
              </label>
            </div>
          ) : null}

          <div className="form-actions span-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {canUpdate ? (
              <PermissionButton actionType="INCIDENT_UPDATE" className="btn btn-outline" disabled={busy} onClick={save} style={{ padding: '10px 20px', borderRadius: '12px' }}>
                {busy ? 'Guardando…' : 'Guardar Cambios'}
              </PermissionButton>
            ) : <div />}

            {canProgress ? (
              incident.status === 'Cerrada' ? (
                <PermissionButton actionType={progressActionType} className="btn btn-outline" disabled={busy} onClick={reopen} style={{ padding: '10px 22px', borderRadius: '12px', fontWeight: '700' }}>
                  {busy ? 'Procesando…' : '🔄 Reabrir Incidencia'}
                </PermissionButton>
              ) : (
                <PermissionButton actionType={progressActionType} className="btn btn-primary" disabled={busy} onClick={advance} style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: '700' }}>
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
    <form className="form-grid" onSubmit={submit} style={{ gap: '14px' }}>
      {/* Presets Bar */}
      <div className="span-2" style={{ background: 'var(--color-surface-soft)', padding: '12px 14px', borderRadius: '14px', border: '1px solid var(--color-border)' }}>
        <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          Plantillas Rápidas de Incidencia Frecuente:
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {COMMON_INCIDENT_PRESETS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p)}
              style={{
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '11.5px',
                fontWeight: '600',
                background: '#fff',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Tipo de Incidencia</span>
        <select value={form.type} onChange={(event) => set('type', event.target.value)}>
          <option value="Limpieza">🧹 Limpieza</option>
          <option value="Mantenimiento">🔧 Mantenimiento</option>
          <option value="Servicio">🛎️ Servicio / Atención</option>
        </select>
      </label>

      <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
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

      <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Nivel de Prioridad & SLA</span>
        <select value={form.priority} onChange={(event) => set('priority', event.target.value)}>
          <option value="Baja">🟢 Baja (Atención dentro de 24h)</option>
          <option value="Media">🔵 Media (Atención dentro de 6h)</option>
          <option value="Alta">🟡 Alta (Atención dentro de 2h)</option>
          <option value="Urgente">🔴 Urgente (Atención Inmediata)</option>
        </select>
      </label>

      <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Responsable Inicial</span>
        <input value={form.responsible} onChange={(event) => set('responsible', event.target.value)} placeholder="Ej: Personal de piso / Por asignar" />
      </label>

      <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Descripción del Suceso</span>
        <textarea required rows={3} value={form.description} onChange={(event) => set('description', event.target.value)} placeholder="Describa la incidencia reportada en detalle..." />
      </label>

      <label className="span-2" style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
        <span>Evidencia / URL de Referencia (Opcional)</span>
        <input value={form.evidence} onChange={(event) => set('evidence', event.target.value)} placeholder="https://... URL de foto o referencia" />
      </label>

      <div className="span-2" style={{ background: form.blocksRoom ? '#fef2f2' : 'var(--color-surface-soft)', border: form.blocksRoom ? '1.5px solid #f87171' : '1px solid var(--color-border)', borderRadius: '14px', padding: '14px', transition: 'all 0.2s ease' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
          <input type="checkbox" disabled={!form.roomId} checked={form.blocksRoom} onChange={(event) => set('blocksRoom', event.target.checked)} style={{ width: '18px', height: '18px' }} />
          <div>
            <strong style={{ fontSize: '13px', color: form.blocksRoom ? '#991b1b' : 'var(--color-text)' }}>
              🔒 Bloquear Operativamente la Habitación (Fuera de Servicio)
            </strong>
            <div style={{ fontSize: '11.5px', color: form.blocksRoom ? '#b91c1c' : 'var(--color-muted)', marginTop: '2px' }}>
              {form.roomId ? 'La habitación no podrá ser asignada a reservas mientras la incidencia permanezca activa.' : 'Seleccione una habitación para habilitar el bloqueo preventivo.'}
            </div>
          </div>
        </label>
      </div>

      <div className="form-actions span-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose} style={{ padding: '10px 20px', borderRadius: '12px' }}>
          Cancelar
        </button>
        <button className="btn btn-primary" disabled={busy} style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: '700' }}>
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
      <style>{`
        .incident-metric-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-bottom: 20px;
        }
        .incident-metric-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s ease;
        }
        .incident-metric-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-card);
        }
        .custom-filter-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          background: var(--color-surface);
          padding: 16px 20px;
          border-radius: 16px;
          border: 1px solid var(--color-border);
          margin-bottom: 20px;
          align-items: center;
          box-shadow: var(--shadow-sm);
        }
        .custom-filter-bar label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-weight: 700;
          font-size: 11.5px;
          color: var(--color-navy-soft);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .custom-filter-bar select, .custom-filter-bar input {
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          font-size: 13px;
          outline: none;
          min-width: 170px;
          transition: all 0.2s ease;
        }
        .custom-filter-bar select:focus, .custom-filter-bar input:focus {
          border-color: var(--color-gold);
          box-shadow: 0 0 0 3px rgba(197, 157, 95, 0.15);
        }
        .incident-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 18px;
          margin-top: 8px;
        }
        .incident-card {
          position: relative;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }
        .incident-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px rgba(15,23,42,0.08);
        }
        .incident-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 5px;
        }
        .priority-Baja::before, .priority-low::before { background-color: #94a3b8; }
        .priority-Media::before, .priority-medium::before { background-color: #0284c7; }
        .priority-Alta::before, .priority-high::before { background-color: #d97706; }
        .priority-Urgente::before, .priority-urgent::before { background-color: #dc2626; }
      `}</style>

      <PageHeader
        actionType="INCIDENT_CREATE"
        metadata="Cola y control de fallas del hotel"
        title="Incidencias"
        description="Monitoreo centralizado de incidencias de limpieza, mantenimiento y servicio con bloqueo preventivo."
        action={
          <PermissionButton actionType="INCIDENT_CREATE" className="btn btn-primary" onClick={() => setEditor(null)} style={{ borderRadius: '12px', padding: '10px 20px', fontWeight: '700' }}>
            <Plus size={16} style={{ marginRight: '6px' }} /> Nueva incidencia
          </PermissionButton>
        }
      />

      {/* Modern KPI Strip */}
      <div className="incident-metric-grid">
        <div className="incident-metric-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pendientes de Cierre</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--color-navy-deep)', marginTop: '2px' }}>{pendingCount}</div>
          </div>
          <span style={{ fontSize: '26px' }}>⏳</span>
        </div>

        <div className="incident-metric-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>En Proceso</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#0284c7', marginTop: '2px' }}>{inProcessCount}</div>
          </div>
          <span style={{ fontSize: '26px' }}>🔄</span>
        </div>

        <div className="incident-metric-card" style={{ borderLeft: '4px solid #dc2626', background: urgentCount > 0 ? '#fef2f2' : undefined }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: urgentCount > 0 ? '#991b1b' : 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgentes / Críticas</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626', marginTop: '2px' }}>{urgentCount}</div>
          </div>
          <span style={{ fontSize: '26px' }}>🚨</span>
        </div>

        <div className="incident-metric-card" style={{ borderLeft: '4px solid #059669' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cerradas / Resueltas</div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#059669', marginTop: '2px' }}>{closedCount}</div>
          </div>
          <span style={{ fontSize: '26px' }}>✅</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="custom-filter-bar">
        <label style={{ flex: '1 1 200px' }}>
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
                  <div className="row-between" style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '24px' }}>{typeIcon}</span>
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {shortId} · {incident.type}
                        </span>
                        <h3 style={{ fontSize: '14.5px', fontWeight: '800', color: 'var(--color-navy-deep)', margin: '2px 0 0' }}>
                          {roomNumber}
                        </h3>
                      </div>
                    </div>
                    <StatusBadge>{incident.status}</StatusBadge>
                  </div>

                  <p style={{ color: 'var(--color-text)', fontSize: '13px', margin: '8px 0 12px 0', lineHeight: 1.4 }}>
                    {incident.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    <PriorityTag priority={incident.priority} />
                    {incident.blocksRoom ? (
                      <span style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={11} /> Bloquea Habitación
                      </span>
                    ) : (
                      <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
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

                <div style={{ marginTop: '14px', borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                  <StatusStepper currentStatus={incident.status} steps={INCIDENT_STATUS_STEPS} />

                  <div style={{ marginTop: '14px' }}>
                    {(canUpdateIncident || (incident.status === 'Cerrada' ? canReopenIncident : canProgressIncident)) ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ width: '100%', borderRadius: '10px', fontWeight: '700', padding: '8px 12px' }}
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
