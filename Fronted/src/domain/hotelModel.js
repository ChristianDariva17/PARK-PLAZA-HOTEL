export const ROOM_CATEGORIES = ['Simple', 'Matrimonial', 'Doble', 'Triple', 'Suite'];
export const ROOM_STATUSES = ['Disponible', 'Reservada', 'Ocupada', 'En limpieza', 'En mantenimiento', 'Bloqueada', 'Fuera de servicio'];
export const RESERVATION_STATUSES = ['Pendiente', 'Confirmada', 'Cliente presente', 'Completada', 'Cancelada', 'No presentado', 'Vencida'];
export const PAYMENT_METHODS = ['Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Transferencia', 'Pasarela de pagos'];
export const ORDER_STATUSES = ['Pedido recibido', 'Confirmado', 'En preparación', 'Listo', 'En camino', 'Entregado', 'Pagado', 'Cancelado'];

export const ROOM_PRICING = {
  Simple: 95,
  Matrimonial: 130,
  Doble: 145,
  Triple: 175,
  Suite: 260,
};

export const PENALTIES = [
  { id: 'PEN-01', name: 'Pérdida de llave', amount: 40, evidenceRequired: false, active: true },
  { id: 'PEN-02', name: 'Limpieza extraordinaria', amount: 120, evidenceRequired: true, active: true },
  { id: 'PEN-03', name: 'Daño de mobiliario', amount: 250, evidenceRequired: true, active: true },
];

export const nightsBetween = (checkIn, checkOut) => {
  const difference = new Date(`${checkOut}T12:00:00`) - new Date(`${checkIn}T12:00:00`);
  return Math.max(1, Math.ceil(difference / 86400000));
};

export const currentCalendarDate = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
export const isReservationArrivalExpired = (reservation, now = new Date()) => {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return reservation.checkIn < date || (reservation.checkIn === date && time > (reservation.arrivalLimit || '23:59'));
};
export const ACTIVE_RESERVATION_STATUSES = ['Pendiente', 'Confirmada', 'Cliente presente'];
export const CLOSED_MAINTENANCE_STATUSES = ['Cerrado'];
export const CLOSED_INCIDENT_STATUSES = ['Cerrada'];

export const dateRangesOverlap = (startA, endA, startB, endB) => startA < endB && endA > startB;

export const findReservationConflict = (state, { roomId, checkIn, checkOut, reservationId = null }) => state.reservations.find((reservation) => (
  reservation.id !== reservationId
  && reservation.roomId === String(roomId)
  && ACTIVE_RESERVATION_STATUSES.includes(reservation.status)
  && dateRangesOverlap(checkIn, checkOut, reservation.checkIn, reservation.checkOut)
));

export const validateReservation = (state, payload, reservationId = null) => {
  const room = state.rooms.find((item) => item.id === String(payload.roomId));
  const guests = Number(payload.guests);
  const extraGuests = Number(payload.extraGuests || 0);
  if (!state.clients.some((item) => item.id === payload.clientId && item.status !== 'Archivado')) return 'Seleccioná un cliente activo.';
  if (!room) return 'Seleccioná una habitación válida.';
  if (!payload.checkIn || !payload.checkOut || payload.checkOut <= payload.checkIn) return 'La salida debe ser posterior al ingreso.';
  if (!Number.isInteger(guests) || guests < 1 || guests > room.capacity) return `La capacidad máxima de la habitación es ${room.capacity}.`;
  if (!Number.isInteger(extraGuests) || extraGuests < 0) return 'La cantidad de personas adicionales no es válida.';
  if (state.maintenanceTickets.some((ticket) => ticket.roomId === room.id && !CLOSED_MAINTENANCE_STATUSES.includes(ticket.status))) return 'La habitación tiene mantenimiento activo.';
  if (['Bloqueada', 'Fuera de servicio'].includes(room.status)) return `La habitación está ${room.status.toLowerCase()}.`;
  if (room.status === 'En limpieza' && payload.checkIn <= currentCalendarDate()) return 'La habitación sigue en limpieza para la fecha de ingreso.';
  const activeStay = state.stays.find((stay) => stay.roomId === room.id && stay.status === 'Activa');
  if (activeStay && dateRangesOverlap(payload.checkIn, payload.checkOut, String(activeStay.checkInAt).slice(0, 10), activeStay.expectedCheckOut)) return `La habitación está ocupada por la estadía ${activeStay.id}.`;
  const conflict = findReservationConflict(state, { ...payload, reservationId });
  return conflict ? `Se superpone con la reserva ${conflict.id}.` : null;
};

export const getReservationAvailability = (state, checkIn, checkOut, reservationId = null) => state.rooms.filter((room) => !validateReservation(state, {
  clientId: state.clients[0]?.id,
  roomId: room.id,
  checkIn,
  checkOut,
  guests: 1,
  extraGuests: 0,
}, reservationId));

export const validateOrder = (state, payload) => {
  if (!payload.items?.length || payload.items.some((item) => !state.recipes.some((recipe) => recipe.id === item.recipeId && recipe.status !== 'Archivada') || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) return 'Agregá al menos un producto activo con cantidad válida.';
  if (!Number.isFinite(Number(payload.estimatedMinutes)) || Number(payload.estimatedMinutes) < 1) return 'Indicá un tiempo estimado válido.';
  if (payload.paymentMethod === 'Cargar a la habitación' && !state.stays.some((stay) => stay.id === payload.stayId && stay.status === 'Activa')) return 'Seleccioná una estadía activa para cargar el pedido.';
  if (!['Habitación', 'Barra', 'Terraza'].includes(payload.source)) return 'Seleccioná un origen válido.';
  return null;
};

export const formatMoney = (amount = 0) => new Intl.NumberFormat('es-PE', {
  style: 'currency', currency: 'PEN', minimumFractionDigits: 2,
}).format(amount);

export const formatDateTime = (value) => (value ? new Date(value).toLocaleString('es-PE') : 'No registrado');

export const getInitialHotelState = () => {
  return {
    rooms: [],
    roomCategories: [],
    roomRequest: { status: 'idle', error: null },
    clients: [],
    guestRequest: { status: 'idle', error: null },
    persistentReservations: [],
    reservationRequest: { status: 'idle', error: null },
    reservationAvailability: null,
    reservationAvailabilityRequest: { status: 'idle', error: null },
    reservationCreateRequest: { status: 'idle', error: null, retryBlocked: false },
    persistentStays: [],
    stayRequest: { status: 'idle', error: null },
    stayCommandRequest: { status: 'idle', error: null, retryBlocked: false },
    reservations: [],
    contracts: [],
    stays: [],
    accounts: [],
    payments: [],
    documents: [],
    cleaningTasks: [],
    maintenanceTickets: [],
    orders: [],
    inventoryLedger: [],
    inventory: [],
    recipes: [],
    managedMenu: [],
    restaurantResources: {
      identityKey: null,
      menu: { status: 'idle', permission: 'orders.read', generation: 0, error: null, updatedAt: null },
      orders: { status: 'idle', permission: 'orders.read', generation: 0, error: null, updatedAt: null },
      inventory: { status: 'idle', permission: 'inventory.read', generation: 0, error: null, updatedAt: null },
      inventoryLedger: { status: 'idle', permission: 'inventory.read', generation: 0, error: null, updatedAt: null },
    },
    menuPendingMutations: [],
    menuImportRequest: { status: 'idle', preview: null, contentHash: null, error: null },
    vehicles: [],
    pets: [],
    recreationAccess: [],
    accessLog: [],
    poolCapacity: 30,
    suppliers: [],
    events: [],
    staff: [],
    staffShifts: [],
    attendanceLog: [],
    cashSessions: [],
    cashMovements: [],
    cashCounts: [],
    incidents: [],
    auditLog: [],
    notifications: [],
    integrations: [],
  };
};

export const selectClientName = (state, clientId) => state.clients.find((client) => client.id === clientId)?.name || 'Sin cliente';
export const selectRoom = (state, roomId) => state.rooms.find((room) => room.id === String(roomId));

export const selectActiveStays = (state) => {
  if (!state) return [];
  const list = [];
  const seenIds = new Set();
  const seenRoomKeys = new Set();

  const addStay = (stay, origin = 'stay') => {
    if (!stay || !stay.id || seenIds.has(String(stay.id))) return;

    // Resolve room by id or number
    const room = (state.rooms || []).find(
      (r) => String(r.id) === String(stay.roomId) || String(r.number) === String(stay.roomId)
    );
    const roomNumber = room?.number || stay.roomNumber || (stay.roomId ? String(stay.roomId) : 'Sin hab.');
    const roomId = room?.id || stay.roomId || null;

    // Resolve reservation and client
    const reservation = (state.persistentReservations || state.reservations || []).find(
      (r) => String(r.id) === String(stay.reservationId)
    );
    const clientId = stay.clientId || reservation?.primaryGuestId || reservation?.clientId || room?.guestId || null;
    const client = (state.clients || []).find((c) => String(c.id) === String(clientId));
    const clientName = client?.name || (client?.firstName ? `${client.firstName} ${client.lastName || ''}`.trim() : null) || room?.guestName || stay.guestName || (client ? 'Cliente registrado' : `Huésped Hab. ${roomNumber}`);

    const record = {
      ...stay,
      id: String(stay.id),
      roomId: roomId ? String(roomId) : null,
      roomNumber: String(roomNumber),
      clientId: clientId ? String(clientId) : null,
      clientName,
      status: stay.status || 'Activa',
      origin,
    };

    list.push(record);
    seenIds.add(record.id);
    if (record.roomId) seenRoomKeys.add(String(record.roomId));
    if (record.roomNumber) seenRoomKeys.add(String(record.roomNumber));
  };

  // 1. Persistent stays from backend API
  (state.persistentStays || [])
    .filter((s) => ['active', 'Activa'].includes(s.status))
    .forEach((s) => addStay(s, 'persistent'));

  // 2. Local stays from prototype state
  (state.stays || [])
    .filter((s) => ['active', 'Activa'].includes(s.status))
    .forEach((s) => addStay(s, 'local'));

  // 3. Occupied rooms in state.rooms (guarantees that ANY occupied room is available as an active stay)
  (state.rooms || [])
    .filter((r) => ['Ocupada', 'occupied'].includes(r.status) || r.statusCode === 'occupied' || Boolean(r.activeStayId))
    .forEach((r) => {
      const alreadyIncluded = (r.id && seenRoomKeys.has(String(r.id))) || (r.number && seenRoomKeys.has(String(r.number)));
      if (!alreadyIncluded) {
        const stayId = r.activeStayId || `EST-${r.number || r.id}`;
        addStay({
          id: stayId,
          roomId: r.id,
          roomNumber: r.number,
          clientId: r.guestId || null,
          status: 'Activa',
          checkInAt: r.checkInAt || new Date().toISOString(),
          expectedCheckOut: r.expectedCheckOut || null,
          synthetic: true,
        }, 'room_occupied');
      }
    });

  return list;
};
export const selectAccountBalance = (account) => {
  const charges = account?.charges.reduce((sum, charge) => sum + charge.amount, 0) || 0;
  const payments = account?.payments.reduce((sum, payment) => sum + payment.amount, 0) || 0;
  return Math.max(0, charges - payments);
};

export const getOrderRequirements = (state, order) => order.items.flatMap((orderItem) => {
  const recipe = state.recipes.find((item) => item.id === orderItem.recipeId);
  return (orderItem.ingredientSnapshot || recipe?.ingredients || []).map((ingredient) => ({
    ...ingredient,
    quantity: ingredient.quantity * orderItem.quantity,
  }));
});

export const getOrderShortages = (state, order) => {
  const requirements = getOrderRequirements(state, order);
  return state.inventory.flatMap((item) => {
    const required = requirements.filter((entry) => entry.inventoryId === item.id).reduce((sum, entry) => sum + entry.quantity, 0);
    const available = item.status === 'Archivado' ? 0 : item.stock - item.reserved;
    return required > available ? [{ inventoryId: item.id, name: item.name, required, available, unit: item.unit }] : [];
  });
};
