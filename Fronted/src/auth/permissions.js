export const PERMISSIONS = Object.freeze({
  dashboardRead: 'dashboard.read',
  accountsRead: 'accounts.read', accountsManage: 'accounts.manage',
  rolesRead: 'roles.read', rolesManage: 'roles.manage', auditRead: 'audit.read',
  roomsRead: 'rooms.read', roomsUpdate: 'rooms.update', roomsBlock: 'rooms.block',
  reservationsRead: 'reservations.read', reservationsCreate: 'reservations.create', reservationsUpdate: 'reservations.update', reservationsCancel: 'reservations.cancel',
  contractsRead: 'contracts.read', contractsAmend: 'contracts.amend', contractsVoid: 'contracts.void',
  staysRead: 'stays.read', staysCheckIn: 'stays.check_in', staysCheckOut: 'stays.check_out', staysCheckOutOverride: 'stays.check_out_override',
  financeRead: 'finance.read', financeCharge: 'finance.charge', financePayment: 'finance.payment', financeReverse: 'finance.reverse',
  guestsRead: 'guests.read', guestsCreate: 'guests.create', guestsUpdate: 'guests.update', guestsArchive: 'guests.archive', guestsBiometric: 'guests.biometric',
  cleaningRead: 'cleaning.read', cleaningAssign: 'cleaning.assign', cleaningProgress: 'cleaning.progress', cleaningReportIncident: 'cleaning.report_incident',
  maintenanceRead: 'maintenance.read', maintenanceCreate: 'maintenance.create', maintenanceUpdate: 'maintenance.update', maintenanceProgress: 'maintenance.progress',
  incidentsRead: 'incidents.read', incidentsCreate: 'incidents.create', incidentsUpdate: 'incidents.update', incidentsProgress: 'incidents.progress',
  evidenceRead: 'evidence.read', notificationsRead: 'notifications.read', notificationsUpdate: 'notifications.update',
  ordersRead: 'orders.read', ordersCreate: 'orders.create', ordersUpdate: 'orders.update', ordersAdvance: 'orders.advance', ordersCancel: 'orders.cancel',
  kitchenRead: 'kitchen.read', kitchenCreate: 'kitchen.create', kitchenUpdate: 'kitchen.update', kitchenArchive: 'kitchen.archive',
  inventoryRead: 'inventory.read', inventoryCreate: 'inventory.create', inventoryUpdate: 'inventory.update', inventoryAdjust: 'inventory.adjust', inventoryArchive: 'inventory.archive',
  suppliersRead: 'suppliers.read', suppliersCreate: 'suppliers.create', suppliersUpdate: 'suppliers.update', suppliersArchive: 'suppliers.archive', suppliersReactivate: 'suppliers.reactivate',
  parkingRead: 'parking.read', parkingCreate: 'parking.create', parkingUpdate: 'parking.update', parkingExit: 'parking.exit', parkingArchive: 'parking.archive',
  petsRead: 'pets.read', petsCreate: 'pets.create', petsUpdate: 'pets.update', petsArchive: 'pets.archive',
  recreationRead: 'recreation.read', recreationSell: 'recreation.sell', recreationScan: 'recreation.scan', recreationManual: 'recreation.manual',
  eventsRead: 'events.read', eventsCreate: 'events.create', eventsUpdate: 'events.update', eventsConfirm: 'events.confirm', eventsCancel: 'events.cancel', eventsArchive: 'events.archive',
  staffRead: 'staff.read', staffCreate: 'staff.create', staffUpdate: 'staff.update', staffArchive: 'staff.archive', staffShifts: 'staff.shifts', staffAttendance: 'staff.attendance', staffBiometric: 'staff.biometric',
  staffAttendanceManual: 'staff.attendance.manual', staffAttendanceCorrect: 'staff.attendance.correct', staffAttendanceApprove: 'staff.attendance.approve', staffAttendanceRead: 'staff.attendance.read',
  cashRead: 'cash.read', cashOpen: 'cash.open', cashMove: 'cash.move', cashCount: 'cash.count', cashClose: 'cash.close',
  reportsRead: 'reports.read', settingsRead: 'settings.read',
});

export const ROUTE_PERMISSIONS = Object.freeze({
  dashboard: PERMISSIONS.dashboardRead, habitaciones: PERMISSIONS.roomsRead, reservas: PERMISSIONS.reservationsRead,
  contratos: PERMISSIONS.contractsRead, 'checkin-checkout': PERMISSIONS.staysRead, finanzas: PERMISSIONS.financeRead,
  clientes: PERMISSIONS.guestsRead, limpieza: PERMISSIONS.cleaningRead, mantenimiento: PERMISSIONS.maintenanceRead,
  incidencias: PERMISSIONS.incidentsRead, evidencias: PERMISSIONS.evidenceRead, notificaciones: PERMISSIONS.notificationsRead,
  'pedidos-qr': PERMISSIONS.ordersRead, inventario: PERMISSIONS.inventoryRead, 'cocina-bar': PERMISSIONS.ordersRead,
  proveedores: PERMISSIONS.suppliersRead,
  cochera: PERMISSIONS.parkingRead, mascotas: PERMISSIONS.petsRead, recreacion: PERMISSIONS.recreationRead,
  eventos: PERMISSIONS.eventsRead, 'calendario-eventos': PERMISSIONS.eventsRead,
  personal: PERMISSIONS.staffRead, 'personal-directorio': PERMISSIONS.staffRead, caja: PERMISSIONS.cashRead, reportes: PERMISSIONS.reportsRead,
  'cuentas-acceso': PERMISSIONS.accountsRead, roles: PERMISSIONS.rolesRead, auditoria: PERMISSIONS.auditRead, configuracion: PERMISSIONS.settingsRead,
});

const ACTION_PERMISSIONS = Object.freeze({
  ACCOUNT_CREATE: PERMISSIONS.accountsManage,
  CLIENT_CREATE: PERMISSIONS.guestsCreate, CLIENT_UPDATE: PERMISSIONS.guestsUpdate, CLIENT_ARCHIVE: PERMISSIONS.guestsArchive, CLIENT_REACTIVATE: PERMISSIONS.guestsArchive,
  ROOM_UPDATE: PERMISSIONS.roomsUpdate, ROOM_BLOCK: PERMISSIONS.roomsBlock, ROOM_UNBLOCK: PERMISSIONS.roomsBlock,
  RESERVATION_CONFIRM: PERMISSIONS.reservationsCreate, RESERVATION_UPDATE: PERMISSIONS.reservationsUpdate, RESERVATION_STATUS: PERMISSIONS.reservationsCancel,
  CHECK_IN: PERMISSIONS.staysCheckIn, CHECK_OUT: PERMISSIONS.staysCheckOut,
  CONTRACT_ADDENDUM: PERMISSIONS.contractsAmend, CONTRACT_VOID: PERMISSIONS.contractsVoid,
  ACCOUNT_CHARGE: PERMISSIONS.financeCharge, PENALTY_CHARGE: PERMISSIONS.financeCharge, ACCOUNT_PAYMENT: PERMISSIONS.financePayment, MOVEMENT_VOID: PERMISSIONS.financeReverse,
  CLEANING_ASSIGN: PERMISSIONS.cleaningAssign, CLEANING_UPDATE: PERMISSIONS.cleaningAssign, CLEANING_PROGRESS: PERMISSIONS.cleaningProgress, CLEANING_INCIDENT: PERMISSIONS.cleaningReportIncident,
  MAINTENANCE_CREATE: PERMISSIONS.maintenanceCreate, MAINTENANCE_UPDATE: PERMISSIONS.maintenanceUpdate, MAINTENANCE_PROGRESS: PERMISSIONS.maintenanceProgress, MAINTENANCE_REOPEN: PERMISSIONS.maintenanceProgress,
  INCIDENT_CREATE: PERMISSIONS.incidentsCreate, INCIDENT_UPDATE: PERMISSIONS.incidentsUpdate, INCIDENT_PROGRESS: PERMISSIONS.incidentsProgress, INCIDENT_REOPEN: PERMISSIONS.incidentsProgress,
  EVIDENCE_REGISTER: PERMISSIONS.evidenceRead,
  NOTIFICATION_READ: PERMISSIONS.notificationsRead, NOTIFICATIONS_READ_ALL: PERMISSIONS.notificationsUpdate, NOTIFICATIONS_READ_AUTHORIZED: PERMISSIONS.notificationsRead,
  ORDER_CREATE: PERMISSIONS.ordersCreate, ORDER_UPDATE: PERMISSIONS.ordersUpdate, ORDER_ADVANCE: PERMISSIONS.ordersAdvance, ORDER_CANCEL: PERMISSIONS.ordersCancel,
  RECIPE_CREATE: PERMISSIONS.kitchenCreate, RECIPE_UPDATE: PERMISSIONS.kitchenUpdate, RECIPE_ARCHIVE: PERMISSIONS.kitchenArchive, RECIPE_REACTIVATE: PERMISSIONS.kitchenArchive,
  INVENTORY_ITEM_CREATE: PERMISSIONS.inventoryCreate, INVENTORY_ITEM_UPDATE: PERMISSIONS.inventoryUpdate, INVENTORY_ADJUST: PERMISSIONS.inventoryAdjust, INVENTORY_ITEM_ARCHIVE: PERMISSIONS.inventoryArchive,
  SUPPLIER_CREATE: PERMISSIONS.suppliersCreate, SUPPLIER_UPDATE: PERMISSIONS.suppliersUpdate, SUPPLIER_ARCHIVE: PERMISSIONS.suppliersArchive, SUPPLIER_REACTIVATE: PERMISSIONS.suppliersReactivate,
  PARKING_CREATE: PERMISSIONS.parkingCreate, PARKING_UPDATE: PERMISSIONS.parkingUpdate, PARKING_EXIT: PERMISSIONS.parkingExit, PARKING_ARCHIVE: PERMISSIONS.parkingArchive,
  PET_CREATE: PERMISSIONS.petsCreate, PET_UPDATE: PERMISSIONS.petsUpdate, PET_ARCHIVE: PERMISSIONS.petsArchive, PET_REACTIVATE: PERMISSIONS.petsArchive,
  ACCESS_SELL: PERMISSIONS.recreationSell, ACCESS_SCAN: PERMISSIONS.recreationScan, ACCESS_MANUAL: PERMISSIONS.recreationManual,
  EVENT_CREATE: PERMISSIONS.eventsCreate, EVENT_UPDATE: PERMISSIONS.eventsUpdate, EVENT_CONFIRM: PERMISSIONS.eventsConfirm, EVENT_CANCEL: PERMISSIONS.eventsCancel, EVENT_ARCHIVE: PERMISSIONS.eventsArchive,
  STAFF_CREATE: PERMISSIONS.staffCreate, STAFF_UPDATE: PERMISSIONS.staffUpdate, STAFF_ARCHIVE: PERMISSIONS.staffArchive, STAFF_REACTIVATE: PERMISSIONS.staffArchive,
  SHIFT_CREATE: PERMISSIONS.staffShifts, SHIFT_UPDATE: PERMISSIONS.staffShifts, SHIFT_CANCEL: PERMISSIONS.staffShifts,
  STAFF_ATTENDANCE_VERIFIED: PERMISSIONS.staffAttendance, STAFF_ATTENDANCE_MANUAL: PERMISSIONS.staffAttendanceManual,
  CASH_OPEN: PERMISSIONS.cashOpen, CASH_MOVEMENT: PERMISSIONS.cashMove, CASH_COUNT: PERMISSIONS.cashCount, CASH_CLOSE: PERMISSIONS.cashClose,
  ROLE_CREATE: PERMISSIONS.rolesManage, ROLE_UPDATE: PERMISSIONS.rolesManage, ROLE_DELETE: PERMISSIONS.rolesManage,
});

export const hasPermission = (permissions, permission) => Boolean(permission && permissions?.includes(permission));
export const permissionForRoute = (route) => ROUTE_PERMISSIONS[route] || null;
const PRIMARY_ACTION_PERMISSIONS = Object.freeze({
  'cuentas-acceso': { 'Crear cuenta': PERMISSIONS.accountsManage },
  roles: { 'Crear Nuevo Rol': PERMISSIONS.rolesManage, 'Crear rol': PERMISSIONS.rolesManage },
  habitaciones: { 'Editar maestro': PERMISSIONS.roomsUpdate, Bloquear: PERMISSIONS.roomsBlock, Desbloquear: PERMISSIONS.roomsBlock },
  reservas: { 'Nueva reserva': PERMISSIONS.reservationsCreate, Editar: PERMISSIONS.reservationsUpdate, Cancelar: PERMISSIONS.reservationsCancel },
  clientes: { 'Registrar cliente': PERMISSIONS.guestsCreate, Editar: PERMISSIONS.guestsUpdate, Archivar: PERMISSIONS.guestsArchive, Reactivar: PERMISSIONS.guestsArchive },
  'pedidos-qr': { 'Nuevo pedido': PERMISSIONS.ordersCreate, Editar: PERMISSIONS.ordersUpdate, Avanzar: PERMISSIONS.ordersAdvance, Cancelar: PERMISSIONS.ordersCancel },
  'personal-directorio': { 'Registrar personal': PERMISSIONS.staffCreate, 'Nuevo personal': PERMISSIONS.staffCreate },
  personal: { 'Registrar personal': PERMISSIONS.staffCreate, 'Nuevo personal': PERMISSIONS.staffCreate },
});
export const permissionForPrimaryAction = (route, label) => PRIMARY_ACTION_PERMISSIONS[route]?.[label] || null;
export const permissionForAction = (action) => {
  if (action?.type === 'BIOMETRIC_ENROLLED') return action.subjectType === 'employee' ? PERMISSIONS.staffBiometric : PERMISSIONS.guestsBiometric;
  if (action?.type === 'BIOMETRIC_ATTEMPT') return action.subjectType === 'employee' ? PERMISSIONS.staffBiometric : action.subjectType === 'client' ? PERMISSIONS.guestsBiometric : null;
  return ACTION_PERMISSIONS[action?.type] || null;
};

/**
 * Returns true when the permissions array contains ALL THREE kitchen management
 * permissions required by GET /internal/menu, preview, and apply endpoints.
 * The backend uses required.every(...); this predicate mirrors that semantics.
 */
export const hasKitchenManagementAccess = (permissions) =>
  Boolean(permissions?.includes(PERMISSIONS.kitchenCreate) &&
          permissions?.includes(PERMISSIONS.kitchenUpdate) &&
          permissions?.includes(PERMISSIONS.kitchenArchive));
