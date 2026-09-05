import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Building2,
  CalendarDays,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  UserCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useStaffResource } from '../../hooks/useStaffResource.js';
import { staffClient } from '../../staff/staffClient.js';
import { StaffEditorModal } from './StaffEditorModal.jsx';
import { StaffScheduleModal } from './StaffScheduleModal.jsx';
import { Dialog } from '../../components/ui/Overlay.jsx';
import { DataTable, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../../components/views/SharedViewParts.jsx';

export function StaffDirectoryView() {
  const { data, status, reload } = useStaffResource();
  const { staff = [] } = data || {};
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedulingId, setSchedulingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('ALL');

  // Confirmation dialogs for Archive / Reactivate
  const [actionDialog, setActionDialog] = useState(null); // { type: 'archive' | 'reactivate', staff: object, reason: string, loading: boolean, error: string }

  const handleCreate = () => {
    setEditingId(null);
    setEditorOpen(true);
  };

  const handleEdit = (id) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const handleAssignSchedule = (id) => {
    setSchedulingId(id);
    setScheduleOpen(true);
  };

  const openArchiveDialog = (member) => {
    setActionDialog({
      type: 'archive',
      staff: member,
      reason: '',
      loading: false,
      error: null,
    });
  };

  const openReactivateDialog = (member) => {
    setActionDialog({
      type: 'reactivate',
      staff: member,
      reason: '',
      loading: false,
      error: null,
    });
  };

  const handleExecuteAction = async (e) => {
    e.preventDefault();
    if (!actionDialog) return;
    setActionDialog((prev) => ({ ...prev, loading: true, error: null }));
    try {
      if (actionDialog.type === 'archive') {
        await staffClient.archiveStaff(actionDialog.staff.id, actionDialog.reason || 'Archivado desde directorio');
      } else {
        await staffClient.reactivateStaff(actionDialog.staff.id, actionDialog.reason || 'Reactivado desde directorio');
      }
      setActionDialog(null);
      reload();
    } catch (err) {
      setActionDialog((prev) => ({ ...prev, loading: false, error: err.message || 'Ocurrió un error al procesar la acción.' }));
    }
  };

  const handleSaved = () => {
    setEditorOpen(false);
    reload();
  };

  const handleScheduleSaved = () => {
    setScheduleOpen(false);
    reload();
  };

  const isActive = (memberStatus) => memberStatus === 'Activo' || memberStatus === 'active';

  const departments = useMemo(() => {
    const set = new Set();
    staff.forEach((m) => {
      if (m.department) set.add(m.department);
    });
    return Array.from(set);
  }, [staff]);

  const filteredStaff = useMemo(() => {
    return staff.filter((m) => {
      const matchesDept = filterDepartment === 'ALL' || m.department === filterDepartment;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesDept;
      const fullName = `${m.firstName || ''} ${m.lastName || ''}`.toLowerCase();
      const doc = (m.documentNormalized || '').toLowerCase();
      const pos = (m.position || '').toLowerCase();
      const dept = (m.department || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      return matchesDept && (fullName.includes(query) || doc.includes(query) || pos.includes(query) || dept.includes(query) || email.includes(query));
    });
  }, [staff, searchQuery, filterDepartment]);

  if (status === 'forbidden') {
    return (
      <div className="view-container">
        <div className="alert-banner alert-banner-danger">No tenés permiso para ver el personal.</div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="view-container" aria-busy="true">
        <div className="card route-loading" role="status" style={{ padding: '60px', textAlign: 'center' }}>
          Cargando directorio de personal…
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="view-container">
        <section className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="empty-state">
            <AlertCircle size={48} style={{ color: 'var(--color-danger, #ef4444)', marginBottom: '16px' }} />
            <h3>No pudimos cargar el directorio de personal</h3>
            <p>El servicio no está disponible por el momento. Podés reintentar la consulta.</p>
            <button onClick={reload} className="btn btn-primary" style={{ marginTop: '16px' }}>
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        </section>
      </div>
    );
  }

  const activeCount = staff.filter((m) => isActive(m.status)).length;
  const archivedCount = staff.length - activeCount;

  return (
    <div className="view-container">
      <PageHeader
        metadata="Operaciones · Recursos Humanos"
        title="Directorio de Personal"
        description="Administrá los perfiles del equipo, sus cargos, asignación de turnos y estado laboral."
        actionType="STAFF_CREATE"
        action={
          <button onClick={handleCreate} className="btn btn-primary">
            <Plus size={16} aria-hidden="true" /> Registrar personal
          </button>
        }
      />

      <MetricStrip
        label="Resumen de Colaboradores"
        items={[
          { label: 'Total Registrado', value: staff.length, detail: 'Colaboradores en base de datos' },
          { label: 'Personal Activo', value: activeCount, detail: 'Habilitados para asistencia y turnos' },
          { label: 'Archivados / Inactivos', value: archivedCount, detail: 'Ex-colaboradores o bajas' },
          { label: 'Departamentos', value: departments.length || '—', detail: 'Áreas operativas activas' },
        ]}
      />

      {/* Luxury Filter and Search Toolbar */}
      <div className="staff-filter-toolbar">
        <div className="staff-filter-group">
          <div className="search-input-luxury">
            <Search size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar colaborador por nombre, DNI, cargo o correo…"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {departments.length > 0 && (
            <div className="select-luxury-wrap">
              <Building2 size={16} className="select-icon" />
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
              >
                <option value="ALL">Todos los departamentos ({departments.length})</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          )}

          {(searchQuery || filterDepartment !== 'ALL') && (
            <button
              type="button"
              className="filter-reset-btn"
              onClick={() => {
                setSearchQuery('');
                setFilterDepartment('ALL');
              }}
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={13} /> Limpiar filtros
            </button>
          )}
        </div>

        <div className="results-count-chip">
          <Users size={14} />
          <span>{filteredStaff.length} {filteredStaff.length === 1 ? 'colaborador' : 'colaboradores'}</span>
        </div>
      </div>

      {/* Staff Table */}
      {filteredStaff.length === 0 ? (
        <section className="card">
          <EmptyState
            title={staff.length === 0 ? 'Todavía no hay personal registrado' : 'Sin resultados para la búsqueda'}
            description={staff.length === 0 ? 'Creá el primer perfil para organizar tareas, asistencia biométrica y horarios.' : 'Probá modificando los términos de búsqueda o el filtro de departamento.'}
          />
        </section>
      ) : (
        <DataTable
          caption="Nómina de colaboradores del hotel"
          columns={['Colaborador', 'Documento', 'Cargo y Departamento', 'Contacto', 'Estado', 'Acciones']}
        >
          {filteredStaff.map((member) => {
            const initials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase() || 'HP';
            const active = isActive(member.status);

            return (
              <tr key={member.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="staff-directory-avatar">
                      {initials}
                    </div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '13.5px', color: 'var(--color-navy-deep)' }}>
                        {member.firstName} {member.lastName}
                      </strong>
                      <small style={{ color: 'var(--color-muted)', fontSize: '11px' }}>
                        ID: {member.id.slice(0, 8)}…
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {member.documentNormalized || '—'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--color-text)' }}>
                      {member.position || 'Sin cargo definido'}
                    </strong>
                    <small style={{ color: 'var(--color-muted)', fontSize: '11.5px' }}>
                      {member.department || 'Sin departamento'}
                    </small>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                    {member.phone && <span>📞 {member.phone}</span>}
                    {member.email && <span style={{ color: 'var(--color-muted)' }}>✉️ {member.email}</span>}
                    {!member.phone && !member.email && <span style={{ color: 'var(--color-muted)' }}>—</span>}
                  </div>
                </td>
                <td>
                  <StatusBadge>{active ? 'Activo' : 'Archivado'}</StatusBadge>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleEdit(member.id)}
                      className="btn btn-sm btn-outline"
                      title="Editar datos del colaborador"
                    >
                      <Pencil size={13} aria-hidden="true" /> Editar
                    </button>
                    {active ? (
                      <>
                        <button
                          onClick={() => handleAssignSchedule(member.id)}
                          className="btn btn-sm btn-outline"
                          title="Asignar o modificar horario"
                        >
                          <CalendarDays size={13} aria-hidden="true" /> Horario
                        </button>
                        <button
                          onClick={() => openArchiveDialog(member)}
                          className="btn btn-sm btn-outline"
                          title="Archivar colaborador"
                        >
                          <Archive size={13} aria-hidden="true" /> Archivar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openReactivateDialog(member)}
                        className="btn btn-sm btn-primary"
                        title="Reactivar colaborador"
                      >
                        <RotateCcw size={13} aria-hidden="true" /> Reactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}

      {/* Editor Modal */}
      {editorOpen && (
        <StaffEditorModal
          staffId={editingId}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Schedule Modal */}
      {scheduleOpen && (
        <StaffScheduleModal
          staffId={schedulingId}
          onClose={() => setScheduleOpen(false)}
          onSaved={handleScheduleSaved}
        />
      )}

      {/* Archive / Reactivate Confirmation Dialog */}
      {actionDialog && (
        <Dialog
          open={true}
          onClose={() => setActionDialog(null)}
          title={actionDialog.type === 'archive' ? 'Archivar Colaborador' : 'Reactivar Colaborador'}
          description={
            actionDialog.type === 'archive'
              ? `¿Estás seguro de archivar el perfil de ${actionDialog.staff.firstName} ${actionDialog.staff.lastName}? Ya no figurará como disponible para turnos.`
              : `¿Deseás reactivar a ${actionDialog.staff.firstName} ${actionDialog.staff.lastName} para habilitarlo en la operación hotelera?`
          }
        >
          <form onSubmit={handleExecuteAction} className="form-grid">
            {actionDialog.error && (
              <div className="alert-banner alert-banner-danger span-2" role="alert">
                <AlertCircle size={16} />
                <span>{actionDialog.error}</span>
              </div>
            )}

            <label className="span-2">
              <span>Motivo del cambio <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
              <textarea
                required
                value={actionDialog.reason}
                onChange={(e) => setActionDialog((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder={actionDialog.type === 'archive' ? 'Ej. Fin de contrato laboral, renuncia voluntaria…' : 'Ej. Reincorporación a la temporada…'}
                disabled={actionDialog.loading}
                style={{ minHeight: '80px' }}
              />
            </label>

            <div className="form-actions span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setActionDialog(null)}
                disabled={actionDialog.loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`btn ${actionDialog.type === 'archive' ? 'btn-danger' : 'btn-primary'}`}
                disabled={actionDialog.loading || !actionDialog.reason.trim()}
              >
                {actionDialog.loading ? (
                  'Procesando…'
                ) : actionDialog.type === 'archive' ? (
                  <>
                    <Archive size={16} /> Confirmar baja / archivar
                  </>
                ) : (
                  <>
                    <Check size={16} /> Confirmar reactivación
                  </>
                )}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
