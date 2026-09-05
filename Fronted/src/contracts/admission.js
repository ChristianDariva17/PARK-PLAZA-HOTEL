import { VALID_ROUTES } from '../components/layout/navigation.js';

const unverifiedAdminContract = (route) => Object.freeze({
  route,
  endpoint: null,
  dto: null,
  session: 'admin',
  permission: null,
  propertyScope: 'unverified',
  errors: [],
  money: 'unverified',
  idempotency: 'unverified',
  invalidates: [],
  approved: false,
  verified: false,
});

const admittedAdminContract = (route, endpoint, dto, permission, idempotency = 'not-applicable', invalidates = []) => Object.freeze({
  route,
  endpoint,
  dto,
  session: 'admin',
  permission,
  propertyScope: 'server-enforced',
  errors: [401, 403, 404, 409, 422],
  money: 'exact-decimal-string',
  idempotency,
  invalidates,
  approved: true,
  verified: true,
});

const admittedAdminContracts = Object.freeze({
  habitaciones: admittedAdminContract('habitaciones', '/api/rooms', 'RoomTransport', 'rooms.read', 'required', ['rooms', 'reservations']),
  reservas: admittedAdminContract('reservas', '/api/reservations', 'ReservationDetailTransport', 'reservations.read', 'required', ['reservations', 'rooms', 'stays']),
  contratos: admittedAdminContract('contratos', '/api/api/documents/contracts', 'ContractTransport', 'DOCUMENTS_READ', 'required', ['contracts', 'evidences']),
  'checkin-checkout': admittedAdminContract('checkin-checkout', '/api/stays', 'StayTransport', 'stays.read', 'required', ['stays', 'rooms', 'folios']),
  finanzas: admittedAdminContract('finanzas', '/api/folios', 'FolioTransport', 'folios.read', 'required', ['folios', 'receivables']),
  clientes: admittedAdminContract('clientes', '/api/guests', 'GuestTransport', 'guests.read', 'required', ['guests', 'reservations', 'stays']),
  limpieza: admittedAdminContract('limpieza', '/api/cleaning', 'CleaningTaskTransport', 'cleaning.read', 'required', ['cleaning', 'rooms']),
  mantenimiento: admittedAdminContract('mantenimiento', '/api/maintenance', 'MaintenanceTransport', 'maintenance.read', 'required', ['maintenance', 'rooms']),
  incidencias: admittedAdminContract('incidencias', '/api/incidents', 'IncidentTransport', 'incidents.read', 'required', ['incidents', 'rooms']),
  evidencias: admittedAdminContract('evidencias', '/api/api/documents/evidences', 'EvidenceTransport', 'EVIDENCE_READ', 'required', ['evidences', 'contracts']),
  notificaciones: admittedAdminContract('notificaciones', '/api/properties/:propertyId/communications', 'NotificationTransport', 'NOTIFICATION_READ', 'not-applicable', ['notifications', 'preferences']),
  'pedidos-qr': admittedAdminContract('pedidos-qr', '/api/restaurant/orders', 'RestaurantOrderTransport', 'restaurant.orders.read', 'required', ['orders', 'inventory', 'folios']),
  inventario: admittedAdminContract('inventario', '/api/restaurant', 'RestaurantInventoryTransport', 'restaurant.inventory.read', 'required', ['inventory', 'menu', 'orders']),
  'cocina-bar': admittedAdminContract('cocina-bar', '/api/restaurant/orders', 'RestaurantOrderTransport', 'restaurant.kitchen.read', 'required', ['orders', 'inventory']),
  proveedores: admittedAdminContract('proveedores', '/api/suppliers', 'SupplierTransport', 'suppliers.read', 'required', ['suppliers']),
  cochera: admittedAdminContract('cochera', '/api/parking', 'ParkingTransport', 'parking.read', 'required', ['parking']),
  mascotas: admittedAdminContract('mascotas', '/api/pets', 'PetTransport', 'pets.read', 'required', ['pets']),
  recreacion: admittedAdminContract('recreacion', '/api/properties/:propertyId/experiences', 'ExperienceTransport', 'ACCESS_SELL', 'not-applicable', ['experiences', 'participations']),
  eventos: admittedAdminContract('eventos', '/api/events', 'EventTransport', 'events.read', 'required', ['events']),
  'calendario-eventos': admittedAdminContract('calendario-eventos', '/api/events', 'EventTransport', 'events.read', 'required', ['events']),
  personal: admittedAdminContract('personal', '/api/attendance', 'AttendanceTransport', 'attendance.read', 'required', ['attendance', 'staff']),
  'personal-directorio': admittedAdminContract('personal-directorio', '/api/staff', 'StaffTransport', 'staff.read', 'required', ['staff', 'attendance']),
  caja: admittedAdminContract('caja', '/api/cash', 'CashSessionTransport', 'cash.read', 'required', ['cash']),
  reportes: admittedAdminContract('reportes', 'derived:session-state', 'OperationalReportTransport', 'reports.read', 'not-applicable', ['rooms', 'reservations', 'stays', 'folios', 'orders', 'inventory', 'events', 'staff', 'cash']),
  'cuentas-acceso': admittedAdminContract('cuentas-acceso', '/api/accounts', 'AccountTransport', 'accounts.read', 'required', ['accounts']),
  roles: admittedAdminContract('roles', '/api/roles', 'RoleTransport', 'roles.read', 'required', ['roles', 'accounts']),
  auditoria: admittedAdminContract('auditoria', '/api/api/documents/audit', 'AuditEventTransport', 'AUDIT_READ', 'not-applicable', ['audit']),
  configuracion: admittedAdminContract('configuracion', '/api/settings', 'SettingsTransport', 'settings.read', 'required', ['settings']),
});

export const adminContractMatrix = Object.freeze(
  Object.fromEntries([...VALID_ROUTES].map((route) => [route, admittedAdminContracts[route] || unverifiedAdminContract(route)])),
);

export function isCompleteContractMatrix(matrix) {
  return Boolean(
    matrix?.route
    && matrix.endpoint
    && matrix.dto
    && matrix.session === 'admin'
    && matrix.permission
    && matrix.propertyScope === 'server-enforced'
    && matrix.errors.length > 0
    && matrix.money === 'exact-decimal-string'
    && ['required', 'not-applicable'].includes(matrix.idempotency)
    && Array.isArray(matrix.invalidates),
  );
}

export function isAdminContractAdmitted(route) {
  const matrix = adminContractMatrix[route];
  return Boolean(matrix?.approved && matrix.verified && isCompleteContractMatrix(matrix));
}
