import { useEffect, useState } from 'react';
import { Bed, Calendar, Check, Clock, Edit, Eye, Key, Layers, LayoutGrid, List, Lock, RefreshCw, Search, ShieldCheck, Sparkles, Unlock } from 'lucide-react';
import { usePermissions } from '../../../auth/authContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { ROOM_STATUSES } from '../../../domain/hotelModel';
import { useCollectionTable } from '../../../hooks/useCollectionTable';
import { useHotel, useHotelCommands } from '../../../state/hotelContext';
import { Pagination, SortableHeader } from '../../ui/CollectionTable';
import { Dialog, Drawer } from '../../ui/Overlay';
import { EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';
import { getCategoryAudit, getRoomAmenities, updateCategoryAmenities } from '../../../rooms/roomsClient';
import { useWebSocket } from '../../../hooks/useWebSocket';

const displayRate = (rate) => `S/ ${Number(rate).toFixed(2)}`;

const MASTER_AMENITY_LABELS = {
  wifi_high_speed: { label: 'WiFi 6 de Alta Velocidad', icon: '📶', tag: 'Conectividad' },
  smart_tv_4k: { label: 'Smart TV 55" 4K Streaming', icon: '📺', tag: 'Entretenimiento' },
  smart_ac: { label: 'Climatización Inteligente', icon: '❄️', tag: 'Confort' },
  spanish_shower: { label: 'Baño con Ducha Española', icon: '🚿', tag: 'Bienestar' },
  luxury_amenities: { label: 'Amenities 5★ Exclusivos', icon: '🧴', tag: 'Bienestar' },
  jacuzzi_tub: { label: 'Tina de Hidromasaje / Jacuzzi', icon: '🛁', tag: 'Lujo' },
  panoramic_balcony: { label: 'Balcón Vista Panorámica', icon: '🌅', tag: 'Lujo' },
  nespresso_minibar: { label: 'Frigobar & Nespresso', icon: '☕', tag: 'Gastronomía' },
  digital_safe: { label: 'Caja Fuerte Digital', icon: '🔐', tag: 'Seguridad' },
  room_service_24_7: { label: 'Room Service 24/7', icon: '🛎️', tag: 'Servicio' },
  executive_desk: { label: 'Escritorio Ejecutivo', icon: '💼', tag: 'Trabajo' },
  soundproof_windows: { label: 'Aislamiento Acústico', icon: '🔇', tag: 'Confort' },
  bathrobe_slippers: { label: 'Batas y Pantuflas de Lujo', icon: '🥋', tag: 'Bienestar' },
  king_bed: { label: 'Cama King Size 600 Hilos', icon: '👑', tag: 'Confort' },
};

function getCategoryIcon(categoryName = '') {
  const name = categoryName.toLowerCase();
  if (name.includes('suite')) return '👑';
  if (name.includes('matrimonial')) return '👩‍❤️‍👨';
  if (name.includes('doble')) return '🛏️🛏️';
  if (name.includes('triple')) return '🛌🛌';
  return '🛏️';
}

function RoomForm({ room, categories, onClose, notify, onEditCategory }) {
  const { roomCommands } = useHotelCommands();
  const [form, setForm] = useState({ number: room.number, floor: room.floor, categoryId: room.categoryId });
  const [saving, setSaving] = useState(false);

  const selectedCategory = categories.find((c) => c.id === form.categoryId) || categories[0];

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
    <form className="form-grid rooms-form rooms-form-room" onSubmit={submit}>
      {/* Live Preview Card */}
      <div className="modal-live-preview span-2">
        <div className="modal-live-preview-header">
          <span>✨ Vista Previa de la Habitación</span>
          <span className="badge badge-blue">Actualización en tiempo real</span>
        </div>
        <div className="modal-live-preview-card">
          <div className="modal-live-preview-left">
            <div className="modal-live-preview-badge">
              {form.number || '---'}
            </div>
            <div className="modal-live-preview-details">
              <strong>
                {getCategoryIcon(selectedCategory?.name)} {selectedCategory?.name || 'Categoría'}
              </strong>
              <span>Piso {form.floor || '1'} · Capacidad {selectedCategory?.capacity || 2} pers.</span>
            </div>
          </div>
          <div className="modal-live-preview-price">
            <strong>{displayRate(selectedCategory?.baseNightlyRate || 0)}</strong>
            <small>/ noche base</small>
          </div>
        </div>
      </div>

      <label>
        <span className="rooms-field-label">
          <Key size={14} color="var(--color-navy)" /> Número de habitación
        </span>
        <div className="field-icon-wrap">
          <input
            required
            maxLength="16"
            placeholder="Ej: 102"
            value={form.number}
            onChange={(event) => setForm({ ...form, number: event.target.value })}
          />
        </div>
      </label>

      <label>
        <span className="rooms-field-label">
          <Layers size={14} color="var(--color-navy)" /> Piso / Nivel
        </span>
        <div className="field-icon-wrap">
          <input
            required
            type="number"
            step="1"
            placeholder="Ej: 1"
            value={form.floor}
            onChange={(event) => setForm({ ...form, floor: event.target.value })}
          />
        </div>
      </label>

      <label className="span-2">
        <div className="rooms-field-heading">
          <span className="rooms-field-label rooms-field-label-inline">
            <Bed size={14} color="var(--color-navy)" /> Categoría y Tarifa asignada
          </span>
          {onEditCategory ? (
            <button
              type="button"
              className="btn btn-sm btn-outline rooms-compact-button"
              onClick={() => {
                onClose();
                onEditCategory(selectedCategory);
              }}
            >
              ✏️ Modificar tarifa de esta categoría
            </button>
          ) : null}
        </div>
        <div className="field-icon-wrap">
          <select
            value={form.categoryId}
            onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
            className="rooms-category-select"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {getCategoryIcon(category.name)} {category.name} · Capacidad {category.capacity} pers. · {displayRate(category.baseNightlyRate)} / noche
              </option>
            ))}
          </select>
        </div>
      </label>

      <div className="form-actions span-2 rooms-form-actions">
        <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary" disabled={saving}>
          {saving ? (
            <span className="rooms-saving-label">
              <RefreshCw size={14} className="spin" /> Guardando…
            </span>
          ) : (
            'Guardar cambios'
          )}
        </button>
      </div>
    </form>
  );
}

function CategoryForm({ category, onClose, notify, initialTab = 'details', onAmenitiesUpdated }) {
  const { roomCommands } = useHotelCommands();
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({
    name: category?.name || '',
    code: category?.code || '',
    capacity: category?.capacity || 2,
    baseNightlyRate: category?.baseNightlyRate || '100.00',
  });
  const [saving, setSaving] = useState(false);

  // Amenities
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [loadingAmenities, setLoadingAmenities] = useState(false);

  // Audit
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    let active = true;
    if (category?.id) {
      setLoadingAmenities(true);
      getRoomAmenities()
        .then((res) => {
          if (!active) return;
          setSelectedAmenities(res.categoryAmenities?.[category.id] || []);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoadingAmenities(false); });
    }
    return () => { active = false; };
  }, [category?.id]);

  useEffect(() => {
    let active = true;
    if (tab === 'audit' && category?.id) {
      setLoadingAudit(true);
      getCategoryAudit(category.id)
        .then((res) => {
          if (active) setAuditLogs(res || []);
        })
        .catch(() => {})
        .finally(() => { if (active) setLoadingAudit(false); });
    }
    return () => { active = false; };
  }, [tab, category?.id]);

  const toggleAmenity = (key) => {
    setSelectedAmenities((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (tab === 'details') {
        await roomCommands.updateCategory(category.id, form);
        notify('Categoría actualizada', `La tarifa de ${form.name} ahora es ${displayRate(form.baseNightlyRate)} por noche.`, 'success');
      } else if (tab === 'amenities') {
        await updateCategoryAmenities(category.id, selectedAmenities);
        if (onAmenitiesUpdated) onAmenitiesUpdated();
        notify('Comodidades actualizadas', `Se guardaron ${selectedAmenities.length} amenidades para ${category.name}.`, 'success');
      }
      onClose();
    } catch (error) {
      notify('No se pudo actualizar', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-grid rooms-form rooms-form-category" onSubmit={submit}>
      {/* TABS DE CATEGORÍA */}
      <div className="rooms-category-tabs">
        <button
          type="button"
          className={`btn btn-sm ${tab === 'details' ? 'btn-primary' : 'btn-outline'} rooms-tab-button`}
          onClick={() => setTab('details')}
        >
          <Bed size={14} /> Datos y Tarifa
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'amenities' ? 'btn-primary' : 'btn-outline'} rooms-tab-button`}
          onClick={() => setTab('amenities')}
        >
          <Sparkles size={14} /> Amenities ({selectedAmenities.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'audit' ? 'btn-primary' : 'btn-outline'} rooms-tab-button`}
          onClick={() => setTab('audit')}
        >
          <Clock size={14} /> Historial / Auditoría
        </button>
      </div>

      {tab === 'details' && (
        <>
          <div className="modal-live-preview span-2">
            <div className="modal-live-preview-header">
              <span>✨ Vista Previa de Categoría y Tarifa</span>
              <span className="badge badge-blue">Sincronización en vivo</span>
            </div>
            <div className="modal-live-preview-card">
              <div className="modal-live-preview-left">
                <div className="modal-live-preview-badge">
                  {getCategoryIcon(form.name)}
                </div>
                <div className="modal-live-preview-details">
                  <strong>{form.name || 'Categoría'}</strong>
                  <span>Código: {form.code || '---'} · Capacidad: {form.capacity} pers.</span>
                </div>
              </div>
              <div className="modal-live-preview-price">
                <strong>{displayRate(form.baseNightlyRate || 0)}</strong>
                <small>/ noche base</small>
              </div>
            </div>
          </div>

          <label>
            <span className="rooms-field-label">
              Nombre de Categoría
            </span>
            <div className="field-icon-wrap">
              <input
                required
                maxLength="100"
                placeholder="Ej: Suite Matrimonial"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
          </label>

          <label>
            <span className="rooms-field-label">
              Código Único
            </span>
            <div className="field-icon-wrap">
              <input
                required
                maxLength="32"
                placeholder="Ej: SUITE"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
              />
            </div>
          </label>

          <label>
            <span className="rooms-field-label">
              Capacidad Máxima (personas)
            </span>
            <div className="field-icon-wrap">
              <input
                required
                type="number"
                min="1"
                max="12"
                value={form.capacity}
                onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })}
              />
            </div>
          </label>

          <label>
            <span className="rooms-field-label">
              Tarifa Base por Noche (S/)
            </span>
            <div className="field-icon-wrap">
              <input
                required
                type="number"
                step="0.5"
                min="0"
                placeholder="Ej: 260.00"
                value={form.baseNightlyRate}
                onChange={(event) => setForm({ ...form, baseNightlyRate: event.target.value })}
              />
            </div>
          </label>
        </>
      )}

      {tab === 'amenities' && (
        <div className="rooms-category-panel rooms-amenities-panel">
          <div className="rooms-muted-copy">
            Selecciona las amenidades y servicios de lujo incluidos para todas las habitaciones de categoría <strong>{category.name}</strong>. Se reflejarán instantáneamente en la recepción y en el portal de clientes.
          </div>

          {loadingAmenities ? (
            <div className="rooms-loading-state">
              <RefreshCw size={16} className="spin" /> Cargando catálogo de comodidades…
            </div>
          ) : (
            <div className="rooms-amenities-grid">
              {Object.entries(MASTER_AMENITY_LABELS).map(([key, info]) => {
                const isChecked = selectedAmenities.includes(key);
                return (
                  <div
                    key={key}
                    onClick={() => toggleAmenity(key)}
                    className={`rooms-amenity-option ${isChecked ? 'is-checked' : ''}`}
                  >
                    <div className="rooms-amenity-check">
                      {isChecked && <Check size={14} strokeWidth={3} />}
                    </div>
                    <div className="rooms-amenity-copy">
                      <span className={`rooms-amenity-name ${isChecked ? 'is-checked' : ''}`}>
                        {info.icon} {info.label}
                      </span>
                      <span className="rooms-amenity-tag">
                        {info.tag}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="rooms-category-panel rooms-audit-panel">
          <div className="rooms-muted-copy rooms-audit-intro">
            Historial de cambios de tarifa, capacidad y comodidades registrados en la base de datos de auditoría.
          </div>
          {loadingAudit ? (
            <div className="rooms-loading-state">
              <RefreshCw size={16} className="spin" /> Cargando historial de auditoría…
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="rooms-empty-state">
              No hay modificaciones registradas aún para esta categoría.
            </div>
          ) : (
            <div className="rooms-audit-list">
              {auditLogs.map((log) => (
                <div key={log.id} className="rooms-audit-entry">
                  <div className="rooms-audit-header">
                    <span className={`badge ${log.eventType.includes('amenities') ? 'badge-blue' : 'badge-green'} rooms-audit-badge`}>
                      {log.eventType === 'room_category.updated' ? 'Tarifa / Parámetros' : log.eventType === 'room_category_amenities.updated' ? 'Amenities 5★' : log.eventType}
                    </span>
                    <span className="rooms-audit-date">
                      <Clock size={12} /> {new Date(log.occurredAt).toLocaleString('es-PE')}
                    </span>
                  </div>
                  <div className="rooms-audit-actor">
                    Modificado por: <strong>{log.actorEmail}</strong>
                  </div>
                  {log.metadata?.changes && (
                    <div className="rooms-audit-changes">
                      {Object.entries(log.metadata.changes).map(([k, v]) => (
                        <span key={k} className="rooms-audit-change">
                          {k === 'baseNightlyRate' ? `Nueva tarifa: S/ ${v}` : `${k}: ${v}`}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.metadata?.amenitiesCount !== undefined && (
                    <div className="rooms-audit-amenities-count">
                      Comodidades asignadas: <strong>{log.metadata.amenitiesCount}</strong> items ({log.metadata.amenityKeys?.slice(0, 3).join(', ')}...)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="form-actions span-2 rooms-form-actions">
        <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>
          {tab === 'audit' ? 'Cerrar' : 'Cancelar'}
        </button>
        {tab !== 'audit' && (
          <button className="btn btn-primary" disabled={saving}>
            {saving ? (
              <span className="rooms-saving-label">
                <RefreshCw size={14} className="spin" /> Guardando…
              </span>
            ) : (
              tab === 'amenities' ? 'Guardar comodidades' : 'Guardar cambios en categoría'
            )}
          </button>
        )}
      </div>
    </form>
  );
}

function BlockForm({ operation, onClose, notify }) {
  const { roomCommands } = useHotelCommands();
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
    <form className="form-grid rooms-form rooms-form-block" onSubmit={submit}>
      <div className={`alert-banner ${operation.blocked ? 'alert-banner-warning' : 'alert-banner-info'} span-2`}>
        {operation.blocked ? '🔒 Bloqueo Operativo:' : '🔓 Desbloqueo Operativo:'} {operation.blocked ? 'La habitación no podrá recibir nuevas asignaciones de reserva hasta su desbloqueo.' : 'La habitación pasará a estar disponible para asignación inmediata.'}
      </div>
      <label className="span-2">
        <span className="rooms-field-label">Motivo del {operation.blocked ? 'bloqueo' : 'desbloqueo'}</span>
        <textarea
          required
          maxLength="500"
          placeholder="Ej: Mantenimiento preventivo de aire acondicionado / Pintura y acabados"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="rooms-block-reason"
        />
      </label>
      <div className="form-actions span-2 rooms-form-actions rooms-form-actions-compact">
        <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>Cancelar</button>
        <button className={operation.blocked ? 'btn btn-danger' : 'btn btn-primary'} disabled={saving || !reason.trim()}>
          {saving ? (
            <span className="rooms-saving-label">
              <RefreshCw size={14} className="spin" /> Confirmando…
            </span>
          ) : operation.blocked ? (
            'Confirmar bloqueo'
          ) : (
            'Confirmar desbloqueo'
          )}
        </button>
      </div>
    </form>
  );
}

export default function RoomsView({ navigate, notify, navigationIntent, consumeNavigationIntent }) {
  const { can } = usePermissions();
  const { state, roomCommands } = useHotel();
  const [status, setStatus] = useState('Todos');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid' | 'categories'
  const [selectedId, setSelectedId] = useState(null);
  const [editorId, setEditorId] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryInitialTab, setCategoryInitialTab] = useState('details');
  const [blockOperation, setBlockOperation] = useState(null);
  const [amenitiesMap, setAmenitiesMap] = useState({});
  const [liveUpdatedRoomId, setLiveUpdatedRoomId] = useState(null);

  const loadAmenities = () => {
    getRoomAmenities()
      .then((res) => {
        if (res?.categoryAmenities) setAmenitiesMap(res.categoryAmenities);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadAmenities();
  }, []);

  useWebSocket('room:amenities_updated', (data) => {
    if (data?.categoryAmenities) {
      setAmenitiesMap(data.categoryAmenities);
    }
  });

  useWebSocket('room:updated', (payload) => {
    if (payload?.id) {
      setLiveUpdatedRoomId(payload.id);
      setTimeout(() => setLiveUpdatedRoomId(null), 4000);
    }
  });

  useWebSocket('room:status_changed', (payload) => {
    if (payload?.id) {
      setLiveUpdatedRoomId(payload.id);
      setTimeout(() => setLiveUpdatedRoomId(null), 4000);
    }
  });

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
        metadata={`${state.rooms.length} Habitaciones · ${state.roomCategories.length} Categorías · Control 5★`}
        title="Inventario y Tarifas de Habitaciones"
        description="Gestión en tiempo real de inventario, tarifas base por categoría y estado de ocupación."
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

      <div className="filter-bar rooms-filter-bar">
        <div className="rooms-filter-main">
          <label className="search-label rooms-search-label">
            <Search size={16} />
            <input aria-label="Buscar habitación" placeholder="Buscar por número o categoría..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="rooms-status-filter">
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="Todos">Todos los estados</option>
              {ROOM_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>

        <div className="rooms-view-controls">
          <div className="tabs">
            <button
              className={`${viewMode === 'table' ? 'active' : ''} rooms-tab-control`}
              onClick={() => setViewMode('table')}
              title="Vista de Tabla"
            >
              <List size={16} /> Lista
            </button>
            <button
              className={`${viewMode === 'grid' ? 'active' : ''} rooms-tab-control`}
              onClick={() => setViewMode('grid')}
              title="Mapa de Habitaciones por Piso"
            >
              <LayoutGrid size={16} /> Mapa de Piso
            </button>
            <button
              className={`${viewMode === 'categories' ? 'active' : ''} rooms-tab-control`}
              onClick={() => setViewMode('categories')}
              title="Gestión de Categorías y Tarifas"
            >
              <Bed size={16} /> Categorías y Tarifas
            </button>
          </div>
          <span className="filter-result">
            {viewMode === 'categories' ? `${state.roomCategories.length} categorías` : `${records.length} habitaciones`}
          </span>
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
              {table.visible.map((room) => {
                const isLive = room.id === liveUpdatedRoomId;
                return (
                <tr key={room.id} className={`rooms-table-row ${isLive ? 'is-live' : ''}`}>
                  <td>
                    <div className="rooms-table-room-cell">
                      <div className={`rooms-table-room-number ${isLive ? 'is-live' : ''}`}>
                        {room.number}
                      </div>
                      <div>
                        <div className="rooms-table-room-title">
                          <strong>Habitación {room.number}</strong>
                          {isLive && <span className="badge badge-green rooms-live-badge">En vivo</span>}
                        </div>
                        <div className="rooms-table-floor">Piso {room.floor}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="rooms-floor-badge">
                      Piso {room.floor}
                    </span>
                  </td>
                  <td>
                    <span className="rooms-category-cell">
                      {getCategoryIcon(room.category)} {room.category}
                    </span>
                  </td>
                  <td>👥 {room.capacity} pers.</td>
                  <td><strong>{displayRate(room.nightlyRate)}</strong> <span className="rooms-muted-small">/ noche</span></td>
                  <td><StatusBadge>{room.status}</StatusBadge></td>
                  <td>
                    <div className="quick-actions-row">
                      <button
                        type="button"
                        className="quick-action-btn btn-action-view"
                        data-tooltip="Ver detalle completo"
                        aria-label={`Ver detalle de habitación ${room.number}`}
                        onClick={() => setSelectedId(room.id)}
                      >
                        <Eye size={15} />
                      </button>

                      {can(PERMISSIONS.roomsUpdate) ? (
                        <button
                          type="button"
                          className="quick-action-btn btn-action-edit"
                          data-tooltip="Editar habitación"
                          aria-label={`Editar habitación ${room.number}`}
                          onClick={() => setEditorId(room.id)}
                        >
                          <Edit size={15} />
                        </button>
                      ) : null}

                      {can(PERMISSIONS.roomsBlock) && ['Disponible', 'Bloqueada'].includes(room.status) ? (
                        <button
                          type="button"
                          className={`quick-action-btn ${room.status === 'Bloqueada' ? 'btn-action-unlock' : 'btn-action-lock'}`}
                          data-tooltip={room.status === 'Bloqueada' ? 'Desbloquear habitación' : 'Bloquear habitación'}
                          aria-label={room.status === 'Bloqueada' ? `Desbloquear habitación ${room.number}` : `Bloquear habitación ${room.number}`}
                          onClick={() => setBlockOperation({ room, blocked: room.status !== 'Bloqueada' })}
                        >
                          {room.status === 'Bloqueada' ? <Unlock size={15} /> : <Lock size={15} />}
                        </button>
                      ) : null}

                      {navigate && room.status === 'Disponible' ? (
                        <button
                          type="button"
                          className="quick-action-btn btn-action-book"
                          data-tooltip="Crear reserva"
                          aria-label={`Crear reserva en habitación ${room.number}`}
                          onClick={() => navigate('reservas', { type: 'create-reservation', roomId: room.id })}
                        >
                          <Calendar size={15} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination {...table} onPage={table.setPage} />
        </section>
      ) : null}

      {/* GRID MAP VIEW */}
      {viewMode === 'grid' && state.roomRequest.status !== 'loading' && records.length ? (
        <div className="rooms-floor-groups">
          {Object.entries(roomsByFloor).map(([floorLabel, floorRooms]) => (
            <div key={floorLabel} className="card rooms-floor-card">
              <h3 className="rooms-floor-heading">
                🏢 {floorLabel} ({floorRooms.length} habitaciones)
              </h3>
              <div className="rooms-floor-room-grid">
                {floorRooms.map((room) => {
                  const isLive = room.id === liveUpdatedRoomId;
                  return (
                  <div
                    key={room.id}
                    className={`rooms-floor-room ${isLive ? 'is-live' : ''}`}
                  >
                    {isLive && (
                      <div className="rooms-live-ribbon">
                        ✨ Actualizado en vivo
                      </div>
                    )}
                    <div className="rooms-floor-room-header">
                      <div className="rooms-floor-room-title">
                        <span className="rooms-floor-room-icon">{getCategoryIcon(room.category)}</span>
                        <strong>Hab. {room.number}</strong>
                      </div>
                      <StatusBadge>{room.status}</StatusBadge>
                    </div>

                    <div className="rooms-floor-room-meta">
                      <span>{room.category}</span>
                      <span>👥 Cap: {room.capacity}</span>
                    </div>

                    <div className="rooms-floor-room-price">
                      {displayRate(room.nightlyRate)} <span className="rooms-muted-small">/ noche</span>
                    </div>

                    <div className="rooms-floor-room-actions">
                      <span className="rooms-actions-label">Acciones:</span>
                      <div className="quick-actions-row">
                        <button
                          type="button"
                          className="quick-action-btn btn-action-view"
                          data-tooltip="Ver detalle completo"
                          aria-label={`Ver detalle de habitación ${room.number}`}
                          onClick={() => setSelectedId(room.id)}
                        >
                          <Eye size={14} />
                        </button>

                        {can(PERMISSIONS.roomsUpdate) ? (
                          <button
                            type="button"
                            className="quick-action-btn btn-action-edit"
                            data-tooltip="Editar habitación"
                            aria-label={`Editar habitación ${room.number}`}
                            onClick={() => setEditorId(room.id)}
                          >
                            <Edit size={14} />
                          </button>
                        ) : null}

                        {can(PERMISSIONS.roomsBlock) && ['Disponible', 'Bloqueada'].includes(room.status) ? (
                          <button
                            type="button"
                            className={`quick-action-btn ${room.status === 'Bloqueada' ? 'btn-action-unlock' : 'btn-action-lock'}`}
                            data-tooltip={room.status === 'Bloqueada' ? 'Desbloquear habitación' : 'Bloquear habitación'}
                            aria-label={room.status === 'Bloqueada' ? `Desbloquear habitación ${room.number}` : `Bloquear habitación ${room.number}`}
                            onClick={() => setBlockOperation({ room, blocked: room.status !== 'Bloqueada' })}
                          >
                            {room.status === 'Bloqueada' ? <Unlock size={14} /> : <Lock size={14} />}
                          </button>
                        ) : null}

                        {navigate && room.status === 'Disponible' ? (
                          <button
                            type="button"
                            className="quick-action-btn btn-action-book"
                            data-tooltip="Crear reserva"
                            aria-label={`Crear reserva en habitación ${room.number}`}
                            onClick={() => navigate('reservas', { type: 'create-reservation', roomId: room.id })}
                          >
                            <Calendar size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* CATEGORIES VIEW */}
      {viewMode === 'categories' && state.roomRequest.status !== 'loading' && (
        <section className="card table-container">
          <table className="custom-table">
            <caption>Catálogo de categorías y tarifas base de habitaciones</caption>
            <thead>
              <tr>
                <th scope="col">Categoría</th>
                <th scope="col">Código</th>
                <th scope="col">Capacidad</th>
                <th scope="col">Tarifa Base por Noche</th>
                <th scope="col">Habitaciones</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {state.roomCategories.map((cat) => {
                const roomCount = state.rooms.filter((r) => r.categoryId === cat.id).length;
                return (
                  <tr key={cat.id}>
                    <td>
                      <div className="rooms-category-cell-wrap">
                        <div className="rooms-category-icon">
                          {getCategoryIcon(cat.name)}
                        </div>
                        <div>
                          <strong className="rooms-category-name">{cat.name}</strong>
                          <div className="rooms-muted-small">Estándar Park Plaza 5★</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="rooms-category-code">
                        {cat.code}
                      </span>
                    </td>
                    <td>
                      <span className="rooms-category-capacity">
                        👥 Hasta {cat.capacity} huésped(es)
                      </span>
                    </td>
                    <td>
                      <div className="rooms-category-rate">
                        <strong>
                          {displayRate(cat.baseNightlyRate)}
                        </strong>
                        <span className="rooms-muted-small">/ noche base</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-blue">
                        {roomCount} {roomCount === 1 ? 'habitación' : 'habitaciones'}
                      </span>
                    </td>
                    <td>
                      {can(PERMISSIONS.roomsUpdate) ? (
                        <div className="rooms-category-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryInitialTab('details');
                              setEditingCategory(cat);
                            }}
                             className="btn btn-sm btn-outline rooms-action-button"
                          >
                            <Edit size={13} /> Tarifa
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryInitialTab('amenities');
                              setEditingCategory(cat);
                            }}
                          >
                            <Sparkles size={13} color="var(--color-gold)" /> Amenities ({amenitiesMap[cat.id]?.length || 0})
                          </button>
                          <button
                            type="button"
                             onClick={() => {
                              setCategoryInitialTab('audit');
                              setEditingCategory(cat);
                            }}
                            className="btn btn-sm btn-outline rooms-action-button"
                          >
                            <Clock size={13} /> Historial
                          </button>
                        </div>
                      ) : (
                        <span className="rooms-muted-copy rooms-read-only">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {viewMode !== 'categories' && state.roomRequest.status !== 'loading' && !table.total ? (
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
          <div className="rooms-drawer-content">
            {/* HERO CARD */}
            <div className="room-hero-card">
              <div className="room-hero-top">
                <div className="room-hero-badge">
                  <div className="room-hero-number">{selected.number}</div>
                  <div className="room-hero-info">
                    <h3>{getCategoryIcon(selected.category)} {selected.category}</h3>
                    <span>Piso {selected.floor} · Hotel Park Plaza</span>
                  </div>
                </div>
                <div className="room-hero-price-tag">
                  <strong>{displayRate(selected.nightlyRate)}</strong>
                  <small>por noche</small>
                </div>
              </div>
              <div className="rooms-hero-status">
                <span>Estado Operativo:</span>
                <StatusBadge>{selected.status}</StatusBadge>
              </div>
            </div>

            {/* ESPECIFICACIONES TÉCNICAS */}
            <div className="drawer-section-card">
              <div className="drawer-section-title">
                <ShieldCheck size={16} color="var(--color-gold)" /> Ficha Operativa
              </div>
              <div className="drawer-specs-grid">
                <div className="drawer-spec-item">
                  <div className="drawer-spec-icon">👥</div>
                  <div className="drawer-spec-text">
                    <span>Capacidad Máxima</span>
                    <strong>{selected.capacity} persona(s)</strong>
                  </div>
                </div>
                <div className="drawer-spec-item">
                  <div className="drawer-spec-icon">🏢</div>
                  <div className="drawer-spec-text">
                    <span>Ubicación</span>
                    <strong>Piso {selected.floor}</strong>
                  </div>
                </div>
                <div className="drawer-spec-item">
                  <div className="drawer-spec-icon">🛏️</div>
                  <div className="drawer-spec-text">
                    <span>Categoría</span>
                    <strong>{selected.category}</strong>
                  </div>
                </div>
                <div className="drawer-spec-item">
                  <div className="drawer-spec-icon">💳</div>
                  <div className="drawer-spec-text">
                    <span>Tarifa Base</span>
                    <strong>{displayRate(selected.nightlyRate)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* COMODIDADES Y SERVICIOS */}
            <div className="drawer-section-card">
              <div className="rooms-drawer-section-header">
                <div className="drawer-section-title rooms-drawer-section-title">
                  <Sparkles size={16} color="var(--color-gold)" /> Comodidades y Servicios 5★
                </div>
                {can(PERMISSIONS.roomsUpdate) && (
                  <button
                    type="button"
                            className="btn btn-sm btn-outline rooms-compact-button rooms-customize-button"
                    onClick={() => {
                      const cat = state.roomCategories.find((c) => c.id === selected.categoryId);
                      if (cat) {
                        setSelectedId(null);
                        setCategoryInitialTab('amenities');
                        setEditingCategory(cat);
                      }
                    }}
                  >
                    ⚙️ Personalizar
                  </button>
                )}
              </div>
              <div className="amenities-container">
                {(() => {
                  const categoryAmenities = amenitiesMap[selected.categoryId] || [];
                  if (categoryAmenities.length === 0) {
                    return (
                      <>
                        <span className="amenity-chip">📶 WiFi 6 Alta Velocidad</span>
                        <span className="amenity-chip">📺 Smart TV 55" 4K</span>
                        <span className="amenity-chip">❄️ Climatización Inteligente</span>
                        <span className="amenity-chip">🚿 Baño Privado / Ducha Española</span>
                        <span className="amenity-chip">🧴 Amenities 5★ Exclusivos</span>
                        <span className="amenity-chip">🛎️ Room Service 24/7</span>
                        <span className="amenity-chip">🔐 Caja Fuerte Digital</span>
                      </>
                    );
                  }
                  return categoryAmenities.map((key) => {
                    const info = MASTER_AMENITY_LABELS[key];
                    return (
                      <span key={key} className="amenity-chip">
                        {info ? `${info.icon} ${info.label}` : key}
                      </span>
                    );
                  });
                })()}
              </div>
            </div>

            {/* TRAZABILIDAD Y REGISTRO */}
            <div className="drawer-section-card">
              <div className="drawer-section-title">
                <Clock size={16} color="var(--color-navy)" /> Registro y Trazabilidad
              </div>
              <div className="rooms-traceability-list">
                <div className="rooms-traceability-row">
                  <span>Fecha de Registro:</span>
                  <strong>{new Date(selected.createdAt).toLocaleString('es-PE')}</strong>
                </div>
                <div className="rooms-traceability-row">
                  <span>Identificador Interno:</span>
                  <strong className="rooms-traceability-id">HAB-{selected.id.slice(0, 8)}</strong>
                </div>
              </div>
            </div>

            {/* ACCIONES RÁPIDAS */}
            <div className="drawer-actions-stack">
              {can(PERMISSIONS.roomsUpdate) ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline rooms-full-action"
                    onClick={() => {
                      const id = selected.id;
                      setSelectedId(null);
                      setEditorId(id);
                    }}
                  >
                    <Edit size={16} /> Editar Número y Piso de Habitación
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline rooms-full-action"
                    onClick={() => {
                      const cat = state.roomCategories.find((c) => c.id === selected.categoryId);
                      if (cat) {
                        setSelectedId(null);
                        setEditingCategory(cat);
                      }
                    }}
                  >
                    <Bed size={16} /> Modificar Tarifa Base de {selected.category}
                  </button>
                </>
              ) : null}

              {can(PERMISSIONS.roomsBlock) && ['Disponible', 'Bloqueada'].includes(selected.status) ? (
                <button
                  type="button"
                  className="btn btn-outline rooms-full-action"
                  onClick={() => {
                    const currentRoom = selected;
                    setSelectedId(null);
                    setBlockOperation({ room: currentRoom, blocked: currentRoom.status !== 'Bloqueada' });
                  }}
                >
                  {selected.status === 'Bloqueada' ? (
                    <>
                      <Unlock size={16} /> Desbloquear Habitación
                    </>
                  ) : (
                    <>
                      <Lock size={16} /> Bloquear Habitación para Mantenimiento
                    </>
                  )}
                </button>
              ) : null}

              {navigate ? (
                <button
                  type="button"
                  className="btn btn-primary rooms-full-action"
                  onClick={() => {
                    navigate('reservas', { type: 'create-reservation', roomId: selected.id });
                    setSelectedId(null);
                  }}
                >
                  <Calendar size={16} /> Crear Reserva para Habitación {selected.number}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* EDITAR DIALOG */}
      <Dialog open={Boolean(editor)} onClose={() => setEditorId(null)} title={editor ? `Editar habitación ${editor.number}` : 'Editar habitación'}>
        {editor ? (
          <RoomForm
            room={editor}
            categories={state.roomCategories}
            notify={notify}
            onClose={() => setEditorId(null)}
            onEditCategory={(cat) => {
              setEditorId(null);
              setEditingCategory(cat);
            }}
          />
        ) : null}
      </Dialog>

      {/* EDITAR CATEGORÍA DIALOG */}
      <Dialog
        open={Boolean(editingCategory)}
        onClose={() => {
          setEditingCategory(null);
          setCategoryInitialTab('details');
        }}
        title={editingCategory ? `Configurar Categoría y Amenities: ${editingCategory.name}` : 'Editar Categoría'}
      >
        {editingCategory ? (
          <CategoryForm
            category={editingCategory}
            notify={notify}
            initialTab={categoryInitialTab}
            onAmenitiesUpdated={loadAmenities}
            onClose={() => {
              setEditingCategory(null);
              setCategoryInitialTab('details');
            }}
          />
        ) : null}
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
