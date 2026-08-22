import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { CalendarSearch, CheckCircle, Search } from 'lucide-react';
import { usePermissions } from '../../../auth/authContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { useCollectionTable } from '../../../hooks/useCollectionTable';
import { formatReservationInstant, formatReservationMoney, RESERVATION_STATUS_LABELS, reservationOperationalStatusToLabel, reservationStatusToLabel } from '../../../reservations/reservationModel';
import { useHotel } from '../../../state/hotelContext';
import { Pagination, SortableHeader } from '../../ui/CollectionTable';
import { Dialog, Drawer } from '../../ui/Overlay';
import { DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';

const EMPTY_FORM = Object.freeze({ checkInAt: '', checkOutAt: '', guestCount: '1', primaryGuestId: '', roomId: '' });
const localInputToUtc = (value) => value ? new Date(value).toISOString() : '';

function getCategoryIcon(categoryName = '') {
  const name = categoryName.toLowerCase();
  if (name.includes('suite')) return '👑';
  if (name.includes('matrimonial')) return '👩‍❤️‍👨';
  if (name.includes('doble')) return '🛏️🛏️';
  if (name.includes('triple')) return '🛌🛌';
  return '🛏️';
}

function ReservationForm({ onClose, notify }) {
  const { state, reservationCommands } = useHotel();
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
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
  const busy = ['saving', 'reconciling'].includes(state.reservationCreateRequest.status);
  const loadingAvailability = state.reservationAvailabilityRequest.status === 'loading';
  const retryBlocked = state.reservationCreateRequest.retryBlocked;
  const availabilityInput = { checkInAt: localInputToUtc(form.checkInAt), checkOutAt: localInputToUtc(form.checkOutAt), guestCount: form.guestCount };

  const change = (field, value) => {
    setForm((current) => ({ ...current, [field]: value, ...(field === 'primaryGuestId' ? {} : { roomId: '' }) }));
    setFormError('');
    if (field !== 'primaryGuestId') reservationCommands.clearAvailability();
  };

  const applyPreset = (nights) => {
    const now = new Date();
    const checkIn = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 0, 0);
    const checkOut = new Date(now.getFullYear(), now.getMonth(), now.getDate() + nights, 12, 0, 0);

    const pad = (n) => String(n).padStart(2, '0');
    const checkInStr = `${checkIn.getFullYear()}-${pad(checkIn.getMonth() + 1)}-${pad(checkIn.getDate())}T15:00`;
    const checkOutStr = `${checkOut.getFullYear()}-${pad(checkOut.getMonth() + 1)}-${pad(checkOut.getDate())}T12:00`;

    setForm((current) => ({ ...current, checkInAt: checkInStr, checkOutAt: checkOutStr, roomId: '' }));
    setFormError('');
    reservationCommands.clearAvailability();
  };

  const consultAvailability = async () => {
    setFormError('');
    try {
      await reservationCommands.availability(availabilityInput);
    } catch (error) {
      if (activeRef.current) setFormError(error.message || 'No se pudo consultar la disponibilidad.');
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

  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="alert-banner alert-banner-info span-2">
        ℹ️ Ingrese las fechas de estadía y el número de huéspedes para consultar disponibilidad de habitaciones y tarifas calculadas en tiempo real.
      </div>

      {/* Quick Date Presets */}
      <div className="span-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Atajos de estadía:</span>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => applyPreset(1)}>
          📍 Hoy (1 Noche)
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => applyPreset(2)}>
          📍 2 Noches
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => applyPreset(3)}>
          📍 Fin de Semana (3 Noches)
        </button>
      </div>

      <label>Ingreso (hora local)
        <input required type="datetime-local" step="1800" value={form.checkInAt} onChange={(event) => change('checkInAt', event.target.value)} />
      </label>

      <label>Salida (hora local)
        <input required type="datetime-local" step="1800" value={form.checkOutAt} onChange={(event) => change('checkOutAt', event.target.value)} />
      </label>

      <label>Número de Huéspedes
        <input required min="1" step="1" type="number" value={form.guestCount} onChange={(event) => change('guestCount', event.target.value)} />
      </label>

      <label>Huésped Principal
        <select required value={form.primaryGuestId} onChange={(event) => change('primaryGuestId', event.target.value)}>
          <option value="">Seleccione un huésped activo</option>
          {activeGuests.map((guest) => (
            <option key={guest.id} value={guest.id}>
              👤 {guest.name} · {guest.documentType} {guest.documentNumber}
            </option>
          ))}
        </select>
      </label>

      <div className="form-actions span-2" style={{ justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: '8px 20px', fontWeight: '600' }}
          disabled={loadingAvailability || busy || !form.checkInAt || !form.checkOutAt || !form.guestCount}
          onClick={consultAvailability}
        >
          <CalendarSearch size={17} aria-hidden="true" style={{ marginRight: '6px' }} />
          {loadingAvailability ? 'Consultando disponibilidad…' : 'Consultar disponibilidad'}
        </button>
      </div>

      {state.reservationAvailabilityRequest.status === 'error' ? (
        <div className="alert-banner alert-banner-danger span-2" role="alert">{state.reservationAvailabilityRequest.error}</div>
      ) : null}

      {availability && !availability.rooms.length ? (
        <div className="alert-banner alert-banner-warning span-2" role="status">
          ⚠️ No hay habitaciones disponibles para {availability.guestCount} huésped(es) en el rango de fechas seleccionado.
        </div>
      ) : null}

      {/* Available Rooms Grid Cards */}
      {availability?.rooms.length ? (
        <div className="span-2" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <label style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
            Habitaciones Disponibles ({availability.rooms.length} disponibles)
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {availability.rooms.map((room) => {
              const isSelected = form.roomId === room.roomId;
              const catName = categoryById.get(room.categoryId)?.name || 'Categoría Disponible';
              const icon = getCategoryIcon(catName);

              return (
                <div
                  key={room.roomId}
                  onClick={() => setForm((current) => ({ ...current, roomId: room.roomId }))}
                  style={{
                    border: isSelected ? '2px solid #c5a55f' : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px',
                    background: isSelected ? 'rgba(229, 201, 151, 0.12)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 0 0 3px rgba(197, 165, 95, 0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{icon}</span>
                      <strong style={{ fontSize: '15px', color: '#0f172a' }}>Hab. {room.number}</strong>
                    </div>
                    {isSelected ? <CheckCircle size={18} color="#b45309" /> : null}
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                    {catName} · Piso {room.floor} · 👥 Cap: {room.capacity}
                  </div>

                  <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{formatReservationMoney(room.nightlyRate)} / noche</span>
                    <strong style={{ fontSize: '14px', color: '#0f3c2c' }}>Total: {formatReservationMoney(room.totalAmount)}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedRoom ? (
        <div className="span-2" style={{ marginTop: '4px' }}>
          <DetailGrid compact items={[
            { label: 'Estado Operativo', value: reservationOperationalStatusToLabel(selectedRoom.operationalStatus) },
            { label: 'Duración Calculada', value: `${availability.durationMinutes} minutos (${(availability.durationMinutes / 60).toFixed(1)} horas)` },
            { label: 'Tarifa Base por Noche', value: formatReservationMoney(selectedRoom.nightlyRate) },
            { label: 'Total de la Reserva', value: formatReservationMoney(selectedRoom.totalAmount) },
          ]} />
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

      <div className="form-actions span-2" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '8px' }}>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          style={{ padding: '10px 24px', fontSize: '14px', fontWeight: '600' }}
          disabled={busy || retryBlocked || !selectedRoom || !form.primaryGuestId}
        >
          {busy ? 'Confirmando reserva…' : 'Registrar Reserva Confirmada'}
        </button>
      </div>
    </form>
  );
}

export default function ReservationsView({ notify, navigationIntent, consumeNavigationIntent }) {
  const { canAll } = usePermissions();
  const { state, reservationCommands } = useHotel();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const deferred = useDeferredValue(query.toLowerCase());

  const canCreate = canAll(PERMISSIONS.reservationsCreate, PERMISSIONS.roomsRead, PERMISSIONS.guestsRead);

  useEffect(() => {
    if (!navigationIntent) return;
    if (navigationIntent.type === 'select-record') setSelectedId(navigationIntent.recordId);
    consumeNavigationIntent(navigationIntent.id);
  }, [navigationIntent, consumeNavigationIntent]);

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
  const selectedGuest = selected ? guestsById.get(selected.primaryGuestId) : null;
  const selectedRoom = selected ? roomsById.get(selected.roomId) : null;

  const columns = [{ key: 'id', label: 'Reserva' }, { key: 'guestName', label: 'Huésped' }, { key: 'roomReference', label: 'Habitación' }, { key: 'checkInAt', label: 'Estadía' }, { key: 'totalAmount', label: 'Total' }, { key: 'statusLabel', label: 'Estado' }];
  const loadingWithoutData = state.reservationRequest.status === 'loading' && state.persistentReservations.length === 0;

  const retry = () => reservationCommands.reload().catch((error) => notify('No se pudieron cargar las reservas', error.message, 'error'));

  return <div className="view-container">
    <PageHeader metadata={`${state.persistentReservations.length} Reservas Confirmadas`} title="Reservas de Habitación" description="Cotización de tarifas, disponibilidad por intervalo e ingreso de reservas de huéspedes." action={canCreate ? <button className="btn btn-primary" onClick={() => setCreating(true)}>Nueva reserva</button> : null} />
    <MetricStrip items={[{ label: 'Total', value: state.persistentReservations.length }, { label: 'Pendientes', value: state.persistentReservations.filter((item) => item.status === 'pending').length }, { label: 'Confirmadas', value: state.persistentReservations.filter((item) => item.status === 'confirmed').length }, { label: 'Presentes', value: state.persistentReservations.filter((item) => item.status === 'checked_in').length }]} />
    {loadingWithoutData ? <div className="alert-banner alert-banner-info" role="status">Cargando reservas persistentes…</div> : null}
    {state.reservationRequest.status === 'error' ? <div className="alert-banner alert-banner-danger" role="alert"><span>{state.reservationRequest.error}</span> <button className="btn btn-sm btn-outline" onClick={retry}>Reintentar</button></div> : null}
    <div className="filter-bar"><label className="search-label"><Search size={16} /><input aria-label="Buscar reservas" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por código, huésped o habitación..." disabled={loadingWithoutData} /></label><label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="Todos">Todos</option>{Object.entries(RESERVATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span className="filter-result">{records.length} reservas</span></div>
    {!loadingWithoutData && table.total ? <section className="card table-container"><table className="custom-table"><caption>Reservas registradas en el servidor</caption><thead><tr>{columns.map((column) => <SortableHeader key={column.key} column={column} sort={table.sort} onSort={table.toggleSort} />)}<th scope="col">Detalle</th></tr></thead><tbody>{table.visible.map((item) => <tr key={item.id}><td><strong>{item.id.slice(0, 8)}</strong></td><td>{item.guestName}</td><td>{item.roomReference}</td><td>{formatReservationInstant(item.checkInAt)}<br /><small>hasta {formatReservationInstant(item.checkOutAt)}</small></td><td>{formatReservationMoney(item.totalAmount)}<br /><small>{formatReservationMoney(item.nightlyRate)} por noche</small></td><td><StatusBadge>{item.statusLabel}</StatusBadge></td><td><button className="btn btn-sm btn-outline" onClick={() => setSelectedId(item.id)}>Ver reserva</button></td></tr>)}</tbody></table><Pagination {...table} onPage={table.setPage} /></section> : null}
    {!loadingWithoutData && state.reservationRequest.status === 'success' && !table.total ? <EmptyState title={query || status !== 'Todos' ? 'Sin coincidencias' : 'Sin reservas registradas'} description={query || status !== 'Todos' ? 'No hay reservas que coincidan con los filtros.' : 'La propiedad todavía no tiene reservas persistentes.'} /> : null}
    <Drawer open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected ? `Reserva #${selected.id.slice(0, 8)}` : 'Reserva'} description={selected ? `${formatReservationInstant(selected.checkInAt)} a ${formatReservationInstant(selected.checkOutAt)}` : ''}>{selected ? <DetailGrid items={[{ label: 'Huésped', value: selectedGuest?.name || 'Huésped no disponible' }, { label: 'Habitación', value: selectedRoom ? `Habitación ${selectedRoom.number}` : 'Habitación no disponible' }, { label: 'Estado', node: <StatusBadge>{reservationStatusToLabel(selected.status)}</StatusBadge> }, { label: 'Huéspedes', value: selected.guestCount }, { label: 'Tarifa por noche', value: formatReservationMoney(selected.nightlyRate) }, { label: 'Total', value: formatReservationMoney(selected.totalAmount) }]} /> : null}</Drawer>
    <Dialog open={creating && canCreate} onClose={() => setCreating(false)} title="Nueva Reserva de Habitación" description="Cotización de tarifas, selección de fechas e ingreso de la reserva." wide>{creating && canCreate ? <ReservationForm notify={notify} onClose={() => setCreating(false)} /> : null}</Dialog>
  </div>;
}
