import { BedDouble, BellRing, CalendarDays, CheckCircle2, Clock3, CreditCard, DoorOpen } from 'lucide-react';
import { formatMoney, selectAccountBalance } from '../domain/hotelModel';
import { displayRoomReference } from '../rooms/roomModel';
import { useHotelDashboardState } from '../state/hotelContext';
import { Kpi, PageHeader, SectionHeader, StatusBadge } from '../components/views/SharedViewParts';

const padCalendarPart = (value) => String(value).padStart(2, '0');
const formatCalendarDate = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${padCalendarPart(value.getMonth() + 1)}-${padCalendarPart(value.getDate())}`;
};
const parseCalendarDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
};
const displayCalendarDate = (value, options) => parseCalendarDate(value)?.toLocaleDateString('es-PE', options) || value || 'No registrado';
const future = (days) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return formatCalendarDate(value);
};

const today = () => formatCalendarDate(new Date());
const formatDateTime = (value) => value ? new Date(value).toLocaleString('es-PE') : 'No registrado';
const inventoryAvailable = (item) => item.stock - item.reserved;

export function DashboardView({ navigate }) {
  const state = useHotelDashboardState();
  const currentDate = today();
  const nextWeek = future(7);
  const available = state.rooms.filter((room) => room.status === 'Disponible').length;
  const occupied = state.rooms.filter((room) => room.status === 'Ocupada').length;
  const occupancy = state.rooms.length ? Math.round((occupied / state.rooms.length) * 100) : 0;
  const openIncidents = state.incidents.filter((item) => item.status !== 'Cerrada');
  const lowStock = state.inventory.filter((item) => inventoryAvailable(item) <= item.minimum);
  const todayIncomeMovements = state.cashMovements.filter((item) => item.type === 'Ingreso' && formatCalendarDate(new Date(item.createdAt)) === currentDate);
  const income = todayIncomeMovements.reduce((sum, item) => sum + item.amount, 0);
  const openBalance = state.accounts.filter((item) => item.status === 'Abierta').reduce((sum, item) => sum + selectAccountBalance(item), 0);
  const activeOrders = state.orders.filter((item) => !['Entregado', 'Pagado', 'Cancelado'].includes(item.status));
  const arrivals = state.reservations.filter((item) => item.status === 'Confirmada' && item.checkIn === currentDate).toSorted((a, b) => a.checkIn.localeCompare(b.checkIn));
  const upcomingReservations = state.reservations.filter((item) => item.status === 'Confirmada' && item.checkIn > currentDate && item.checkIn <= nextWeek).toSorted((a, b) => a.checkIn.localeCompare(b.checkIn));
  const departures = state.stays.filter((item) => item.status === 'Activa').toSorted((a, b) => a.expectedCheckOut.localeCompare(b.expectedCheckOut));
  const poolInside = state.recreationAccess.filter((item) => item.zone === 'Piscina').reduce((sum, item) => sum + item.peopleInside, 0);
  const activeGuests = state.stays.filter((item) => item.status === 'Activa').length;

  const operation = [
    { label: 'Limpieza', value: state.cleaningTasks.filter((item) => item.status !== 'Aprobada').length, detail: 'tareas activas', route: 'limpieza', icon: '🧹' },
    { label: 'Mantenimiento', value: state.maintenanceTickets.filter((item) => item.status !== 'Cerrado').length, detail: 'pendientes', route: 'mantenimiento', icon: '🔧' },
    { label: 'Pedidos Bar', value: activeOrders.length, detail: 'por entregar', route: 'pedidos-qr', icon: '🍷' },
    { label: 'Eventos', value: state.events.filter((item) => item.date >= today()).length, detail: 'programados', route: 'eventos', icon: '📅' },
    { label: 'Piscina', value: `${poolInside}/${state.poolCapacity}`, detail: 'aforo actual', route: 'recreacion', icon: '🏊' },
    { label: 'Inventario', value: lowStock.length, detail: 'bajo mínimo', route: 'inventario', icon: '📦' },
  ];

  return <div className="view-container">
    <PageHeader
      metadata="Centro de Control Operativo 5★"
      title="Dashboard General"
      description="Visión ejecutiva en tiempo real de ocupación, reservas, salidas, limpiezas y facturación."
      action={
        <div className="dashboard-header-actions">
          <button className="btn btn-primary" onClick={() => navigate('reservas')}>➕ Nueva Reserva</button>
          <button className="btn btn-outline" onClick={() => navigate('checkin-checkout')}>📥 Check-in / Out</button>
          <button className="btn btn-outline" onClick={() => navigate('limpieza')}>🧹 Limpieza</button>
        </div>
      }
    />

    <div className="dashboard-kpi-grid">
      <Kpi label="Disponibles" value={available} detail={`${state.rooms.length} habitaciones libres`} icon={CheckCircle2} />
      <Kpi label="Ocupadas" value={occupied} detail={`${occupancy} % de ocupación actual`} icon={BedDouble} tone="purple" />
      <Kpi label="Llegadas Hoy" value={arrivals.length} detail="Reservas confirmadas" icon={CalendarDays} tone="blue" />
      <Kpi label="Ingresos del Día" value={formatMoney(income)} detail="Caja de la jornada" icon={CreditCard} tone="gold" />
      <Kpi label="Saldos Abiertos" value={formatMoney(openBalance)} detail={`${departures.length} estadías activas`} icon={DoorOpen} tone="warning" />
      <Kpi label="Alertas Operativas" value={openIncidents.length + lowStock.length} detail="Incidencias + stock crítico" icon={BellRing} tone="red" />
    </div>

    <section className="dashboard-overview-grid" aria-label="Información importante">
      <article className="card">
        <SectionHeader eyebrow="Caja del día" title="Resumen financiero" description="Ingresos registrados durante la jornada actual." />
        <div className="financial-highlight">
          <span>Ingresos de hoy</span>
          <strong>{formatMoney(income)}</strong>
          <small>{todayIncomeMovements.length} movimiento(s) registrados</small>
        </div>
        <div className="compact-indicators">
          <button onClick={() => navigate('finanzas')}><span className="compact-icon tone-blue">$</span><span><strong>{formatMoney(openBalance)}</strong>Saldo abierto</span></button>
          <button onClick={() => navigate('finanzas')}><span className="compact-icon tone-warning">!</span><span><strong>{state.accounts.filter((item) => item.status === 'Abierta').length}</strong>Cuentas abiertas</span></button>
        </div>
      </article>

      <article className="card">
        <SectionHeader eyebrow="Capacidad actual" title="Ocupación y huéspedes" description="Estado de alojamiento y espacios compartidos." />
        <div className="compact-indicators">
          <button onClick={() => navigate('habitaciones')}><span className="compact-icon tone-purple">{occupancy}%</span><span><strong>{occupied}/{state.rooms.length}</strong>Habitaciones ocupadas</span></button>
          <button onClick={() => navigate('habitaciones')}><span className="compact-icon tone-green">✓</span><span><strong>{available}</strong>Habitaciones disponibles</span></button>
          <button onClick={() => navigate('checkin-checkout')}><span className="compact-icon tone-blue">{activeGuests}</span><span><strong>{activeGuests}</strong>Huéspedes alojados</span></button>
          <button onClick={() => navigate('recreacion')}><span className="compact-icon tone-warning">{poolInside}</span><span><strong>{poolInside}/{state.poolCapacity}</strong>Personas en piscina</span></button>
        </div>
      </article>

      <article className="card">
        <SectionHeader eyebrow="Próximos 7 días" title="Llegadas próximas" description="Reservas confirmadas que requieren preparación." />
        <div className="dashboard-alert-list">
          {upcomingReservations.slice(0, 4).map((item) => <button key={item.id} onClick={() => navigate('reservas')}><span className="alert-icon">📅</span><span><strong>{selectClientName(state, item.clientId)}</strong><small>{displayCalendarDate(item.checkIn)} · Hab. {item.roomId}</small></span><StatusBadge>{item.status}</StatusBadge></button>)}
          {!upcomingReservations.length ? <span className="dashboard-empty-compact">No hay llegadas confirmadas en los próximos 7 días.</span> : null}
        </div>
      </article>
    </section>

    <section aria-labelledby="dashboard-operation-title">
      <SectionHeader id="dashboard-operation-title" eyebrow="Control Transversal 5★" title="Pulso Operativo del Hotel" description="Acceso directo a cada módulo operativo de la propiedad." />
      <div className="operational-strip">
        {operation.map((item) => (
          <button key={item.label} onClick={() => navigate(item.route)}>
            <span>{item.icon} {item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
    </section>

    <div className="dashboard-list-grid">
      <DashboardList title="📥 Llegadas Confirmadas" records={arrivals} empty="Sin llegadas pendientes hoy" onOpen={() => navigate('checkin-checkout')} render={(item) => ({ title: selectClientName(state, item.clientId), detail: `${displayRoomReference(state, item.roomId)} · ${displayCalendarDate(item.checkIn)}`, status: item.status })} />
      <DashboardList title="📤 Salidas Previstas" records={departures} empty="Sin salidas pendientes hoy" onOpen={() => navigate('checkin-checkout')} render={(item) => ({ title: selectClientName(state, item.clientId), detail: `${displayRoomReference(state, item.roomId)} · ${displayCalendarDate(item.expectedCheckOut)}`, status: item.status })} />
      <DashboardList title="⚠️ Atención Prioritaria" records={[...openIncidents, ...lowStock]} empty="Sin alertas abiertas" onOpen={(item) => navigate(item.id.startsWith('INC') ? 'incidencias' : 'inventario')} render={(item) => item.id.startsWith('INC') ? ({ title: item.description, detail: item.roomId ? `Hab. ${item.roomId}` : item.type, status: item.priority }) : ({ title: item.name, detail: `${inventoryAvailable(item)} ${item.unit} disponibles`, status: inventoryAvailable(item) < 0 ? 'Crítico' : 'Bajo mínimo' })} />
    </div>

    <section className="activity-strip" aria-labelledby="activity-title">
      <div>
        <span className="activity-mark"><Clock3 size={17} /></span>
        <span><strong id="activity-title">Auditoría Operativa Reciente</strong><small>Registro de eventos y cambios del sistema</small></span>
      </div>
      <div className="activity-items">
        {state.auditLog.slice(0, 3).map((entry) => (
          <span key={entry.id}><strong>{entry.action}</strong><small>{entry.module} · {formatDateTime(entry.createdAt)}</small></span>
        ))}
      </div>
      <button className="text-action" onClick={() => navigate('auditoria')}>Ver auditoría completa</button>
    </section>
  </div>;
}

function DashboardList({ title, records, empty, onOpen, render }) {
  return <article className="card dashboard-list-card"><div className="card-header"><h3 className="card-title">{title}</h3><span className="list-total">{records.length}</span></div><div className="dashboard-records">{records.slice(0, 4).map((item) => { const detail = render(item); return <button key={item.id} onClick={() => onOpen(item)}><span><strong>{detail.title}</strong><small>{detail.detail}</small></span><StatusBadge>{detail.status}</StatusBadge></button>; })}{records.length === 0 ? <span className="dashboard-list-empty">{empty}</span> : null}</div></article>;
}
