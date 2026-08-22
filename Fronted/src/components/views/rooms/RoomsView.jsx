import { useEffect, useState } from 'react';
import { LayoutGrid, List, Search } from 'lucide-react';
import { usePermissions } from '../../../auth/authContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { ROOM_STATUSES } from '../../../domain/hotelModel';
import { useCollectionTable } from '../../../hooks/useCollectionTable';
import { useHotel } from '../../../state/hotelContext';
import { Pagination, RowActions, SortableHeader } from '../../ui/CollectionTable';
import { Dialog, Drawer } from '../../ui/Overlay';
import { DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';

const displayRate = (rate) => `S/ ${Number(rate).toFixed(2)}`;

function getCategoryIcon(categoryName = '') {
  const name = categoryName.toLowerCase();
  if (name.includes('suite')) return '👑';
  if (name.includes('matrimonial')) return '👩‍❤️‍👨';
  if (name.includes('doble')) return '🛏️🛏️';
  if (name.includes('triple')) return '🛌🛌';
  return '🛏️';
}

function RoomForm({ room, categories, onClose, notify }) {
  const { roomCommands } = useHotel();
  const [form, setForm] = useState({ number: room.number, floor: room.floor, categoryId: room.categoryId });
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await roomCommands.update(room.id, form);
      notify('Habitación actualizada', 'Los datos persistentes fueron confirmados por el servidor.', 'success');
      onClose();
    } catch (error) {
      notify('No se pudo actualizar', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label>Número de habitación
        <input required maxLength="16" placeholder="Ej: 101" value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} />
      </label>
      <label>Piso
        <input required type="number" step="1" placeholder="Ej: 1" value={form.floor} onChange={(event) => setForm({ ...form, floor: event.target.value })} />
      </label>
      <label className="span-2">Categoría
        <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {getCategoryIcon(category.name)} {category.name} · Capacidad {category.capacity} pers. · {displayRate(category.baseNightlyRate)}/noche
            </option>
          ))}
        </select>
      </label>
      <div className="form-actions span-2">
        <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  );
}

function BlockForm({ operation, onClose, notify }) {
  const { roomCommands } = useHotel();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (saving || !reason.trim()) return;
    setSaving(true);
    try {
      await roomCommands.setBlocked(operation.room.id, operation.blocked, reason);
      notify(operation.blocked ? 'Habitación bloqueada' : 'Habitación desbloqueada', 'La transición fue confirmada y auditada por el servidor.', 'success');
      onClose();
    } catch (error) {
      notify('Transición rechazada', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="alert-banner alert-banner-warning span-2">
        {operation.blocked ? '🔒 Está a punto de bloquear temporalmente la habitación' : '🔓 Está a punto de desbloquear la habitación'}. Esta acción quedará registrada en el historial de auditoría.
      </div>
      <label className="span-2">Motivo del bloqueo / desbloqueo
        <textarea required maxLength="500" placeholder="Ej: Reparación de aire acondicionado / Mantenimiento programado" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <div className="form-actions span-2">
        <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={saving || !reason.trim()}>{saving ? 'Confirmando…' : operation.blocked ? 'Confirmar bloqueo' : 'Confirmar desbloqueo'}</button>
      </div>
    </form>
  );
}

export default function RoomsView({ notify, navigationIntent, consumeNavigationIntent }) {
  const { can } = usePermissions();
  const { state, roomCommands } = useHotel();
  const [status, setStatus] = useState('Todos');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [selectedId, setSelectedId] = useState(null);
  const [editorId, setEditorId] = useState(null);
  const [blockOperation, setBlockOperation] = useState(null);

  useEffect(() => {
    if (navigationIntent?.type === 'select-record') {
      setSelectedId(navigationIntent.recordId);
      consumeNavigationIntent(navigationIntent.id);
    }
  }, [navigationIntent, consumeNavigationIntent]);

  const records = state.rooms.filter((item) => {
    const matchStatus = status === 'Todos' || item.status === status;
    const matchQuery = !query || item.number.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase());
    return matchStatus && matchQuery;
  });

  const table = useCollectionTable(records, 'number', 10, JSON.stringify([status, query, records.map((item) => item.id)]));
  const selected = state.rooms.find((item) => item.id === selectedId);
  const editor = state.rooms.find((item) => item.id === editorId);
  const columns = [{ key: 'number', label: 'Habitación' }, { key: 'floor', label: 'Piso' }, { key: 'category', label: 'Categoría' }, { key: 'capacity', label: 'Capacidad' }, { key: 'nightlyRate', label: 'Tarifa base' }, { key: 'status', label: 'Estado' }];

  const retry = () => roomCommands.reload().catch((error) => notify('No se pudo cargar', error.message, 'error'));

  // Group rooms by floor for Grid View
  const roomsByFloor = records.reduce((acc, room) => {
    const floorKey = `Piso ${room.floor}`;
    if (!acc[floorKey]) acc[floorKey] = [];
    acc[floorKey].push(room);
    return acc;
  }, {});

  return (
    <div className="view-container">
      <PageHeader
        metadata={`${state.rooms.length} Habitaciones · Control de Inventario 5★`}
        title="Inventario y Estado de Habitaciones"
        description="Monitoreo en tiempo real de habitaciones disponibles, ocupadas, en limpieza y bloqueadas."
      />

      <MetricStrip
        items={[
          { label: 'Disponibles', value: state.rooms.filter((item) => item.status === 'Disponible').length },
          { label: 'Ocupadas', value: state.rooms.filter((item) => item.status === 'Ocupada').length },
          { label: 'En Limpieza', value: state.rooms.filter((item) => item.status === 'En limpieza').length },
          { label: 'Bloqueadas', value: state.rooms.filter((item) => item.status === 'Bloqueada').length },
        ]}
      />

      {state.roomRequest.status === 'loading' ? <div className="alert-banner alert-banner-info" role="status">Cargando inventario de habitaciones…</div> : null}
      {state.roomRequest.status === 'error' ? (
        <div className="alert-banner alert-banner-danger" role="alert">
          <span>{state.roomRequest.error}</span>
          <button className="btn btn-sm btn-outline" onClick={retry}>Reintentar</button>
        </div>
      ) : null}

      <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '280px' }}>
          <label className="search-label" style={{ flex: '1' }}>
            <Search size={16} />
            <input aria-label="Buscar habitación" placeholder="Buscar por número o categoría..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label style={{ margin: 0 }}>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="Todos">Todos los estados</option>
              {ROOM_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('table')}
            title="Vista de Tabla"
          >
            <List size={16} style={{ marginRight: '4px' }} /> Lista
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('grid')}
            title="Mapa de Habitaciones por Piso"
          >
            <LayoutGrid size={16} style={{ marginRight: '4px' }} /> Mapa de Piso
          </button>
          <span className="filter-result" style={{ marginLeft: '8px' }}>{records.length} habitaciones</span>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && state.roomRequest.status !== 'loading' && table.total ? (
        <section className="card table-container">
          <table className="custom-table">
            <caption>Directorio operativo de habitaciones</caption>
            <thead>
              <tr>
                {columns.map((column) => (
                  <SortableHeader key={column.key} column={column} sort={table.sort} onSort={table.toggleSort} />
                ))}
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {table.visible.map((room) => (
                <tr key={room.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #1e293b, #334155)',
                        color: '#e5c997',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '14px',
                        border: '1px solid rgba(229, 201, 151, 0.3)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      }}>
                        {room.number}
                      </div>
                      <div>
                        <strong style={{ fontSize: '14px', color: 'var(--text-main, #0f172a)' }}>Habitación {room.number}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Piso {room.floor}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                      Piso {room.floor}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {getCategoryIcon(room.category)} {room.category}
                    </span>
                  </td>
                  <td>👥 {room.capacity} pers.</td>
                  <td><strong>{displayRate(room.nightlyRate)}</strong> <span style={{ fontSize: '11px', color: '#64748b' }}>/ noche</span></td>
                  <td><StatusBadge>{room.status}</StatusBadge></td>
                  <td>
                    <RowActions label={`habitación ${room.number}`}>
                      <button role="menuitem" onClick={() => setSelectedId(room.id)}>Ver detalle completo</button>
                      {can(PERMISSIONS.roomsUpdate) ? <button role="menuitem" onClick={() => setEditorId(room.id)}>Editar tarifa y tipo</button> : null}
                      {can(PERMISSIONS.roomsBlock) && ['Disponible', 'Bloqueada'].includes(room.status) ? (
                        <button role="menuitem" onClick={() => setBlockOperation({ room, blocked: room.status !== 'Bloqueada' })}>
                          {room.status === 'Bloqueada' ? 'Desbloquear habitación' : 'Bloquear habitación'}
                        </button>
                      ) : null}
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination {...table} onPage={table.setPage} />
        </section>
      ) : null}

      {/* GRID MAP VIEW */}
      {viewMode === 'grid' && state.roomRequest.status !== 'loading' && records.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {Object.entries(roomsByFloor).map(([floorLabel, floorRooms]) => (
            <div key={floorLabel} className="card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                🏢 {floorLabel} ({floorRooms.length} habitaciones)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                {floorRooms.map((room) => (
                  <div
                    key={room.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px',
                      background: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>{getCategoryIcon(room.category)}</span>
                        <strong style={{ fontSize: '16px', color: '#0f172a' }}>Hab. {room.number}</strong>
                      </div>
                      <StatusBadge>{room.status}</StatusBadge>
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{room.category}</span>
                      <span>👥 Cap: {room.capacity}</span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', borderTop: '1px dashed #e2e8f0', paddingTop: '8px', marginTop: '2px' }}>
                      {displayRate(room.nightlyRate)} <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#64748b' }}>/ noche</span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => setSelectedId(room.id)}
                      >
                        Ver Detalle
                      </button>
                      {can(PERMISSIONS.roomsUpdate) ? (
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: '11px', padding: '4px 8px' }}
                          onClick={() => setEditorId(room.id)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {state.roomRequest.status !== 'loading' && !table.total ? (
        <EmptyState
          title="Sin habitaciones"
          description={state.roomRequest.status === 'error' ? 'No se pudo obtener el inventario.' : 'No se encontraron habitaciones para los filtros seleccionados.'}
        />
      ) : null}

      {/* DETALLE DRAWER */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? `Habitación ${selected.number}` : 'Habitación'}
        description={selected ? `Piso ${selected.floor} · ${selected.category}` : ''}
      >
        {selected ? (
          <DetailGrid items={[
            { label: 'Número de Habitación', value: selected.number },
            { label: 'Estado Operativo', node: <StatusBadge>{selected.status}</StatusBadge> },
            { label: 'Categoría', value: `${getCategoryIcon(selected.category)} ${selected.category}` },
            { label: 'Capacidad Máxima', value: `${selected.capacity} persona(s)` },
            { label: 'Tarifa Base por Noche', value: displayRate(selected.nightlyRate) },
            { label: 'Ubicación', value: `Piso ${selected.floor}` },
            { label: 'Fecha de Registro', value: new Date(selected.createdAt).toLocaleString('es-PE') },
          ]} />
        ) : null}
      </Drawer>

      {/* EDITAR DIALOG */}
      <Dialog open={Boolean(editor)} onClose={() => setEditorId(null)} title={editor ? `Editar habitación ${editor.number}` : 'Editar habitación'}>
        {editor ? <RoomForm room={editor} categories={state.roomCategories} notify={notify} onClose={() => setEditorId(null)} /> : null}
      </Dialog>

      {/* BLOQUEAR DIALOG */}
      <Dialog
        open={Boolean(blockOperation)}
        onClose={() => setBlockOperation(null)}
        title={blockOperation?.blocked ? `Bloquear habitación ${blockOperation.room.number}` : `Desbloquear habitación ${blockOperation?.room.number}`}
      >
        {blockOperation ? <BlockForm operation={blockOperation} notify={notify} onClose={() => setBlockOperation(null)} /> : null}
      </Dialog>
    </div>
  );
}
