import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { CalendarSearch, CheckCircle, Eye, Plus, Search, Sparkles, UserPlus } from 'lucide-react';
import { usePermissions } from '../../../auth/authContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { useCollectionTable } from '../../../hooks/useCollectionTable';
import { buildGuestCreateDto } from '../../../guests/guestModel';
import { formatReservationInstant, formatReservationMoney, RESERVATION_STATUS_LABELS, reservationOperationalStatusToLabel, reservationStatusToLabel } from '../../../reservations/reservationModel';
import { useHotel } from '../../../state/hotelContext';
import { Pagination, SortableHeader } from '../../ui/CollectionTable';
import { Dialog, Drawer } from '../../ui/Overlay';
import { DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';

const EMPTY_FORM = Object.freeze({ checkInAt: '', checkOutAt: '', guestCount: '1', primaryGuestId: '', roomId: '' });
const localInputToUtc = (value) => value ? new Date(value).toISOString() : '';

const EXTRA_SERVICES = [
  { id: 'breakfast', name: 'Desayuno Buffet Ejecutivo', icon: '🥐', price: 35, type: 'per_night', desc: 'Acceso diario al restaurante gourmet' },
  { id: 'parking', name: 'Estacionamiento Privado Techado', icon: '🚗', price: 25, type: 'per_night', desc: 'Espacio exclusivo con seguridad 24/7' },
  { id: 'late_checkout', name: 'Late Check-out (hasta 17:00)', icon: '⏰', price: 60, type: 'fixed', desc: 'Salida extendida garantizada' },
  { id: 'extra_bed', name: 'Cama Supletoria Adicional', icon: '🛏️', price: 50, type: 'per_night', desc: 'Incluye lencería y almohadas 5★' },
];

function QuickGuestModal({ open, onClose, onCreated, notify }) {
  const { guestCommands } = useHotel();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    documentType: 'dni',
    documentNumber: '',
    phone: '',
    email: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const dto = buildGuestCreateDto({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        email: form.email || undefined,
        primaryDocument: {
          type: form.documentType,
          documentNumber: form.documentNumber,
          issuingCountry: form.documentType === 'dni' || form.documentType === 'foreign_id' ? 'PE' : 'PE',
        },
      });
      const created = await guestCommands.create(dto);
      notify('Huésped Registrado', `${created.name} fue registrado y seleccionado.`, 'success');
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err.message || 'No se pudo registrar el huésped.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Nuevo Huésped Rápido" description="Registre un cliente para seleccionarlo de inmediato en la reserva.">
      <form className="form-grid" onSubmit={submit} style={{ gap: '12px' }}>
        <label>Tipo de Documento
          <select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
            <option value="dni">DNI (Perú)</option>
            <option value="passport">Pasaporte</option>
            <option value="foreign_id">Carnet de Extranjería</option>
            <option value="other">Otro</option>
          </select>
        </label>

        <label>Número de Documento
          <input required placeholder="Ej: 71909099" value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} />
        </label>

        <label>Nombres
          <input required placeholder="Ej: Roy" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </label>

        <label>Apellidos
          <input required placeholder="Ej: Dariva" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </label>

        <label>Teléfono (Opcional)
          <input type="tel" placeholder="Ej: +51 987654321" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>

        <label>Correo Electrónico (Opcional)
          <input type="email" placeholder="cliente@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>

        {error ? <div className="alert-banner alert-banner-danger span-2" role="alert">{error}</div> : null}

        <div className="form-actions span-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginTop: '6px' }}>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Guardando...' : 'Guardar y Seleccionar'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function getCategoryStyle(categoryName = '') {
  const name = categoryName.toLowerCase();
  if (name.includes('suite')) return { icon: '👑', badgeBg: 'rgba(139, 92, 246, 0.12)', badgeColor: '#7c3aed', border: 'rgba(139, 92, 246, 0.25)' };
  if (name.includes('matrimonial')) return { icon: '👩‍❤️‍👨', badgeBg: 'rgba(244, 63, 94, 0.12)', badgeColor: '#e11d48', border: 'rgba(244, 63, 94, 0.25)' };
  if (name.includes('doble')) return { icon: '🛏️🛏️', badgeBg: 'rgba(14, 165, 233, 0.12)', badgeColor: '#0284c7', border: 'rgba(14, 165, 233, 0.25)' };
  if (name.includes('triple')) return { icon: '🛌🛌', badgeBg: 'rgba(245, 158, 11, 0.12)', badgeColor: '#d97706', border: 'rgba(245, 158, 11, 0.25)' };
  return { icon: '🛏️', badgeBg: 'rgba(100, 116, 139, 0.12)', badgeColor: '#475569', border: 'rgba(100, 116, 139, 0.25)' };
}

function calculateStayNights(checkInAt, checkOutAt) {
  if (!checkInAt || !checkOutAt) return null;
  const start = new Date(checkInAt);
  const end = new Date(checkOutAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  const diffHours = (end - start) / (1000 * 60 * 60);
  const nights = Math.max(1, Math.round(diffHours / 24));
  return { nights, hours: diffHours.toFixed(1) };
}

function ReservationForm({ onClose, notify }) {
  const { state, reservationCommands } = useHotel();
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [floorFilter, setFloorFilter] = useState('ALL');
  const [activePreset, setActivePreset] = useState(null);
  const [quickGuestOpen, setQuickGuestOpen] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState(new Set());
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      reservationCommands.clearAvailability();
    };
  }, [reservationCommands]);

  const availability = state.reservationAvailability;
  const categoryById = new Map(state.roomCategories.map((category) => [category.id, category]));
  const activeGuests = state.clients.filter((guest) => guest.status !== 'Archivado');
  const selectedRoom = availability?.rooms.find((room) => room.roomId === form.roomId);
  const selectedGuest = activeGuests.find((g) => g.id === form.primaryGuestId);
  const busy = ['saving', 'reconciling'].includes(state.reservationCreateRequest.status);
  const loadingAvailability = state.reservationAvailabilityRequest.status === 'loading';
  const retryBlocked = state.reservationCreateRequest.retryBlocked;
  const availabilityInput = { checkInAt: localInputToUtc(form.checkInAt), checkOutAt: localInputToUtc(form.checkOutAt), guestCount: form.guestCount };
  const stayMetrics = calculateStayNights(form.checkInAt, form.checkOutAt);
  const nightsCount = stayMetrics?.nights || 1;

  const toggleExtra = (id) => {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const extrasCost = Array.from(selectedExtras).reduce((sum, id) => {
    const s = EXTRA_SERVICES.find((item) => item.id === id);
    if (!s) return sum;
    return sum + (s.type === 'per_night' ? s.price * nightsCount : s.price);
  }, 0);

  const roomCost = selectedRoom ? Number(selectedRoom.totalAmount) : 0;
  const grandTotal = roomCost + extrasCost;

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value, ...(field === 'primaryGuestId' ? {} : { roomId: '' }) }));
    setFormError('');
    if (field !== 'primaryGuestId') {
      setActivePreset(null);
      reservationCommands.clearAvailability();
    }
  };

  const applyPreset = (nights) => {
    const now = new Date();
    const checkIn = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0);
    const checkOut = new Date(now.getFullYear(), now.getMonth(), now.getDate() + nights, 12, 0, 0);

    const pad = (n) => String(n).padStart(2, '0');
    const checkInStr = `${checkIn.getFullYear()}-${pad(checkIn.getMonth() + 1)}-${pad(checkIn.getDate())}T15:00`;
    const checkOutStr = `${checkOut.getFullYear()}-${pad(checkOut.getMonth() + 1)}-${pad(checkOut.getDate())}T12:00`;

    setActivePreset(nights);
    setForm((current) => ({ ...current, checkInAt: checkInStr, checkOutAt: checkOutStr, roomId: '' }));
    setFormError('');
    reservationCommands.clearAvailability();
  };

  const consultAvailability = async () => {
    setFormError('');
    try {
      await reservationCommands.availability(availabilityInput);
    } catch {
      // Error manejado en state.reservationAvailabilityRequest
    }
  };

  const refreshForRetry = async () => {
    setFormError('');
    try {
      await reservationCommands.refreshForRetry(availabilityInput);
    } catch (error) {
      if (activeRef.current) setFormError(error.message || 'No se pudieron actualizar los datos.');
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || retryBlocked || !selectedRoom) return;
    setFormError('');
    try {
      const created = await reservationCommands.create({
        roomId: form.roomId,
        primaryGuestId: form.primaryGuestId,
        checkInAt: localInputToUtc(form.checkInAt),
        checkOutAt: localInputToUtc(form.checkOutAt),
        guestCount: form.guestCount,
      });
      if (!activeRef.current || !created) return;
      notify('Reserva registrada', 'La reserva pendiente fue confirmada por el servidor.', 'success');
      onClose();
    } catch (error) {
      if (activeRef.current) setFormError(error.message || 'No se pudo registrar la reserva.');
    }
  };

  const availableRooms = availability?.rooms || [];
  const uniqueCategories = Array.from(new Set(availableRooms.map((r) => r.categoryId)))
    .map((id) => ({ id, name: categoryById.get(id)?.name || 'Otra', count: availableRooms.filter((r) => r.categoryId === id).length }));
  const uniqueFloors = Array.from(new Set(availableRooms.map((r) => r.floor))).sort((a, b) => a - b);

  const displayedRooms = availableRooms.filter((room) => {
    const matchCat = categoryFilter === 'ALL' || room.categoryId === categoryFilter;
    const matchFloor = floorFilter === 'ALL' || room.floor === Number(floorFilter);
    return matchCat && matchFloor;
  });

  return (
    <>
      <QuickGuestModal
        open={quickGuestOpen}
        onClose={() => setQuickGuestOpen(false)}
        notify={notify}
        onCreated={(guest) => {
          setForm((current) => ({ ...current, primaryGuestId: guest.id }));
        }}
      />

      <form className="form-grid" onSubmit={submit} style={{ gap: '16px' }}>
        <div className="alert-banner alert-banner-info span-2" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', border: '1px solid #bae6fd' }}>
          <span style={{ fontSize: '15px' }}>ℹ️</span>
          <div style={{ fontSize: '13px', color: '#0369a1' }}>
            Seleccione fechas y huéspedes para cotizar disponibilidad de inventario, amenidades y servicios adicionales en tiempo real.
          </div>
        </div>

        <div className="span-2" style={{ background: 'var(--color-surface-soft)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--color-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Atajos rápidos:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { nights: 1, label: 'Hoy (1 Noche)' },
                { nights: 2, label: '2 Noches' },
                { nights: 3, label: 'Fin de Semana (3 Noches)' },
                { nights: 5, label: '5 Noches' },
              ].map((p) => {
                const isActive = activePreset === p.nights;
                return (
                  <button
                    key={p.nights}
                    type="button"
                    onClick={() => applyPreset(p.nights)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: isActive ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
                      background: isActive ? 'var(--color-navy)' : '#fff',
                      color: isActive ? '#fff' : 'var(--color-text)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? '0 2px 8px rgba(15,23,42,0.18)' : 'var(--shadow-sm)',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {stayMetrics ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--color-gold-soft)', border: '1px solid var(--color-gold)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', color: 'var(--color-navy-deep)', fontWeight: '700' }}>
              <span>🌙 {stayMetrics.nights} {stayMetrics.nights === 1 ? 'Noche' : 'Noches'}</span>
              <span style={{ color: 'var(--color-muted)', fontWeight: '400' }}>({stayMetrics.hours} hrs)</span>
            </div>
          ) : null}
        </div>

        <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
          <span>📅 Ingreso (Check-in)</span>
          <input required type="datetime-local" step="1800" value={form.checkInAt} onChange={(event) => change('checkInAt', event.target.value)} />
        </label>

        <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
          <span>📅 Salida (Check-out)</span>
          <input required type="datetime-local" step="1800" value={form.checkOutAt} onChange={(event) => change('checkOutAt', event.target.value)} />
        </label>

        <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
          <span>👥 Cantidad de Huéspedes</span>
          <input required min="1" step="1" type="number" value={form.guestCount} onChange={(event) => change('guestCount', event.target.value)} />
        </label>

        <label style={{ fontWeight: '600', color: 'var(--color-navy-soft)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
            <span>👤 Huésped Principal</span>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setQuickGuestOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: '700', borderRadius: '12px', borderColor: 'var(--color-gold)', color: 'var(--color-gold)', background: '#fff' }}
            >
              <UserPlus size={13} /> + Nuevo Huésped
            </button>
          </div>
          <select required value={form.primaryGuestId} onChange={(event) => change('primaryGuestId', event.target.value)}>
            <option value="">Seleccione un huésped activo</option>
            {activeGuests.map((guest) => (
              <option key={guest.id} value={guest.id}>
                {guest.name} · {guest.documentType.toUpperCase()} {guest.documentNumber}
              </option>
            ))}
          </select>
        </label>

        <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{
              padding: '10px 24px',
              fontSize: '13px',
              fontWeight: '700',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #ffffff, #f8fafc)',
              border: '1.5px solid var(--color-gold)',
              color: 'var(--color-navy)',
            }}
            disabled={loadingAvailability || busy || !form.checkInAt || !form.checkOutAt || !form.guestCount}
            onClick={consultAvailability}
          >
            <CalendarSearch size={16} aria-hidden="true" style={{ marginRight: '8px' }} />
            {loadingAvailability ? 'Consultando disponibilidad en vivo…' : 'Consultar Disponibilidad de Habitaciones'}
          </button>
        </div>

        {state.reservationAvailabilityRequest.status === 'error' ? (
          <div className="alert-banner alert-banner-danger span-2" role="alert">{state.reservationAvailabilityRequest.error}</div>
        ) : null}

        {availability && !availability.rooms.length ? (
          <div className="alert-banner alert-banner-warning span-2" role="status" style={{ borderRadius: '14px', padding: '16px' }}>
            ⚠️ No hay habitaciones disponibles para {availability.guestCount} huésped(es) en el rango de fechas seleccionado.
          </div>
        ) : null}

        {availableRooms.length ? (
          <div className="span-2" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px', background: 'var(--color-bg)', padding: '16px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--color-navy-deep)' }}>
                  Habitaciones Disponibles
                </span>
                <span style={{ fontSize: '11px', fontWeight: '700', background: 'var(--color-gold-soft)', color: 'var(--color-gold)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--color-gold)' }}>
                  {displayedRooms.length} de {availableRooms.length}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-muted)' }}>Piso:</span>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: '#fff' }}
                >
                  <option value="ALL">Todos los pisos</option>
                  {uniqueFloors.map((fl) => (
                    <option key={fl} value={fl}>Piso {fl}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setCategoryFilter('ALL')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  border: categoryFilter === 'ALL' ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
                  background: categoryFilter === 'ALL' ? 'var(--color-gold)' : '#fff',
                  color: categoryFilter === 'ALL' ? '#fff' : 'var(--color-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Todas ({availableRooms.length})
              </button>
              {uniqueCategories.map((cat) => {
                const isSelected = categoryFilter === cat.id;
                const catStyle = getCategoryStyle(cat.name);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '11.5px',
                      fontWeight: '700',
                      border: isSelected ? `1.5px solid ${catStyle.badgeColor}` : '1px solid var(--color-border)',
                      background: isSelected ? catStyle.badgeBg : '#fff',
                      color: isSelected ? catStyle.badgeColor : 'var(--color-text)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {catStyle.icon} {cat.name} ({cat.count})
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
              {displayedRooms.map((room) => {
                const isSelected = form.roomId === room.roomId;
                const catName = categoryById.get(room.categoryId)?.name || 'Categoría';
                const catStyle = getCategoryStyle(catName);

                return (
                  <div
                    key={room.roomId}
                    onClick={() => setForm((current) => ({ ...current, roomId: room.roomId }))}
                    style={{
                      border: isSelected ? '2px solid var(--color-gold)' : '1px solid var(--color-border)',
                      borderRadius: '14px',
                      padding: '14px',
                      background: isSelected ? 'linear-gradient(135deg, rgba(197, 157, 95, 0.1), #ffffff)' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: isSelected ? '0 6px 20px rgba(197, 157, 95, 0.2)' : '0 2px 6px rgba(0,0,0,0.02)',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '16px' }}>{catStyle.icon}</span>
                        <strong style={{ fontSize: '15px', fontWeight: '800', color: 'var(--color-navy-deep)' }}>Hab. {room.number}</strong>
                      </div>
                      {isSelected ? (
                        <span style={{ background: 'var(--color-gold)', color: '#fff', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', fontWeight: '800' }}>
                          ✓ ELEGIDA
                        </span>
                      ) : (
                        <span style={{ fontSize: '10.5px', color: 'var(--color-muted)', fontWeight: '600' }}>
                          Piso {room.floor}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', background: catStyle.badgeBg, color: catStyle.badgeColor, padding: '2px 6px', borderRadius: '6px', fontWeight: '700' }}>
                        {catName}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                        👥 Cap: {room.capacity}
                      </span>
                    </div>

                    <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{formatReservationMoney(room.nightlyRate)} /n</span>
                      <strong style={{ fontSize: '13.5px', color: '#059669', fontWeight: '800' }}>Total: {formatReservationMoney(room.totalAmount)}</strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {selectedRoom ? (
          <div className="span-2" style={{ background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>✨</span>
                <div>
                  <strong style={{ fontSize: '13.5px', color: 'var(--color-navy-deep)' }}>Servicios Adicionales y Amenidades</strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-muted)' }}>Añada servicios opcionales a la cotización de la estadía</div>
                </div>
              </div>
              {selectedExtras.size > 0 ? (
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: '8px' }}>
                  +{selectedExtras.size} servicio(s) · S/ {extrasCost.toFixed(2)}
                </span>
              ) : null}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {EXTRA_SERVICES.map((s) => {
                const checked = selectedExtras.has(s.id);
                const itemPrice = s.type === 'per_night' ? s.price * nightsCount : s.price;
                return (
                  <label
                    key={s.id}
                    onClick={() => toggleExtra(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px',
                      borderRadius: '12px',
                      border: checked ? '1.5px solid var(--color-gold)' : '1px solid var(--color-border)',
                      background: checked ? 'var(--color-gold-soft)' : '#f8fafc',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {}} 
                      style={{ marginTop: '2px' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--color-text)' }}>
                          {s.icon} {s.name}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--color-muted)', margin: '2px 0 4px' }}>
                        {s.desc}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '800', color: checked ? '#059669' : 'var(--color-navy)' }}>
                        +S/ {itemPrice.toFixed(2)} {s.type === 'per_night' ? `(S/ ${s.price}/noche)` : '(fijo)'}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ) : null}

        {selectedRoom ? (
          <div className="span-2" style={{ background: 'linear-gradient(135deg, var(--color-navy), var(--color-navy-deep))', color: '#fff', borderRadius: '16px', padding: '18px 20px', boxShadow: '0 10px 30px rgba(15,23,42,0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.12)', paddingBottom: '10px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '24px' }}>{getCategoryStyle(categoryById.get(selectedRoom.categoryId)?.name).icon}</span>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Cotización Confirmada</div>
                  <strong style={{ fontSize: '16px', color: '#fff' }}>Habitación {selectedRoom.number} · {categoryById.get(selectedRoom.categoryId)?.name} (Piso {selectedRoom.floor})</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Total Liquidación</div>
                <strong style={{ fontSize: '22px', color: '#34d399', fontWeight: '900' }}>S/ {grandTotal.toFixed(2)}</strong>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', fontSize: '12px', marginBottom: selectedExtras.size > 0 ? '12px' : 0 }}>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '10.5px' }}>Huésped Asignado</span>
                <strong style={{ color: '#fff' }}>{selectedGuest ? selectedGuest.name : 'Pendiente'}</strong>
              </div>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '10.5px' }}>Duración Calculada</span>
                <strong style={{ color: '#fff' }}>{stayMetrics ? `${stayMetrics.nights} noches (${stayMetrics.hours}h)` : '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '10.5px' }}>Tarifa Habitación</span>
                <strong style={{ color: '#fff' }}>{formatReservationMoney(selectedRoom.totalAmount)}</strong>
              </div>
              <div>
                <span style={{ color: 'rgba(255,255,255,0.6)', display: 'block', fontSize: '10.5px' }}>Servicios Extras</span>
                <strong style={{ color: selectedExtras.size > 0 ? '#34d399' : '#fff' }}>+S/ {extrasCost.toFixed(2)}</strong>
              </div>
            </div>

            {selectedExtras.size > 0 ? (
              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: '8px', fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ color: 'var(--color-gold)', fontWeight: '700' }}>Incluye adicionales:</span>
                {Array.from(selectedExtras).map((id) => {
                  const s = EXTRA_SERVICES.find((item) => item.id === id);
                  return (
                    <span key={id} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                      {s?.icon} {s?.name}
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {state.reservationCreateRequest.status === 'reconciling' ? (
          <div className="alert-banner alert-banner-warning span-2" role="status">
            La respuesta no fue concluyente. Se están recargando las reservas y la disponibilidad antes de habilitar otro intento.
          </div>
        ) : null}

        {retryBlocked ? (
          <div className="alert-banner alert-banner-danger span-2" role="alert">
            <span>{state.reservationCreateRequest.error}</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={refreshForRetry}>Actualizar datos</button>
          </div>
        ) : null}

        {formError && !retryBlocked ? (
          <div className="alert-banner alert-banner-danger span-2" role="alert">{formError}</div>
        ) : null}

        <div className="form-actions span-2" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose} style={{ padding: '10px 20px', borderRadius: '12px' }}>
            Cancelar
          </button>

          <button
            className="btn btn-primary"
            style={{
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: '700',
              borderRadius: '12px',
              background: !selectedRoom || !form.primaryGuestId ? undefined : 'linear-gradient(135deg, var(--color-navy), var(--color-navy-deep))',
              boxShadow: selectedRoom && form.primaryGuestId ? '0 4px 14px rgba(15,23,42,0.3)' : undefined,
            }}
            disabled={busy || retryBlocked || !selectedRoom || !form.primaryGuestId}
          >
            {busy ? 'Confirmando reserva…' : selectedRoom ? `Registrar Reserva · S/ ${grandTotal.toFixed(2)}` : 'Seleccione una habitación para continuar'}
          </button>
        </div>
      </form>
    </>
  );
}

export default function ReservationsView({ notify, navigationIntent, consumeNavigationIntent }) {
  const { canAll } = usePermissions();
  const { state, reservationCommands } = useHotel();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null);
  const [lifecycle, setLifecycle] = useState({ reason: '', disposition: 'no_show', error: '', busy: false, feedback: '' });
  const deferred = useDeferredValue(query.toLowerCase());

  const canCreate = canAll(PERMISSIONS.reservationsCreate, PERMISSIONS.roomsRead, PERMISSIONS.guestsRead);

  useEffect(() => {
    if (!navigationIntent) return;
    if (navigationIntent.type === 'select-record') setSelectedId(navigationIntent.recordId);
    consumeNavigationIntent(navigationIntent.id);
  }, [navigationIntent, consumeNavigationIntent]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return undefined; }
    let active = true;
    reservationCommands.detail(selectedId).then((value) => { if (active) setDetail(value); }).catch((error) => { if (active) setLifecycle((current) => ({ ...current, error: error.message })); });
    return () => { active = false; };
  }, [reservationCommands, selectedId]);

  const guestsById = new Map(state.clients.map((guest) => [guest.id, guest]));
  const roomsById = new Map(state.rooms.map((room) => [room.id, room]));

  const records = state.persistentReservations.map((reservation) => {
    const guest = guestsById.get(reservation.primaryGuestId);
    const room = roomsById.get(reservation.roomId);
    return {
      ...reservation,
      guestName: guest?.name || 'Huésped no disponible',
      roomReference: room ? `Habitación ${room.number}` : 'Habitación no disponible',
      statusLabel: reservationStatusToLabel(reservation.status),
    };
  }).filter((reservation) => `${reservation.id} ${reservation.guestName} ${reservation.roomReference}`.toLowerCase().includes(deferred) && (status === 'Todos' || reservation.status === status));

  const table = useCollectionTable(records, 'checkInAt', 8, JSON.stringify([deferred, status, records.map((item) => item.id)]));
  const selected = records.find((item) => item.id === selectedId) || state.persistentReservations.find((item) => item.id === selectedId);

  const columns = [{ key: 'id', label: 'Reserva' }, { key: 'guestName', label: 'Huésped' }, { key: 'roomReference', label: 'Habitación' }, { key: 'checkInAt', label: 'Estadía' }, { key: 'totalAmount', label: 'Total' }, { key: 'statusLabel', label: 'Estado' }];
  const loadingWithoutData = state.reservationRequest.status === 'loading' && state.persistentReservations.length === 0;

  const retry = () => reservationCommands.reload().catch((error) => notify('No se pudieron cargar las reservas', error.message, 'error'));
  const runLifecycle = async (operation) => {
    setLifecycle((current) => ({ ...current, error: '', feedback: '', busy: true }));
    try {
      const result = await reservationCommands.lifecycle(selectedId, operation, operation === 'confirm' ? {} : operation === 'cancel' ? { reason: lifecycle.reason } : { reason: lifecycle.reason, disposition: lifecycle.disposition });
      setDetail(result.reservation);
      setLifecycle((current) => ({ ...current, busy: false, feedback: result.replayed ? 'La operación anterior fue recuperada sin duplicarla.' : 'La reserva fue actualizada por el servidor.' }));
    } catch (error) { setLifecycle((current) => ({ ...current, busy: false, error: error.message })); }
  };

  return <div className="view-container">
    <PageHeader metadata={`${state.persistentReservations.length} Reservas Confirmadas`} title="Reservas de Habitación" description="Cotización de tarifas, disponibilidad por intervalo e ingreso de reservas de huéspedes." action={canCreate ? <button className="btn btn-primary" onClick={() => setCreating(true)}>Nueva reserva</button> : null} />
    <MetricStrip items={[{ label: 'Total', value: state.persistentReservations.length }, { label: 'Pendientes', value: state.persistentReservations.filter((item) => item.status === 'pending').length }, { label: 'Confirmadas', value: state.persistentReservations.filter((item) => item.status === 'confirmed').length }, { label: 'Presentes', value: state.persistentReservations.filter((item) => item.status === 'checked_in').length }]} />
    {loadingWithoutData ? <div className="alert-banner alert-banner-info" role="status">Cargando reservas persistentes…</div> : null}
    {state.reservationRequest.status === 'error' ? <div className="alert-banner alert-banner-danger" role="alert"><span>{state.reservationRequest.error}</span> <button className="btn btn-sm btn-outline" onClick={retry}>Reintentar</button></div> : null}
    <div className="filter-bar"><label className="search-label"><Search size={16} /><input aria-label="Buscar reservas" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código, huésped o habitación..." disabled={loadingWithoutData} /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="Todos">Todos</option>{Object.entries(RESERVATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span className="filter-result">{records.length} reservas</span></div>
    {!loadingWithoutData && table.total ? <section className="card table-container"><table className="custom-table"><caption>Reservas registradas en el servidor</caption><thead><tr>{columns.map((column) => <SortableHeader key={column.key} column={column} sort={table.sort} onSort={table.toggleSort} />)}<th scope="col">Acciones</th></tr></thead><tbody>{table.visible.map((item) => <tr key={item.id}><td><strong>{item.id.slice(0, 8)}</strong></td><td>{item.guestName}</td><td>{item.roomReference}</td><td>{formatReservationInstant(item.checkInAt)}<br /><small>hasta {formatReservationInstant(item.checkOutAt)}</small></td><td>{formatReservationMoney(item.totalAmount)}<br /><small>{formatReservationMoney(item.nightlyRate)} por noche</small></td><td><StatusBadge>{item.statusLabel}</StatusBadge></td><td><div className="quick-actions-row"><button type="button" className="quick-action-btn btn-action-view" data-tooltip="Ver detalle de reserva" aria-label={`Ver reserva ${item.id.slice(0, 8)}`} onClick={() => setSelectedId(item.id)}><Eye size={15} /></button></div></td></tr>)}</tbody></table><Pagination {...table} onPage={table.setPage} /></section> : null}
    {!loadingWithoutData && state.reservationRequest.status === 'success' && !table.total ? <EmptyState title={query || status !== 'Todos' ? 'Sin coincidencias' : 'Sin reservas registradas'} description={query || status !== 'Todos' ? 'No hay reservas que coincidan con los filtros.' : 'La propiedad todavía no tiene reservas persistentes.'} /> : null}
    <Drawer open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `Reserva #${selected.id.slice(0, 8)}` : 'Reserva'} description={detail ? `${detail.checkIn} a ${detail.checkOut}` : selected ? `${formatReservationInstant(selected.checkInAt)} a ${formatReservationInstant(selected.checkOutAt)}` : ''}>{detail ? <div className="form-grid"><DetailGrid items={[{ label: 'Huésped', value: detail.primaryGuest.name }, { label: 'Habitación', value: `Habitación ${detail.room.number} · Piso ${detail.room.floor}` }, { label: 'Estado', node: <StatusBadge>{reservationStatusToLabel(detail.status)}</StatusBadge> }, { label: 'Ingreso civil', value: detail.checkIn }, { label: 'Salida civil', value: detail.checkOut }, { label: 'Último cambio', value: detail.lifecycle.changedAt ? formatReservationInstant(detail.lifecycle.changedAt) : 'Sin cambios de ciclo' }, { label: 'Motivo', value: detail.lifecycle.reason || '—' }]} />{detail.permittedActions.length ? <><label>Motivo{detail.permittedActions.some((action) => action !== 'confirm') ? <textarea required value={lifecycle.reason} onChange={(event) => setLifecycle((current) => ({ ...current, reason: event.target.value }))} /> : null}</label>{detail.permittedActions.includes('disposition') ? <label>Disposición<select value={lifecycle.disposition} onChange={(event) => setLifecycle((current) => ({ ...current, disposition: event.target.value }))}><option value="no_show">No presentado</option><option value="expired">Vencida</option></select></label> : null}<div className="form-actions">{detail.permittedActions.includes('confirm') ? <button className="btn btn-primary" disabled={lifecycle.busy} onClick={() => runLifecycle('confirm')}>Confirmar</button> : null}{detail.permittedActions.includes('cancel') ? <button className="btn btn-outline" disabled={lifecycle.busy || !lifecycle.reason.trim()} onClick={() => runLifecycle('cancel')}>Cancelar reserva</button> : null}{detail.permittedActions.includes('disposition') ? <button className="btn btn-outline" disabled={lifecycle.busy || !lifecycle.reason.trim()} onClick={() => runLifecycle('disposition')}>Registrar disposición</button> : null}</div></> : <p>El servidor no permite acciones para esta reserva.</p>}{lifecycle.feedback ? <div className="alert-banner alert-banner-info" role="status">{lifecycle.feedback}</div> : null}{lifecycle.error ? <div className="alert-banner alert-banner-danger" role="alert">{lifecycle.error}</div> : null}</div> : selected ? <div role="status">Cargando detalle autorizado…</div> : null}</Drawer>
    <Dialog open={creating && canCreate} onClose={() => setCreating(false)} title="Nueva Reserva de Habitación" description="Cotización de tarifas, selección de fechas e ingreso de la reserva." wide>{creating && canCreate ? <ReservationForm notify={notify} onClose={() => setCreating(false)} /> : null}</Dialog>
  </div>;
}
