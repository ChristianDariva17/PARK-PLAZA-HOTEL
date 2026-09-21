import { useState } from 'react';
import { formatMoney, ORDER_STATUSES, ROOM_STATUSES } from '../domain/hotelModel';
import { useHotel } from '../state/hotelContext';
import { MetricStrip, PageHeader, SectionHeader } from '../components/views/SharedViewParts';

const inventoryAvailable = (item) => item.stock - item.reserved;

export function ReportsView() {
  const { state } = useHotel();
  const [report, setReport] = useState('habitaciones');
  const roomCharges = state.accounts.flatMap((item) => item.charges);
  const reports = {
    habitaciones: ROOM_STATUSES.map((item) => ({ label: item, value: state.rooms.filter((room) => room.status === item).length })),
    finanzas: [...new Set(state.payments.map((item) => item.method))].map((item) => ({ label: item, value: formatMoney(state.payments.filter((payment) => payment.method === item).reduce((sum, payment) => sum + payment.amount, 0)) })),
    clientes: state.clients.map((item) => ({ label: item.name, value: `${state.reservations.filter((reservation) => reservation.clientId === item.id).length} reservas · ${state.stays.filter((stay) => stay.clientId === item.id).length} estadías · ${formatMoney(state.payments.filter((payment) => payment.clientId === item.id).reduce((sum, payment) => sum + payment.amount, 0))} en pagos visibles` })),
    pedidos: ORDER_STATUSES.map((item) => ({ label: item, value: state.orders.filter((order) => order.status === item).length })),
    inventario: state.inventory.map((item) => ({ label: item.name, value: `${inventoryAvailable(item)} ${item.unit} disponibles${inventoryAvailable(item) < 0 ? ' · sobre-reservado' : ''}` })),
    personal: state.staff.map((item) => ({ label: `${item.name} · ${item.area}`, value: `${item.overtimeHours} h extra · ${item.attendance}` })),
    eventos: state.events.map((item) => ({ label: `${item.date} · ${item.title}`, value: `${item.venue} · ${formatMoney(item.total)}` })),
    recreacion: state.recreationAccess.map((item) => ({ label: `${item.zone} · Hab. ${item.roomId}`, value: `${item.peopleInside}/${item.allowedPeople} dentro · ${item.status}` })),
  };
  return <div className="view-container"><PageHeader metadata="Corte de registros actuales" title="Reportes de sesión" description="Lecturas operativas por módulo sin atribuir períodos históricos que el frontend no conserva." /><MetricStrip items={[{ label: 'Habitaciones ocupadas', value: state.rooms.filter((item) => item.status === 'Ocupada').length }, { label: 'Pagos registrados', value: formatMoney(state.payments.reduce((sum, item) => sum + item.amount, 0)) }, { label: 'Cargos visibles', value: formatMoney(roomCharges.reduce((sum, item) => sum + item.amount, 0)) }, { label: 'Pedidos', value: state.orders.length }, { label: 'Eventos', value: state.events.length }, { label: 'Incidencias abiertas', value: state.incidents.filter((item) => !['Resuelta', 'Cerrada'].includes(item.status)).length }]} /><div className="report-selector" role="group" aria-label="Seleccionar reporte">{Object.keys(reports).map((key) => <button key={key} className={report === key ? 'active' : ''} onClick={() => setReport(key)}>{({ habitaciones: 'Habitaciones', finanzas: 'Finanzas', clientes: 'Clientes', pedidos: 'Pedidos', inventario: 'Inventario', personal: 'Personal', eventos: 'Eventos', recreacion: 'Recreación' })[key]}</button>)}</div><section className="card"><SectionHeader eyebrow="Registros visibles" title={`Reporte de ${{ habitaciones: 'habitaciones', finanzas: 'finanzas', clientes: 'clientes', pedidos: 'pedidos', inventario: 'inventario', personal: 'personal', eventos: 'eventos', recreacion: 'recreación' }[report]}`} /><div className="report-grid">{reports[report].map((item) => <div key={`${item.label}-${item.value}`}><span>{item.label}</span><strong>{item.value}</strong></div>)}</div></section></div>;
}
