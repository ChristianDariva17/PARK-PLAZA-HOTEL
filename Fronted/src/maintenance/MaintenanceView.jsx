import { useEffect, useRef, useState } from 'react';
import { Lock, Plus, Unlock } from 'lucide-react';
import { useHotel } from '../state/hotelContext';
import { PermissionButton } from '../components/auth/PermissionButton';
import { useActionPermission } from '../components/auth/useActionPermission';
import { FilterBar } from '../components/ui/FilterBar';
import { Dialog } from '../components/ui/Overlay';
import { EmptyState, PageHeader, ResourceState, StatusBadge } from '../components/views/SharedViewParts';
import { mapMaintenancePriorityToApi, mapMaintenanceStatusToApi, readMaintenancePhoto } from '../maintenance/maintenanceModel';
import { PriorityTag, StatusStepper } from '../operations/OperationalViewParts.jsx';

const run = (execute, action, notify, successTitle, successMessage) => {
  const result = execute(action);
  notify(result.ok ? successTitle : 'Operación rechazada', result.ok ? successMessage : (result.error || result.message || 'No se pudo completar la operación.'), result.ok ? 'success' : 'error');
  return result.ok;
};

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
  const busyRef = useRef(false);
  const commandRequest = state.maintenanceCommandRequest || { status: 'idle', error: null, retryBlocked: false };

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
    if (busyRef.current) return;
    busyRef.current = true;
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
        busyRef.current = false;
        setBusy(false);
      }
    } else {
      if (run(execute, { type: 'MAINTENANCE_CREATE', payload: form }, notify, 'Ticket creado', 'Ticket, incidencia y estado de habitación quedaron vinculados.')) onClose();
      busyRef.current = false;
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
        <button className="btn btn-primary" disabled={busy || commandRequest.retryBlocked}>
          {busy ? 'Registrando ticket…' : 'Crear Ticket de Mantenimiento'}
        </button>
      </div>
    </form>
  );
}

function MaintenanceManager({ ticket, onClose, notify }) {
  const { state, execute, maintenanceCommands } = useHotel();
  const canUpdate = useActionPermission('MAINTENANCE_UPDATE');
  const progressActionType = ticket.status === 'Cerrado' ? 'MAINTENANCE_REOPEN' : 'MAINTENANCE_PROGRESS';
  const canProgress = useActionPermission(progressActionType);
  const [form, setForm] = useState({ assignedTo: ticket.assignedTo, priority: ticket.priority, evidence: '', solution: ticket.solution || '', releaseRoom: ticket.blocksRoom });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const commandRequest = state.maintenanceCommandRequest || { status: 'idle', error: null, retryBlocked: false };
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (busyRef.current || commandRequest.retryBlocked) return;
    busyRef.current = true;
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
        busyRef.current = false;
        setBusy(false);
      }
    } else {
      run(execute, { type: 'MAINTENANCE_UPDATE', ticketId: ticket.id, payload: form }, notify, 'Ticket actualizado', 'Responsable, prioridad y evidencia se sincronizaron con la incidencia.');
      busyRef.current = false;
      setBusy(false);
    }
  };

  const progress = async (action) => {
    if (busyRef.current || commandRequest.retryBlocked) return;
    if (action === 'assign' && (!form.assignedTo.trim() || form.assignedTo.trim() === 'Por asignar')) {
      notify('Responsable requerido', 'Indicá el técnico responsable antes de asignar el ticket.', 'error');
      return;
    }
    if (action === 'resolve' && !form.solution.trim()) {
      notify('Solución requerida', 'Describí la solución técnica antes de resolver el ticket.', 'error');
      return;
    }
    busyRef.current = true;
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
        busyRef.current = false;
        setBusy(false);
      }
    } else {
      if (run(execute, { type: 'MAINTENANCE_PROGRESS', ticketId: ticket.id, expectedStatus: ticket.status, action }, notify, 'Ticket actualizado', 'La acción quedó registrada correctamente.')) onClose();
      busyRef.current = false;
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
            <PermissionButton actionType="MAINTENANCE_UPDATE" className="btn btn-outline" disabled={busy || commandRequest.retryBlocked} onClick={save}>
              {busy ? 'Guardando…' : 'Guardar Cambios'}
            </PermissionButton>
          ) : <div />}

          {canProgress && nextAction ? (
              <PermissionButton actionType={progressActionType} className="btn btn-primary" disabled={busy || commandRequest.retryBlocked} onClick={() => progress(nextAction[0])}>
              {busy ? 'Procesando…' : nextAction[1]}
            </PermissionButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OperationalMaintenanceView({ notify }) {
  const { state, maintenanceCommands } = useHotel();
  const canUpdateMaintenance = useActionPermission('MAINTENANCE_UPDATE');
  const canProgressMaintenance = useActionPermission('MAINTENANCE_PROGRESS');
  const canReopenMaintenance = useActionPermission('MAINTENANCE_REOPEN');

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // Custom filter states
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [priorityFilter, setPriorityFilter] = useState('Todos');
  const [roomQuery, setRoomQuery] = useState('');

  useEffect(() => {
    maintenanceCommands?.reload?.().catch(() => {});
  }, [maintenanceCommands]);

  const selected = state.maintenanceTickets.find((item) => item.id === selectedId);
  const maintenanceStatus = state.maintenanceRequest?.status || 'idle';
  const maintenanceHasTickets = state.maintenanceTickets.length > 0;
  const commandRequest = state.maintenanceCommandRequest || { status: 'idle', error: null, retryBlocked: false };
  const reloadMaintenanceView = async () => {
    try {
      await (maintenanceCommands?.refreshForRetry?.() || maintenanceCommands?.reload?.());
      notify('Mantenimiento actualizado', 'Se cargó el estado autoritativo de los tickets.', 'success');
    } catch (error) {
      notify('No se pudo actualizar', error.message, 'error');
    }
  };

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
      <FilterBar label="Filtros de mantenimiento" className="custom-filter-bar">
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
      </FilterBar>

      {/* Ticket Cards Grid */}
      {commandRequest.status === 'error' ? (
        <div className="state-panel state-error" role="alert">
          <strong>No se pudo confirmar la última operación de mantenimiento.</strong>
          <p>{commandRequest.error || 'Actualizá los tickets antes de reintentar.'}</p>
          <button type="button" className="btn btn-primary" onClick={reloadMaintenanceView}>Actualizar tickets</button>
        </div>
      ) : null}

      {!maintenanceHasTickets && maintenanceStatus !== 'success' ? (
        <ResourceState
          status={maintenanceStatus}
          error={state.maintenanceRequest?.error}
          onRetry={maintenanceStatus === 'error' ? reloadMaintenanceView : undefined}
          emptyTitle="Sin tickets de mantenimiento"
          emptyDescription="Los tickets aparecerán cuando se registre una incidencia de mantenimiento."
        />
      ) : null}

      {maintenanceHasTickets ? (
        <>
          {maintenanceStatus === 'loading' ? (
            <div className="state-panel state-loading" role="status" aria-live="polite">Actualizando tickets de mantenimiento...</div>
          ) : null}
          {maintenanceStatus === 'error' ? (
            <div className="state-panel state-error" role="alert">
              <strong>Mostrando el último estado conocido.</strong>
              <p>{state.maintenanceRequest?.error || 'Actualizá los tickets para continuar.'}</p>
              <button type="button" className="btn btn-primary" onClick={reloadMaintenanceView}>Reintentar actualización</button>
            </div>
          ) : null}
          {filteredTickets.length > 0 ? (
        <div className="maintenance-grid">
          {filteredTickets.map((ticket) => {
            const room = ticket.room ?? state.rooms.find((item) => item.id === ticket.roomId);
            const pClass = `priority-${ticket.priority}`;
            const typeIcon = getMaintenanceTypeIcon(ticket.description);

            return (
              <article className={`maintenance-card is-compact ${pClass}`} key={ticket.id}>
                <div className="ticket-compact-main">
                  <div className="row-between ticket-compact-header">
                    <div className="ticket-identity">
                      <span className="ticket-icon">{typeIcon}</span>
                      <div className="ticket-title-wrapper">
                        <div className="ticket-room-row">
                          <strong className="ticket-room">Habitación {room?.number || 'General'}</strong>
                          <span className="ticket-type-label">· Mantenimiento</span>
                        </div>
                        <h4 className="ticket-title">
                          {ticket.description.replace(/^\[.*?\]\s*/, '')}
                        </h4>
                      </div>
                    </div>

                    <div className="ticket-header-badges">
                      <PriorityTag priority={ticket.priority} />
                      {ticket.blocksRoom ? (
                        <span className="maintenance-lock-tag is-blocking">
                          <Lock size={11} /> Bloquea Hab.
                        </span>
                      ) : (
                        <span className="maintenance-lock-tag">
                          <Unlock size={11} /> Sin Bloqueo
                        </span>
                      )}
                      <StatusBadge>{ticket.status}</StatusBadge>
                    </div>
                  </div>

                  <div className="ticket-meta-strip">
                    <div className="ticket-meta-item">
                      <span className="ticket-meta-label">Responsable:</span>
                      <strong className="ticket-meta-val">{ticket.assignedTo || 'Por asignar'}</strong>
                    </div>
                    <span className="ticket-meta-dot">•</span>
                    <div className="ticket-meta-item">
                      <span className="ticket-meta-label">Habitación:</span>
                      <strong className="ticket-meta-val">{room ? `Hab. ${room.number}` : 'General'}</strong>
                      {room?.status && <small className="ticket-meta-sub">({room.status})</small>}
                    </div>
                    <span className="ticket-meta-dot">•</span>
                    <div className="ticket-meta-item">
                      <span className="ticket-meta-label">Evidencias:</span>
                       <strong className="ticket-meta-val">{ticket.evidenceCount > 0 || ticket.evidence?.length ? '1 adjunto' : 'Sin evidencias'}</strong>
                    </div>
                    <span className="ticket-meta-dot">•</span>
                    <div className="ticket-meta-item">
                      <span className="ticket-meta-label">Solución:</span>
                      <strong className="ticket-meta-val">{ticket.solution || 'En diagnóstico'}</strong>
                    </div>
                  </div>
                </div>

                <div className="ticket-compact-footer">
                  <div className="ticket-stepper-wrapper">
                    <StatusStepper currentStatus={ticket.status} steps={MAINTENANCE_STATUS_STEPS} compact />
                  </div>

                  <div className="ticket-action-wrapper">
                    {(canUpdateMaintenance || (ticket.status === 'Cerrado' ? canReopenMaintenance : canProgressMaintenance)) ? (
                      <button
                        className="btn btn-outline btn-sm ticket-manage-btn"
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
            <EmptyState title="Sin coincidencias" description="No se encontraron tickets con los filtros aplicados." />
          )}
        </>
      ) : maintenanceStatus === 'success' ? (
        <EmptyState title="Sin tickets de mantenimiento" description="Los tickets aparecerán cuando se registre una incidencia de mantenimiento." />
      ) : null}

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

