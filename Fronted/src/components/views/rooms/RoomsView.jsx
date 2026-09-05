import { useEffect, useState } from 'react';
import { Bed, Calendar, Check, CheckCircle2, Clock, Edit, Eye, History, Info, Key, Layers, LayoutGrid, List, Lock, RefreshCw, Search, ShieldCheck, Sparkles, Unlock } from 'lucide-react';
import { usePermissions } from '../../../auth/authContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { ROOM_STATUSES } from '../../../domain/hotelModel';
import { useCollectionTable } from '../../../hooks/useCollectionTable';
import { useHotel } from '../../../state/hotelContext';
import { Pagination, RowActions, SortableHeader } from '../../ui/CollectionTable';
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
  const { roomCommands } = useHotel();
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
    <form className="form-grid" onSubmit={submit} style={{ gap: '18px' }}>
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
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '700' }}>
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
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '700' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
            <Bed size={14} color="var(--color-navy)" /> Categoría y Tarifa asignada
          </span>
          {onEditCategory ? (
            <button
              type="button"
              className="btn btn-sm btn-outline"
              style={{ fontSize: '11px', padding: '2px 8px' }}
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
            style={{ fontWeight: '600' }}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {getCategoryIcon(category.name)} {category.name} · Capacidad {category.capacity} pers. · {displayRate(category.baseNightlyRate)} / noche
              </option>
            ))}
          </select>
        </div>
      </label>

      <div className="form-actions span-2" style={{ marginTop: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
        <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary" disabled={saving}>
          {saving ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
  const { roomCommands } = useHotel();
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({
    name: category?.name || '',
    code: category?.code || '',
    capacity: category?.capacity || 2,
    baseNightlyRate: category?.baseNightlyRate || '100.00',
  });
  const [saving, setSaving] = useState(false);

  // Amenities
  const [masterAmenities, setMasterAmenities] = useState([]);
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
          setMasterAmenities(res.master || []);
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
    <form className="form-grid" onSubmit={submit} style={{ gap: '16px' }}>
      {/* TABS DE CATEGORÍA */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: '10px', gridColumn: 'span 2' }}>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'details' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('details')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Bed size={14} /> Datos y Tarifa
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'amenities' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('amenities')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Sparkles size={14} /> Amenities ({selectedAmenities.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${tab === 'audit' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setTab('audit')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '700' }}>
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
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '700' }}>
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
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '700' }}>
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
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: '700' }}>
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
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
            Selecciona las amenidades y servicios de lujo incluidos para todas las habitaciones de categoría <strong>{category.name}</strong>. Se reflejarán instantáneamente en la recepción y en el portal de clientes.
          </div>

          {loadingAmenities ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>
              <RefreshCw size={16} className="spin" /> Cargando catálogo de comodidades…
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '10px',
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '4px'
            }}>
              {Object.entries(MASTER_AMENITY_LABELS).map(([key, info]) => {
                const isChecked = selectedAmenities.includes(key);
                return (
                  <div
                    key={key}
                    onClick={() => toggleAmenity(key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: isChecked ? '1.5px solid var(--color-gold, #d97706)' : '1px solid var(--color-border)',
                      background: isChecked ? 'rgba(217, 119, 6, 0.08)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '5px',
                      border: isChecked ? 'none' : '1.5px solid var(--color-border)',
                      background: isChecked ? 'var(--color-gold, #d97706)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '12px',
                      flexShrink: 0,
                    }}>
                      {isChecked && <Check size={14} strokeWidth={3} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: isChecked ? '700' : '500', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {info.icon} {info.label}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
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
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-muted)', marginBottom: '4px' }}>
            Historial de cambios de tarifa, capacidad y comodidades registrados en la base de datos de auditoría.
          </div>
          {loadingAudit ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)' }}>
              <RefreshCw size={16} className="spin" /> Cargando historial de auditoría…
            </div>
          ) : auditLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-muted)', background: 'var(--color-surface-soft)', borderRadius: '8px' }}>
              No hay modificaciones registradas aún para esta categoría.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditLogs.map((log) => (
                <div key={log.id} style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface-soft)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span className={`badge ${log.eventType.includes('amenities') ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: '11px' }}>
                      {log.eventType === 'room_category.updated' ? 'Tarifa / Parámetros' : log.eventType === 'room_category_amenities.updated' ? 'Amenities 5★' : log.eventType}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {new Date(log.occurredAt).toLocaleString('es-PE')}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-muted)', marginBottom: '4px' }}>
                    Modificado por: <strong style={{ color: 'var(--color-text)' }}>{log.actorEmail}</strong>
                  </div>
                  {log.metadata?.changes && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {Object.entries(log.metadata.changes).map(([k, v]) => (
                        <span key={k} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(217,119,6,0.12)', color: '#b45309', fontWeight: '600' }}>
                          {k === 'baseNightlyRate' ? `Nueva tarifa: S/ ${v}` : `${k}: ${v}`}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.metadata?.amenitiesCount !== undefined && (
                    <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginTop: '4px' }}>
                      Comodidades asignadas: <strong>{log.metadata.amenitiesCount}</strong> items ({log.metadata.amenityKeys?.slice(0, 3).join(', ')}...)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="form-actions span-2" style={{ marginTop: '12px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
        <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>
          {tab === 'audit' ? 'Cerrar' : 'Cancelar'}
        </button>
        {tab !== 'audit' && (
          <button className="btn btn-primary" disabled={saving}>
            {saving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
    <form className="form-grid" onSubmit={submit} style={{ gap: '16px' }}>
      <div className={`alert-banner ${operation.blocked ? 'alert-banner-warning' : 'alert-banner-info'} span-2`}>
        {operation.blocked ? '🔒 Bloqueo Operativo:' : '🔓 Desbloqueo Operativo:'} {operation.blocked ? 'La habitación no podrá recibir nuevas asignaciones de reserva hasta su desbloqueo.' : 'La habitación pasará a estar disponible para asignación inmediata.'}
      </div>
      <label className="span-2">
        <span style={{ fontWeight: '700', marginBottom: '6px' }}>Motivo del {operation.blocked ? 'bloqueo' : 'desbloqueo'}</span>
        <textarea
          required
          maxLength="500"
          placeholder="Ej: Mantenimiento preventivo de aire acondicionado / Pintura y acabados"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          style={{ minHeight: '90px' }}
        />
      </label>
      <div className="form-actions span-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
        <button type="button" className="btn btn-outline" disabled={saving} onClick={onClose}>Cancelar</button>
        <button className={operation.blocked ? 'btn btn-danger' : 'btn btn-primary'} disabled={saving || !reason.trim()}>
          {saving ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="tabs">
            <button
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
              title="Vista de Tabla"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <List size={16} /> Lista
            </button>
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Mapa de Habitaciones por Piso"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LayoutGrid size={16} /> Mapa de Piso
            </button>
            <button
              className={viewMode === 'categories' ? 'active' : ''}
              onClick={() => setViewMode('categories')}
              title="Gestión de Categorías y Tarifas"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
                <tr key={room.id} style={{
                  backgroundColor: isLive ? 'rgba(217, 119, 6, 0.12)' : undefined,
                  transition: 'background-color 0.4s ease',
                }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'var(--color-navy)',
                        color: 'var(--color-gold)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '14px',
                        border: isLive ? '2px solid var(--color-gold)' : '1px solid var(--color-gold-soft)',
                        boxShadow: isLive ? '0 0 10px rgba(217, 119, 6, 0.4)' : 'var(--shadow-sm)',
                      }}>
                        {room.number}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>Habitación {room.number}</strong>
                          {isLive && <span className="badge badge-green" style={{ fontSize: '10px' }}>En vivo</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Piso {room.floor}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: '6px', background: 'var(--color-surface-soft)', fontSize: '12px', fontWeight: '600', color: 'var(--color-muted)' }}>
                      Piso {room.floor}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {getCategoryIcon(room.category)} {room.category}
                    </span>
                  </td>
                  <td>👥 {room.capacity} pers.</td>
                  <td><strong>{displayRate(room.nightlyRate)}</strong> <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>/ noche</span></td>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {Object.entries(roomsByFloor).map(([floorLabel, floorRooms]) => (
            <div key={floorLabel} className="card" style={{ padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', paddingBottom: '8px' }}>
                🏢 {floorLabel} ({floorRooms.length} habitaciones)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                {floorRooms.map((room) => {
                  const isLive = room.id === liveUpdatedRoomId;
                  return (
                  <div
                    key={room.id}
                    style={{
                      border: isLive ? '2px solid var(--color-gold, #d97706)' : '1px solid var(--color-border)',
                      borderRadius: '10px',
                      padding: '14px',
                      background: 'var(--color-surface)',
                      boxShadow: isLive ? '0 0 20px rgba(217, 119, 6, 0.45)' : 'var(--shadow-sm)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isLive ? 'scale(1.02)' : 'none',
                      position: 'relative',
                    }}
                  >
                    {isLive && (
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '12px',
                        background: 'linear-gradient(135deg, #d97706, #b45309)',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        zIndex: 2,
                      }}>
                        ✨ Actualizado en vivo
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>{getCategoryIcon(room.category)}</span>
                        <strong style={{ fontSize: '16px', color: 'var(--color-text)' }}>Hab. {room.number}</strong>
                      </div>
                      <StatusBadge>{room.status}</StatusBadge>
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--color-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{room.category}</span>
                      <span>👥 Cap: {room.capacity}</span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text)', borderTop: '1px dashed var(--color-border)', paddingTop: '8px', marginTop: '2px' }}>
                      {displayRate(room.nightlyRate)} <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--color-muted)' }}>/ noche</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', borderTop: '1px solid var(--color-border)', paddingTop: '10px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontWeight: '600' }}>Acciones:</span>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'var(--color-navy)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          boxShadow: 'var(--shadow-sm)',
                        }}>
                          {getCategoryIcon(cat.name)}
                        </div>
                        <div>
                          <strong style={{ fontSize: '15px', color: 'var(--color-text)' }}>{cat.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Estándar Park Plaza 5★</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', background: 'var(--color-surface-soft)', fontSize: '12px', border: '1px solid var(--color-border)' }}>
                        {cat.code}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>
                        👥 Hasta {cat.capacity} huésped(es)
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <strong style={{ fontSize: '16px', color: 'var(--color-navy)' }}>
                          {displayRate(cat.baseNightlyRate)}
                        </strong>
                        <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>/ noche base</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-blue">
                        {roomCount} {roomCount === 1 ? 'habitación' : 'habitaciones'}
                      </span>
                    </td>
                    <td>
                      {can(PERMISSIONS.roomsUpdate) ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              setCategoryInitialTab('details');
                              setEditingCategory(cat);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
                          >
                            <Edit size={13} /> Tarifa
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              setCategoryInitialTab('amenities');
                              setEditingCategory(cat);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
                          >
                            <Sparkles size={13} color="var(--color-gold)" /> Amenities ({amenitiesMap[cat.id]?.length || 0})
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => {
                              setCategoryInitialTab('audit');
                              setEditingCategory(cat);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}
                          >
                            <Clock size={13} /> Historial
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Solo lectura</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Estado Operativo:</span>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div className="drawer-section-title" style={{ margin: 0 }}>
                  <Sparkles size={16} color="var(--color-gold)" /> Comodidades y Servicios 5★
                </div>
                {can(PERMISSIONS.roomsUpdate) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: '11px', padding: '3px 8px' }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-muted)' }}>
                  <span>Fecha de Registro:</span>
                  <strong style={{ color: 'var(--color-text)' }}>{new Date(selected.createdAt).toLocaleString('es-PE')}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-muted)' }}>
                  <span>Identificador Interno:</span>
                  <strong style={{ color: 'var(--color-text)', fontFamily: 'monospace' }}>HAB-{selected.id.slice(0, 8)}</strong>
                </div>
              </div>
            </div>

            {/* ACCIONES RÁPIDAS */}
            <div className="drawer-actions-stack">
              {can(PERMISSIONS.roomsUpdate) ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ width: '100%', justifyContent: 'center' }}
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
                    className="btn btn-outline"
                    style={{ width: '100%', justifyContent: 'center' }}
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
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center' }}
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
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
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
