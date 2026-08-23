import { useState } from 'react';
import { usePermissions } from '../../../auth/authContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { formatReservationInstant, reservationStatusToLabel } from '../../../reservations/reservationModel';
import { useHotel } from '../../../state/hotelContext';
import FolioPanel from '../../../folios/FolioPanel';
import { canOverrideCheckout, checkoutDebtMessage } from '../../../folios/folioModel';
import { Dialog, TabPanel, Tabs } from '../../ui/Overlay';
import { DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';

function CheckInDialog({ reservation, guest, room, onClose, notify }) {
  const { state, stayCommands } = useHotel();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await stayCommands.checkIn(reservation.id);
      notify('Check-in completado', 'La estadía, el folio de saldo inicial cero y el estado ocupado fueron confirmados por el servidor.', 'success');
      onClose();
    } catch (failure) { setError(failure.message || 'No se pudo completar el check-in.'); } finally { setBusy(false); }
  };

  return <div className="detail-stack">
    <DetailGrid items={[
      { label: 'Huésped Principal', value: guest?.name || 'Huésped no disponible' },
      { label: 'Habitación Asignada', value: room ? `Habitación ${room.number} (${room.category || ''})` : 'Habitación no disponible' },
      { label: 'Fecha / Hora de Ingreso', value: formatReservationInstant(reservation.checkInAt) },
      { label: 'Salida Prevista', value: formatReservationInstant(reservation.checkOutAt) },
      { label: 'Estado de Reserva', node: <StatusBadge>{reservationStatusToLabel(reservation.status)}</StatusBadge> },
    ]} />
    <div className="alert-banner alert-banner-info">
      ℹ️ El servidor valida que la habitación esté disponible y el huésped activo. Se abrirá la estadía con folio inicial en cero.
    </div>
    {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}
    {state.stayCommandRequest.retryBlocked ? <div className="alert-banner alert-banner-danger" role="alert">{state.stayCommandRequest.error}</div> : null}
    <div className="form-actions">
      <button className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={busy || state.stayCommandRequest.retryBlocked || !guest || !room} onClick={submit}>
        {busy ? 'Confirmando check-in…' : 'Confirmar Check-in'}
      </button>
    </div>
  </div>;
}

function CheckOutDialog({ stay, reservation, room, onClose, notify }) {
  const { state, stayCommands } = useHotel();
  const { can } = usePermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [folio, setFolio] = useState(null);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (Number(folio?.balance || 0) > 0 && (!canOverrideCheckout([PERMISSIONS.staysCheckOut, ...(can(PERMISSIONS.staysCheckOutOverride) ? [PERMISSIONS.staysCheckOutOverride] : [])], folio) || !overrideReason.trim())) throw new Error('El saldo pendiente requiere el permiso de cuenta por cobrar y un motivo.');
      await stayCommands.checkOut(stay.id, overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {});
      notify('Check-out completado', 'La estadía fue cerrada y la habitación pasó a tareas de limpieza.', 'success');
      onClose();
    } catch (failure) { setError(failure.message || 'No se pudo completar el check-out.'); } finally { setBusy(false); }
  };

  return <div className="detail-stack">
    <DetailGrid items={[
      { label: 'Identificador de Estadía', value: stay.id },
      { label: 'Habitación', value: room ? `Habitación ${room.number}` : 'Habitación no disponible' },
      { label: 'Fecha / Hora de Ingreso', value: formatReservationInstant(stay.checkInAt) },
      { label: 'Reserva Asociada', value: reservation?.id || 'Sin reserva directa' },
    ]} />
    <div className="alert-banner alert-banner-warning">
      ⚠️ Al confirmar el Check-out se cerrará la estadía y la habitación pasará automáticamente a estado <strong>En Limpieza</strong> para la generación de la tarea correspondiente.
    </div>
    <FolioPanel stayId={stay.id} canCharge={can(PERMISSIONS.financeCharge)} canPay={can(PERMISSIONS.financePayment)} canReverse={can(PERMISSIONS.financeReverse)} onFolioChange={setFolio} />
    {checkoutDebtMessage(folio) ? <div className="alert-banner alert-banner-warning">{checkoutDebtMessage(folio)} El check-out queda bloqueado hasta pagar o registrar una cuenta por cobrar autorizada.</div> : null}
    {can(PERMISSIONS.staysCheckOutOverride) ? <label className="form-field">Motivo de cuenta por cobrar (solo si el servidor informa saldo pendiente)<textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} maxLength={300} /></label> : null}
    {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}
    {state.stayCommandRequest.retryBlocked ? <div className="alert-banner alert-banner-danger" role="alert">{state.stayCommandRequest.error}</div> : null}
    <div className="form-actions">
      <button className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" disabled={busy || state.stayCommandRequest.retryBlocked || !room} onClick={submit}>
        {busy ? 'Confirmando check-out…' : 'Confirmar Check-out'}
      </button>
    </div>
  </div>;
}

export default function CheckInOutView({ notify }) {
  const { can } = usePermissions();
  const { state, stayCommands, reservationCommands } = useHotel();
  const [tab, setTab] = useState('checkin');
  const [reservationId, setReservationId] = useState(null);
  const [stayId, setStayId] = useState(null);

  const arrivals = can(PERMISSIONS.staysCheckIn) ? state.persistentReservations.filter((reservation) => ['pending', 'confirmed'].includes(reservation.status)) : [];
  const departures = can(PERMISSIONS.staysCheckOut) ? state.persistentStays.filter((stay) => stay.status === 'active') : [];

  const reservation = state.persistentReservations.find((entry) => entry.id === reservationId) || null;
  const selectedStay = state.persistentStays.find((entry) => entry.id === stayId) || null;
  const guestForReservation = state.clients.find((guest) => guest.id === reservation?.primaryGuestId) || null;
  const roomForReservation = state.rooms.find((room) => room.id === reservation?.roomId) || null;
  const departureReservation = state.persistentReservations.find((reservationEntry) => reservationEntry.id === selectedStay?.reservationId) || null;
  const roomForStay = state.rooms.find((room) => room.id === selectedStay?.roomId) || null;
  const loading = state.reservationRequest.status === 'loading' || state.stayRequest.status === 'loading';

  const retry = () => Promise.allSettled([reservationCommands.reload(), stayCommands.reload()]);

  return <div className="view-container">
    <PageHeader
      metadata="Recepción y Control de Estadías 5★"
      title="Check-in y Check-out"
      description="Gestión de ingresos, salidas de huéspedes, validación de identidad y liquidación de estadías."
    />

    <MetricStrip items={[
      { label: 'Llegadas listas', value: arrivals.length },
      { label: 'Estadías activas', value: departures.length },
      { label: 'Habitaciones en limpieza', value: state.rooms.filter((room) => ['cleaning', 'En limpieza'].includes(room.status)).length },
      { label: 'Habitaciones disponibles', value: state.rooms.filter((room) => ['available', 'Disponible'].includes(room.status)).length },
    ]} />

    {state.reservationRequest.status === 'error' || state.stayRequest.status === 'error' ? (
      <div className="alert-banner alert-banner-danger" role="alert">
        <span>{state.reservationRequest.error || state.stayRequest.error}</span>
        <button className="btn btn-sm btn-outline" onClick={retry}>Reintentar</button>
      </div>
    ) : null}

    <Tabs
      label="Operación de recepción"
      tabs={[
        { id: 'checkin', label: `📥 Llegadas (Check-in) (${arrivals.length})` },
        { id: 'checkout', label: `📤 Salidas (Check-out) (${departures.length})` },
      ]}
      activeTab={tab}
      onChange={setTab}
    />

    <TabPanel id="checkin" active={tab === 'checkin'} label="Llegadas programadas">
      <div className="operation-cards">
        {loading && !arrivals.length ? <div className="alert-banner alert-banner-info" role="status">Cargando datos de recepción…</div> : null}
        {arrivals.length ? arrivals.map((entry) => {
          const guest = state.clients.find((item) => item.id === entry.primaryGuestId);
          const room = state.rooms.find((item) => item.id === entry.roomId);
          return (
            <article className="card operation-card" key={entry.id} style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <div className="row-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #1e293b, #334155)', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '15px' }}>
                    {(guest?.name || 'H')[0]}
                  </div>
                  <div>
                    <span className="eyebrow" style={{ fontSize: '11px', color: '#64748b' }}>Reserva {entry.id.slice(0, 8)}</span>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{guest?.name || 'Huésped no disponible'}</h3>
                  </div>
                </div>
                <StatusBadge>{reservationStatusToLabel(entry.status)}</StatusBadge>
              </div>
              <div style={{ margin: '14px 0', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>🛏️ <strong>Habitación:</strong> {room ? `Hab. ${room.number} (${room.category || 'Estándar'})` : 'No asignada'}</div>
                <div>📅 <strong>Fecha Check-in:</strong> {formatReservationInstant(entry.checkInAt)}</div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={!guest || !room || state.stayCommandRequest.status === 'saving'} onClick={() => setReservationId(entry.id)}>
                Procesar Check-in
              </button>
            </article>
          );
        }) : (
          <EmptyState
            title="Sin llegadas pendientes para hoy"
            description="No hay check-ins programados en este momento. Todas las reservas elegibles han sido procesadas."
          />
        )}
      </div>
    </TabPanel>

    <TabPanel id="checkout" active={tab === 'checkout'} label="Estadías activas">
      <div className="operation-cards">
        {departures.length ? departures.map((entry) => {
          const room = state.rooms.find((item) => item.id === entry.roomId);
          return (
            <article className="card operation-card" key={entry.id} style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
              <div className="row-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #0f172a, #1e293b)', color: '#e5c997', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '15px', border: '1px solid rgba(229,201,151,0.3)' }}>
                    {room ? room.number : 'Hab'}
                  </div>
                  <div>
                    <span className="eyebrow" style={{ fontSize: '11px', color: '#64748b' }}>Estadía Activa</span>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Habitación {room ? room.number : 'N/A'}</h3>
                  </div>
                </div>
                <StatusBadge>Activa</StatusBadge>
              </div>
              <div style={{ margin: '14px 0', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>⏱️ <strong>Ingresó:</strong> {formatReservationInstant(entry.checkInAt)}</div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={!room || state.stayCommandRequest.status === 'saving'} onClick={() => setStayId(entry.id)}>
                Procesar Check-out
              </button>
            </article>
          );
        }) : (
          <EmptyState
            title="Sin estadías activas pendientes"
            description="Actualmente no hay huéspedes alojados pendientes de Check-out."
          />
        )}
      </div>
    </TabPanel>

    <Dialog open={Boolean(reservation)} onClose={() => setReservationId(null)} title="Procesar Check-in de Huésped" wide>
      {reservation ? <CheckInDialog reservation={reservation} guest={guestForReservation} room={roomForReservation} onClose={() => setReservationId(null)} notify={notify} /> : null}
    </Dialog>

    <Dialog open={Boolean(selectedStay)} onClose={() => setStayId(null)} title="Procesar Check-out de Estadía" wide>
      {selectedStay ? <CheckOutDialog stay={selectedStay} reservation={departureReservation} room={roomForStay} onClose={() => setStayId(null)} notify={notify} /> : null}
    </Dialog>
  </div>;
}
