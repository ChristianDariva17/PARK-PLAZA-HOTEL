import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Bell, CalendarPlus, CheckCheck, Clock3, Menu, Search, X } from 'lucide-react';
import GlobalSearch from './GlobalSearch';
import { getAccountInitials, getRoleLabel } from '../../auth/authContext';
import { usePermissions } from '../../auth/authContext';
import { PERMISSIONS } from '../../auth/permissions';
import { canAccessRoute } from './navigation';

const TITLES = {
  dashboard: ['Panel operativo', 'Resumen del estado compartido'], habitaciones: ['Habitaciones', 'Mapa y detalle operativo'], reservas: ['Reservas', 'Disponibilidad, precio y adelantos'],
  contratos: ['Contratos', 'Versionado y trazabilidad'], 'checkin-checkout': ['Recepción', 'Check-in y check-out conectados'], finanzas: ['Pagos y cuentas', 'Liquidación y documentos'],
  clientes: ['Clientes', 'Perfil e historial'], limpieza: ['Limpieza', 'Tareas, evidencias y aprobación'], mantenimiento: ['Mantenimiento', 'Tickets y habitaciones bloqueadas'],
  incidencias: ['Incidencias', 'Cola unificada de seguimiento'], evidencias: ['Evidencias', 'Referencias operativas unificadas'], notificaciones: ['Notificaciones', 'Bandeja interna de alertas'],
  'pedidos-qr': ['Pedidos QR', 'Cocina, entrega e inventario'], inventario: ['Inventario', 'Stock, lotes y movimientos'],
  'cocina-bar': ['Cocina y bar', 'Recetas, licores y onzas'], proveedores: ['Proveedores', 'Abastecimiento y costos'], cochera: ['Cochera', 'Vehículos y espacios'],
  mascotas: ['Mascotas', 'Alojamiento y cargos'], recreacion: ['Piscina y mirador', 'Accesos QR y aforo'], eventos: ['Eventos', 'Agenda y espacios'], 'calendario-eventos': ['Calendario de eventos', 'Fechas, horarios y espacios'],
  personal: ['Personal', 'Asistencia y turnos'], caja: ['Caja', 'Apertura y movimientos'], reportes: ['Reportes', 'Indicadores derivados'], roles: ['Roles y permisos', 'Matriz funcional'],
  auditoria: ['Auditoría y seguridad', 'Actividad y controles'], configuracion: ['Configuración', 'Integraciones y respaldos'],
};

export default function Topbar({ currentView, state, notifications, menuOpen, onMenu, onNavigate, onRead, onReadAll, account }) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const panelRef = useRef(null);
  const notificationTriggerRef = useRef(null);
  const notificationPanelId = useId();
  const [title, subtitle] = TITLES[currentView] || ['Hotel Park Plaza', 'Sistema integral de gestión'];
  const canSearch = [PERMISSIONS.guestsRead, PERMISSIONS.reservationsRead, PERMISSIONS.roomsRead, PERMISSIONS.ordersRead].some(can);
  const authorizedNotifications = useMemo(() => notifications.filter((item) => canAccessRoute(can, item.route)), [can, notifications]);
  const unreadNotificationIds = authorizedNotifications.filter((item) => !item.read).map((item) => item.id);
  const unread = unreadNotificationIds.length;

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (!panelRef.current?.contains(event.target)) {
        setOpen(false);
        notificationTriggerRef.current?.focus();
      }
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      notificationTriggerRef.current?.focus();
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!canSearch) return undefined;
    const openSearch = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', openSearch);
    return () => document.removeEventListener('keydown', openSearch);
  }, [canSearch]);

  return <header className="topbar">
    <div className="topbar-left">
      <button type="button" className="icon-button menu-button" onClick={onMenu} aria-label="Abrir navegación" aria-expanded={menuOpen} aria-controls="primary-navigation"><Menu size={22} aria-hidden="true" /></button>
      <div className="topbar-title-group"><h1>{title}</h1><p>{subtitle}</p></div>
    </div>
    <div className="topbar-right">
      <div className="topbar-datetime" aria-label="Fecha y hora actuales"><Clock3 size={16} aria-hidden="true" /><time dateTime={now.toISOString()}><strong>{now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</strong><span>{now.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}</span></time></div>
      {canSearch ? <button type="button" className="global-search-trigger" onClick={() => setSearchOpen(true)} aria-haspopup="dialog"><Search size={17} aria-hidden="true" /><span>Buscar en el hotel</span><kbd>Ctrl K</kbd></button> : null}
      {can(PERMISSIONS.notificationsRead) ? <div className="notification-wrap" ref={panelRef}>
        <button ref={notificationTriggerRef} className="topbar-bell-btn" aria-label={`Notificaciones: ${unread} sin leer`} aria-expanded={open} aria-controls={notificationPanelId} onClick={() => setOpen((value) => !value)}><Bell size={18} />{unread ? <span className="bell-badge">{unread}</span> : null}</button>
        {open ? <section id={notificationPanelId} className="notification-panel" aria-label="Notificaciones internas"><header><span><strong>Notificaciones internas</strong><small>{unread} sin leer · canal local</small></span><button className="icon-button" aria-label="Cerrar notificaciones" onClick={() => { setOpen(false); notificationTriggerRef.current?.focus(); }}><X size={16} /></button></header><div>{authorizedNotifications.length ? authorizedNotifications.map((item) => <button key={item.id} className={item.read ? 'read' : ''} onClick={() => { if (!item.read && can(PERMISSIONS.notificationsUpdate)) onRead(item.id); onNavigate(item.route); setOpen(false); notificationTriggerRef.current?.focus(); }}><strong>{item.title}</strong><span>{item.description}</span><small>{item.read ? 'Leída' : 'Sin leer'} · destino {item.route}</small></button>) : <p>Sin notificaciones internas.</p>}</div>{can(PERMISSIONS.notificationsUpdate) ? <footer><button className="btn btn-sm btn-outline" disabled={!unread} onClick={() => onReadAll(unreadNotificationIds)}><CheckCheck size={15} /> Marcar leídas</button></footer> : null}</section> : null}
      </div> : null}
      {can(PERMISSIONS.reservationsCreate) ? <button className="btn btn-primary topbar-cta" onClick={() => onNavigate('reservas', { type: 'create-reservation' })}><CalendarPlus size={17} /><span>Nueva reserva</span></button> : null}
       <div className="topbar-profile"><span className="topbar-avatar">{getAccountInitials(account.email)}</span><span><strong>{account.email}</strong><small>{getRoleLabel(account.role)}</small></span></div>
    </div>
    <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} state={state} onNavigate={onNavigate} can={can} />
  </header>;
}
