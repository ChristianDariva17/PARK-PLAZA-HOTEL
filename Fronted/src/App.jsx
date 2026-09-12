import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, usePermissions } from './auth/authContext';
import { permissionForRoute } from './auth/permissions';
import LoginView, { SessionCheckingView, SessionErrorView } from './components/auth/LoginView';
import ChangePasswordView from './components/auth/ChangePasswordView';
import Sidebar from './components/layout/Sidebar';
import { VALID_ROUTES } from './components/layout/navigation';
import Toast from './components/layout/Toast';
import Topbar from './components/layout/Topbar';
import { useHashRoute } from './hooks/useHashRoute';
import { useHotelCommands, useHotelShellState } from './state/hotelContext';
import { isAdminContractAdmitted } from './contracts/admission.js';

const named = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const DashboardView = named(() => import('./components/views/CoreViews'), 'DashboardView');
const ReportsView = named(() => import('./components/views/CoreViews'), 'ReportsView');
const RoomsView = lazy(() => import('./components/views/rooms/RoomsView'));
const ReservationsView = lazy(() => import('./components/views/reservations/ReservationsView'));
const CheckInOutView = lazy(() => import('./components/views/checkin/CheckInOutView'));
const CustomersView = lazy(() => import('./components/views/customers/CustomersView'));
const OrdersView = lazy(() => import('./components/views/orders/OrdersView'));
const MenuManagementView = lazy(() => import('./restaurant/MenuManagementView').then(m => ({ default: m.MenuManagementView })));
const StaffAttendanceView = named(() => import('./views/staff/StaffAttendanceView'), 'StaffAttendanceView');
const StaffDirectoryView = named(() => import('./views/staff/StaffDirectoryView'), 'StaffDirectoryView');
const ContractsView = lazy(() => import('./documents/views/ContractsView').then(m => ({ default: m.ContractsView })));
const EvidenceView = lazy(() => import('./documents/views/EvidenceView').then(m => ({ default: m.EvidenceView })));
const AuditView = lazy(() => import('./documents/views/AuditView').then(m => ({ default: m.AuditView })));
const RolesView = named(() => import('./components/views/ExtendedViews'), 'RolesView');
const SettingsView = named(() => import('./components/views/ExtendedViews'), 'SettingsView');
const AccessAccountsView = lazy(() => import('./components/views/AccessAccountsView'));
const ReceivablesView = lazy(() => import('./receivables/ReceivablesView'));
const EventsModuleRoot = named(() => import('./events/EventsModuleRoot'), 'EventsModuleRoot');
const SuppliersModuleRoot = named(() => import('./suppliers/SuppliersModuleRoot'), 'SuppliersModuleRoot');
const P1 = (name) => named(() => import('./components/views/P1Views'), name);
const Operational = (name) => named(() => import('./components/views/OperationalViews'), name);

const VIEW_COMPONENTS = {
  dashboard: DashboardView,
  habitaciones: RoomsView,
  reservas: ReservationsView,
  contratos: ContractsView,
  'checkin-checkout': CheckInOutView,
  finanzas: ReceivablesView,
  clientes: CustomersView,
  limpieza: P1('P1CleaningView'),
  mantenimiento: Operational('OperationalMaintenanceView'),
  incidencias: Operational('OperationalIncidentsView'),
  evidencias: EvidenceView,
  notificaciones: P1('P1NotificationsView'),
  'pedidos-qr': OrdersView,
  inventario: Operational('OperationalInventoryView'),
  'cocina-bar': MenuManagementView,
  proveedores: SuppliersModuleRoot,
  cochera: P1('P1ParkingView'),
  mascotas: P1('P1PetsView'),
  recreacion: P1('P1RecreationView'),
  eventos: () => <EventsModuleRoot view="list" />,
  'calendario-eventos': () => <EventsModuleRoot view="calendar" />,
  personal: StaffAttendanceView,
  'personal-directorio': StaffDirectoryView,
  caja: Operational('OperationalCashView'),
  reportes: ReportsView,
  'cuentas-acceso': AccessAccountsView,
  roles: RolesView,
  auditoria: AuditView,
  configuracion: SettingsView,
};

class RouteErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div className="route-error state-panel state-error" role="alert"><h2>No se pudo cargar este módulo</h2><p>Recargá la página o volvé a intentarlo desde la navegación.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Recargar aplicación</button></div>;
    return this.props.children;
  }
}

function ContractBlockedView({ route }) {
  return <section className="route-error state-panel state-forbidden" role="status" aria-live="polite"><h2>Contrato Backend no verificado</h2><p>El módulo {route} permanece visible, pero no muestra datos ni acciones hasta que su contrato Backend sea aprobado y verificado.</p></section>;
}

import { useWebSocket, useWebSocketEvents } from './hooks/useWebSocket';
import { useCommunications } from './communications/useCommunications.js';

function HotelShell() {
  const { account, loggingOut, logout } = useAuth();
  const { can } = usePermissions();
  const shellState = useHotelShellState();
  const { roomCommands } = useHotelCommands();
  const { notifications: communicationNotifications, handleMarkRead, handleMarkAllRead } = useCommunications();
  const authorizedRoutes = useMemo(() => new Set([...VALID_ROUTES].filter((route) => can(permissionForRoute(route)))), [can]);
  const fallbackRoute = authorizedRoutes.values().next().value || '';
  const [currentView, hashNavigate] = useHashRoute(VALID_ROUTES, fallbackRoute);
  const [navigationIntent, setNavigationIntent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const roomReloadTimerRef = useRef(null);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const notify = useCallback((title, message = '', type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, title, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4500);
  }, []);

  // WebSockets Realtime Event Listeners
  useWebSocket('notification:new', (notif) => {
    console.log('[WebSocket] Notificación operativa recibida:', notif);
    notify(notif.title || 'Nueva Notificación', notif.content || notif.description || '', notif.priority === 'HIGH' ? 'error' : notif.priority === 'MEDIUM' ? 'warning' : 'info');
  });

  useWebSocket('order:created', (order) => {
    console.log('[WebSocket] Pedido entrante:', order);
    notify('🍽️ Nuevo Pedido Entrante', `Comanda #${order.id?.slice(0, 8) || ''} recibida en cocina.`, 'info');
  });

  const scheduleRoomReload = useCallback((room) => {
    console.log('[WebSocket] Cambio de habitación:', room);
    notify('🏨 Habitación actualizada', `Habitación ${room?.number || ''} sincronizada en vivo`, 'info');
    if (roomReloadTimerRef.current) window.clearTimeout(roomReloadTimerRef.current);
    roomReloadTimerRef.current = window.setTimeout(() => {
      roomReloadTimerRef.current = null;
      roomCommands?.reload?.().catch(() => {});
    }, 100);
  }, [notify, roomCommands]);

  useWebSocketEvents(['room:updated', 'room:status_changed', 'room:category_updated'], scheduleRoomReload);

  useEffect(() => () => {
    if (roomReloadTimerRef.current) window.clearTimeout(roomReloadTimerRef.current);
  }, []);

  const navigate = useCallback((route, intent = null) => {
    setNavigationIntent(intent ? { ...intent, route, id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}` } : null);
    setSidebarOpen(false);
    hashNavigate(route);
  }, [hashNavigate]);
  const consumeNavigationIntent = useCallback((id) => setNavigationIntent((current) => current?.id === id ? null : current), []);
  const routeAuthorized = authorizedRoutes.has(currentView);
  const View = VIEW_COMPONENTS[currentView] || DashboardView;
  const pendingOrders = shellState.orders.filter((order) => !['Entregado', 'Pagado', 'Cancelado'].includes(order.status)).length;
  const routeIntent = navigationIntent?.route === currentView ? navigationIntent : null;
  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      notify('No se pudo cerrar la sesión', 'Intentá nuevamente.', 'error');
    }
  };
  return <div className="app-layout"><a className="skip-link" href="#main-content">Saltar al contenido</a><Sidebar currentView={currentView} navigate={navigate} pendingOrdersCount={pendingOrders} open={sidebarOpen} onClose={closeSidebar} account={account} onLogout={handleLogout} loggingOut={loggingOut} /><div className="main-content"><Topbar currentView={currentView} notifications={communicationNotifications.data} menuOpen={sidebarOpen} onMenu={() => setSidebarOpen(true)} onNavigate={navigate} onRead={(notificationId) => { void handleMarkRead(notificationId); }} onReadAll={() => { void handleMarkAllRead(); }} account={account} /><main id="main-content" tabIndex="-1">{routeAuthorized ? isAdminContractAdmitted(currentView) ? <RouteErrorBoundary key={currentView}><Suspense fallback={<div className="route-loading state-panel state-loading" role="status" aria-live="polite">Cargando módulo…</div>}><View navigate={navigate} notify={notify} navigationIntent={routeIntent} consumeNavigationIntent={consumeNavigationIntent} /></Suspense></RouteErrorBoundary> : <ContractBlockedView route={currentView} /> : <div className="route-error state-panel state-forbidden" role="alert"><h2>Acceso denegado</h2><p>No tenés permiso para abrir este módulo.</p>{fallbackRoute ? <button className="btn btn-primary" onClick={() => navigate(fallbackRoute)}>Ir a un módulo autorizado</button> : null}</div>}</main></div><Toast toasts={toasts} removeToast={(id) => setToasts((items) => items.filter(({ id: toastId }) => toastId !== id))} /></div>;
}

export default function App() {
  const auth = useAuth();
  if (auth.status === 'checking') return <SessionCheckingView />;
  if (auth.status === 'error') return <SessionErrorView message={auth.error} onRetry={auth.retryBootstrap} />;
  if (auth.status === 'anonymous') return <LoginView onLogin={auth.login} onGoogleLogin={auth.loginWithGoogle} />;
  if (auth.passwordChangeRequired) return <ChangePasswordView account={auth.account} onChangePassword={auth.changePassword} onLogout={auth.logout} loggingOut={auth.loggingOut} />;
  return <HotelShell />;
}
