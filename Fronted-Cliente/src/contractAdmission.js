export const CUSTOMER_ROUTES = Object.freeze([
  '/', '/habitaciones', '/room-service', '/terraza', '/bar', '/piscina', '/eventos', '/mirador', '/login', '/registro',
]);

const unverifiedCustomerContract = (route) => Object.freeze({
  route,
  endpoint: null,
  dto: null,
  session: 'customer',
  permission: 'customer-session',
  propertyScope: 'unverified',
  errors: [],
  money: 'unverified',
  idempotency: 'unverified',
  invalidates: [],
  approved: false,
  verified: false,
});

const admittedCustomerContract = (route, endpoint, dto, idempotency = 'not-applicable', invalidates = []) => Object.freeze({
  route,
  endpoint,
  dto,
  session: 'customer',
  permission: 'customer-session',
  propertyScope: 'server-enforced',
  errors: [401, 403, 404, 409, 422],
  money: 'exact-decimal-string',
  idempotency,
  invalidates,
  approved: true,
  verified: true,
});

const admittedCustomerContracts = Object.freeze({
  '/': admittedCustomerContract('/', '/api/customer/home', 'CustomerHomeTransport', 'not-applicable'),
  '/habitaciones': admittedCustomerContract('/habitaciones', '/api/customer/reservations', 'CustomerReservationTransport', 'required', ['availability', 'booking']),
  '/room-service': admittedCustomerContract('/room-service', '/api/customer/restaurant', 'CustomerRestaurantOrderTransport', 'required', ['menu', 'orders', 'active-stays']),
  '/terraza': admittedCustomerContract('/terraza', '/api/customer/amenities/reservations', 'CustomerAmenityReservationTransport', 'not-applicable', ['amenity-reservations']),
  '/bar': admittedCustomerContract('/bar', '/api/customer/amenities/reservations', 'CustomerAmenityReservationTransport', 'not-applicable', ['amenity-reservations']),
  '/piscina': admittedCustomerContract('/piscina', '/api/customer/amenities/reservations', 'CustomerAmenityReservationTransport', 'not-applicable', ['amenity-reservations']),
  '/eventos': admittedCustomerContract('/eventos', '/api/customer/events', 'CustomerEventTransport', 'required', ['customer-events', 'event-availability']),
  '/mirador': admittedCustomerContract('/mirador', '/api/customer/amenities/reservations', 'CustomerAmenityReservationTransport', 'not-applicable', ['amenity-reservations']),
  '/login': admittedCustomerContract('/login', '/api/customer/auth/session', 'CustomerSessionTransport', 'not-applicable', ['customer-session']),
  '/registro': admittedCustomerContract('/registro', '/api/customer/auth/session', 'CustomerSessionTransport', 'not-applicable', ['customer-session']),
});

export const customerContractMatrix = Object.freeze(
  Object.fromEntries(CUSTOMER_ROUTES.map((route) => [route, admittedCustomerContracts[route] || unverifiedCustomerContract(route)])),
);

export function isCustomerContractAdmitted(route) {
  const matrix = customerContractMatrix[route];
  return Boolean(
    matrix?.approved && matrix.verified && matrix.endpoint && matrix.dto
    && matrix.session === 'customer' && matrix.propertyScope === 'server-enforced'
    && matrix.errors.length > 0 && matrix.money === 'exact-decimal-string'
    && ['required', 'not-applicable'].includes(matrix.idempotency),
  );
}
