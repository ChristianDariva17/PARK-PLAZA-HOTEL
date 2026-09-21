import { useState } from 'react';
import { Lock, Plus, Unlock } from 'lucide-react';
import { useHotel } from '../state/hotelContext';
import { PermissionButton } from '../components/auth/PermissionButton';
import { useActionPermission } from '../components/auth/useActionPermission';
import { FilterBar } from '../components/ui/FilterBar';
import { Dialog } from '../components/ui/Overlay';
import { EmptyState, PageHeader, StatusBadge } from '../components/views/SharedViewParts';
import { PriorityTag, StatusStepper } from '../operations/OperationalViewParts.jsx';

const run = (execute, action, notify, successTitle, successMessage) => {
  const result = execute(action);
  notify(result.ok ? successTitle : 'Operación rechazada', result.ok ? successMessage : (result.error || result.message || 'No se pudo completar la operación.'), result.ok ? 'success' : 'error');
  return result.ok;
};

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
      <FilterBar label="Filtros de incidencias" className="custom-filter-bar">
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
      </FilterBar>

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
              <article className={`incident-card is-compact ${pClass}`} key={incident.id}>
                <div className="ticket-compact-main">
                  <div className="row-between ticket-compact-header">
                    <div className="ticket-identity">
                      <span className="ticket-icon">{typeIcon}</span>
                      <div className="ticket-title-wrapper">
                        <div className="ticket-room-row">
                          <span className="ticket-ref">{shortId}</span>
                          <span className="ticket-type-label">· {incident.type}</span>
                          <strong className="ticket-room">· {roomNumber}</strong>
                        </div>
                        <h4 className="ticket-title">
                          {incident.description}
                        </h4>
                      </div>
                    </div>

                    <div className="ticket-header-badges">
                      <PriorityTag priority={incident.priority} />
                      {incident.blocksRoom ? (
                        <span className="incident-card-blocked">
                          <Lock size={11} /> Bloquea Hab.
                        </span>
                      ) : (
                        <span className="incident-card-unblocked">
                          <Unlock size={11} /> Sin Bloqueo
                        </span>
                      )}
                      <StatusBadge>{incident.status}</StatusBadge>
                    </div>
                  </div>

                  <div className="ticket-meta-strip">
                    <div className="ticket-meta-item">
                      <span className="ticket-meta-label">Responsable:</span>
                      <strong className="ticket-meta-val">{incident.responsible || 'Por asignar'}</strong>
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
                       <strong className="ticket-meta-val">{incident.evidenceCount > 0 || incident.evidence?.length ? '1 adjunto' : 'Sin evidencias'}</strong>
                    </div>
                    <span className="ticket-meta-dot">•</span>
                    <div className="ticket-meta-item">
                      <span className="ticket-meta-label">Solución:</span>
                      <strong className="ticket-meta-val">{incident.solution || 'En seguimiento'}</strong>
                    </div>
                  </div>
                </div>

                <div className="ticket-compact-footer">
                  <div className="ticket-stepper-wrapper">
                    <StatusStepper currentStatus={incident.status} steps={INCIDENT_STATUS_STEPS} compact />
                  </div>

                  <div className="ticket-action-wrapper">
                    {(canUpdateIncident || (incident.status === 'Cerrada' ? canReopenIncident : canProgressIncident)) ? (
                      <button
                        className="btn btn-outline btn-sm ticket-manage-btn incident-manage-action"
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
