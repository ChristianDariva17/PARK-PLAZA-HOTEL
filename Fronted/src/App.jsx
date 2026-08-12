import { Component, lazy, Suspense, useCallback, useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import { VALID_ROUTES } from './components/layout/navigation';
import Toast from './components/layout/Toast';
import Topbar from './components/layout/Topbar';
import { useHashRoute } from './hooks/useHashRoute';
import { useHotel } from './state/hotelContext';

const named = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const DashboardView = named(() => import('./components/views/CoreViews'), 'DashboardView');
const ReportsView = named(() => import('./components/views/CoreViews'), 'ReportsView');
const RoomsView = lazy(() => import('./components/views/rooms/RoomsView'));
const ReservationsView = lazy(() => import('./components/views/reservations/ReservationsView'));
const CheckInOutView = lazy(() => import('./components/views/checkin/CheckInOutView'));
const CustomersView = lazy(() => import('./components/views/customers/CustomersView'));
const OrdersView = lazy(() => import('./components/views/orders/OrdersView'));
const StaffAttendanceView = named(() => import('./components/biometrics/StaffAttendanceView'), 'StaffAttendanceView');
const AuditView = named(() => import('./components/views/ExtendedViews'), 'AuditView');
const RolesView = named(() => import('./components/views/ExtendedViews'), 'RolesView');
const SettingsView = named(() => import('./components/views/ExtendedViews'), 'SettingsView');
const P1 = (name) => named(() => import('./components/views/P1Views'), name);
const Operational = (name) => named(() => import('./components/views/OperationalViews'), name);

const VIEW_COMPONENTS = {
  dashboard: DashboardView,
  habitaciones: RoomsView,
  reservas: ReservationsView,
  contratos: P1('P1ContractsView'),
  'checkin-checkout': CheckInOutView,
  finanzas: P1('P1FinanceView'),
  clientes: CustomersView,
  limpieza: P1('P1CleaningView'),
  mantenimiento: Operational('OperationalMaintenanceView'),
  incidencias: Operational('OperationalIncidentsView'),
  evidencias: P1('P1EvidenceView'),
  notificaciones: P1('P1NotificationsView'),
  'pedidos-qr': OrdersView,
  inventario: Operational('OperationalInventoryView'),
  'cocina-bar': P1('P1FoodBarView'),
  proveedores: Operational('OperationalSuppliersView'),
  'bar-qr': Operational('OperationalBarQrView'),
  'terraza-qr': Operational('OperationalTerraceQrView'),
  cochera: P1('P1ParkingView'),
  mascotas: P1('P1PetsView'),
  recreacion: P1('P1RecreationView'),
  eventos: P1('P1EventsView'),
  'calendario-eventos': P1('P1EventCalendarView'),
  encuestas: P1('P1SurveysView'),
  personal: StaffAttendanceView,
  caja: Operational('OperationalCashView'),
  reportes: ReportsView,
  roles: RolesView,
  auditoria: AuditView,
  configuracion: SettingsView,
};

class RouteErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div className="route-error" role="alert"><h2>No se pudo cargar este módulo</h2><p>Recargá la página o volvé a intentarlo desde la navegación.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Recargar aplicación</button></div>;
    return this.props.children;
  }
}

export default function App() {
  const { state, execute } = useHotel();
  const [currentView, hashNavigate] = useHashRoute(VALID_ROUTES);
  const [navigationIntent, setNavigationIntent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((title, message = '', type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, title, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4500);
  }, []);
  const navigate = useCallback((route, intent = null) => {
    setNavigationIntent(intent ? { ...intent, route, id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` } : null);
    hashNavigate(route);
  }, [hashNavigate]);
  const consumeNavigationIntent = useCallback((id) => setNavigationIntent((current) => current?.id === id ? null : current), []);
  const runSilent = useCallback((action) => {
    const result = execute(action);
    if (!result.ok) notify('Operación rechazada', result.error || result.message || 'No se pudo completar la operación.', 'error');
    return result;
  }, [execute, notify]);
  const View = VIEW_COMPONENTS[currentView] || DashboardView;
  const pendingOrders = state.orders.filter((order) => !['Entregado', 'Pagado', 'Cancelado'].includes(order.status)).length;
  const routeIntent = navigationIntent?.route === currentView ? navigationIntent : null;
  return <div className="app-layout"><a className="skip-link" href="#main-content">Saltar al contenido</a><Sidebar currentView={currentView} navigate={navigate} pendingOrdersCount={pendingOrders} open={sidebarOpen} onClose={() => setSidebarOpen(false)} /><div className="main-content"><Topbar currentView={currentView} state={state} notifications={state.notifications} onMenu={() => setSidebarOpen(true)} onNavigate={navigate} onRead={(notificationId) => runSilent({ type: 'NOTIFICATION_READ', notificationId })} onReadAll={() => runSilent({ type: 'NOTIFICATIONS_READ_ALL' })} /><main id="main-content" tabIndex="-1"><RouteErrorBoundary key={currentView}><Suspense fallback={<div className="route-loading" role="status" aria-live="polite">Cargando módulo…</div>}><View navigate={navigate} notify={notify} navigationIntent={routeIntent} consumeNavigationIntent={consumeNavigationIntent} /></Suspense></RouteErrorBoundary></main></div><Toast toasts={toasts} removeToast={(id) => setToasts((items) => items.filter((item) => item.id !== id))} /></div>;
}
