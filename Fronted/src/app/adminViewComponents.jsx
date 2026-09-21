import { createElement, lazy } from 'react';

const named = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const dashboardView = named(() => import('../dashboard/DashboardView'), 'DashboardView');
const reportsView = named(() => import('../reports/ReportsView'), 'ReportsView');
const roomsView = lazy(() => import('../components/views/rooms/RoomsView'));
const reservationsView = lazy(() => import('../components/views/reservations/ReservationsView'));
const checkInOutView = lazy(() => import('../components/views/checkin/CheckInOutView'));
const customersView = lazy(() => import('../components/views/customers/CustomersView'));
const ordersView = lazy(() => import('../components/views/orders/OrdersView'));
const menuManagementView = lazy(() => import('../restaurant/MenuManagementView').then((module) => ({ default: module.MenuManagementView })));
const staffAttendanceView = named(() => import('../views/staff/StaffAttendanceView'), 'StaffAttendanceView');
const staffDirectoryView = named(() => import('../views/staff/StaffDirectoryView'), 'StaffDirectoryView');
const contractsView = lazy(() => import('../documents/views/ContractsView').then((module) => ({ default: module.ContractsView })));
const evidenceView = lazy(() => import('../documents/views/EvidenceView').then((module) => ({ default: module.EvidenceView })));
const auditView = lazy(() => import('../documents/views/AuditView').then((module) => ({ default: module.AuditView })));
const rolesView = named(() => import('../components/views/roles/RolesManagementView'), 'RolesManagementView');
const settingsView = named(() => import('../settings/SettingsView'), 'SettingsView');
const accessAccountsView = lazy(() => import('../components/views/AccessAccountsView'));
const receivablesView = lazy(() => import('../receivables/ReceivablesView'));
const eventsModuleRoot = named(() => import('../events/EventsModuleRoot'), 'EventsModuleRoot');
const suppliersModuleRoot = named(() => import('../suppliers/SuppliersModuleRoot'), 'SuppliersModuleRoot');
const adminNotificationsView = named(() => import('../communications/AdminNotificationsView'), 'AdminNotificationsView');
const parkingView = named(() => import('../parking/ParkingView'), 'P1ParkingView');
const petsView = named(() => import('../pets/PetsView'), 'P1PetsView');
const cleaningView = named(() => import('../cleaning/CleaningView'), 'P1CleaningView');
const recreationView = named(() => import('../amenities/RecreationView'), 'P1RecreationView');
const maintenanceView = named(() => import('../maintenance/MaintenanceView'), 'OperationalMaintenanceView');
const inventoryView = named(() => import('../inventory/InventoryView'), 'OperationalInventoryView');
const cashView = named(() => import('../cash/CashView'), 'OperationalCashView');
const incidentsView = named(() => import('../incidents/IncidentsView'), 'OperationalIncidentsView');

export const VIEW_COMPONENTS = {
  dashboard: dashboardView,
  habitaciones: roomsView,
  reservas: reservationsView,
  contratos: contractsView,
  'checkin-checkout': checkInOutView,
  finanzas: receivablesView,
  clientes: customersView,
  limpieza: cleaningView,
  mantenimiento: maintenanceView,
  incidencias: incidentsView,
  evidencias: evidenceView,
  notificaciones: adminNotificationsView,
  'pedidos-qr': ordersView,
  inventario: inventoryView,
  'cocina-bar': menuManagementView,
  proveedores: suppliersModuleRoot,
  cochera: parkingView,
  mascotas: petsView,
  recreacion: recreationView,
  eventos: () => createElement(eventsModuleRoot, { view: 'list' }),
  'calendario-eventos': () => createElement(eventsModuleRoot, { view: 'calendar' }),
  personal: staffAttendanceView,
  'personal-directorio': staffDirectoryView,
  caja: cashView,
  reportes: reportsView,
  'cuentas-acceso': accessAccountsView,
  roles: rolesView,
  auditoria: auditView,
  configuracion: settingsView,
};
