import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth, usePermissions } from '../../auth/authContext.js';
import Sidebar from './Sidebar.jsx';
import Toast from './Toast.jsx';
import Topbar from './Topbar.jsx';
import { useHotelCommands, useHotelShellState } from '../../state/hotelContext.js';
import { useWebSocket, useWebSocketEvents } from '../../hooks/useWebSocket.js';
import { useCommunications } from '../../communications/useCommunications.js';
import AdminRouteContent from '../routing/AdminRouteContent.jsx';
import { useAdminNavigation } from '../../hooks/useAdminNavigation.js';

export default function HotelShell() {
  const { account, loggingOut, logout } = useAuth();
  const { can } = usePermissions();
  const shellState = useHotelShellState();
  const { roomCommands } = useHotelCommands();
  const { notifications: communicationNotifications, handleMarkRead, handleMarkAllRead } = useCommunications();
  const { currentView, fallbackRoute, navigate, routeAuthorized, routeIntent, consumeNavigationIntent } = useAdminNavigation(can);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const roomReloadTimerRef = useRef(null);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const notify = useCallback((title, message = '', type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((items) => [...items, { id, title, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4500);
  }, []);

  useWebSocket('notification:new', (notif) => {
    notify(notif.title || 'Nueva Notificación', notif.content || notif.description || '', notif.priority === 'HIGH' ? 'error' : notif.priority === 'MEDIUM' ? 'warning' : 'info');
  });

  useWebSocket('order:created', (order) => {
    notify('🍽️ Nuevo Pedido Entrante', `Comanda #${order.id?.slice(0, 8) || ''} recibida en cocina.`, 'info');
  });

  const scheduleRoomReload = useCallback((room) => {
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

  const pendingOrders = shellState.orders.filter((order) => !['Entregado', 'Pagado', 'Cancelado'].includes(order.status)).length;
  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      notify('No se pudo cerrar la sesión', 'Intentá nuevamente.', 'error');
    }
  };
  return <div className="app-layout"><a className="skip-link" href="#main-content">Saltar al contenido</a><Sidebar currentView={currentView} navigate={navigate} pendingOrdersCount={pendingOrders} open={sidebarOpen} onClose={closeSidebar} account={account} onLogout={handleLogout} loggingOut={loggingOut} /><div className="main-content"><Topbar currentView={currentView} notifications={communicationNotifications.data} menuOpen={sidebarOpen} onMenu={() => setSidebarOpen(true)} onNavigate={navigate} onRead={(notificationId) => { void handleMarkRead(notificationId); }} onReadAll={() => { void handleMarkAllRead(); }} account={account} /><main id="main-content" tabIndex="-1"><AdminRouteContent currentView={currentView} fallbackRoute={fallbackRoute} navigate={navigate} navigationIntent={routeIntent} notify={notify} consumeNavigationIntent={consumeNavigationIntent} routeAuthorized={routeAuthorized} /></main></div><Toast toasts={toasts} removeToast={(id) => setToasts((items) => items.filter(({ id: toastId }) => toastId !== id))} /></div>;
}
