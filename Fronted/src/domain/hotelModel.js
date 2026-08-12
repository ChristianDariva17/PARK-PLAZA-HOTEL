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

const floorRooms = { 1: 8, 2: 8, 3: 11, 4: 11 };
const seededStatuses = {
  101: 'Ocupada', 103: 'En limpieza', 108: 'En mantenimiento',
  201: 'Ocupada', 207: 'Bloqueada',
  309: 'En limpieza', 405: 'Fuera de servicio',
};

export const createRooms = () => Object.entries(floorRooms).flatMap(([floorValue, count]) => {
  const floor = Number(floorValue);
  return Array.from({ length: count }, (_, index) => {
    const id = floor * 100 + index + 1;
    const category = ROOM_CATEGORIES[(id + floor) % ROOM_CATEGORIES.length];
    const capacity = { Simple: 1, Matrimonial: 2, Doble: 2, Triple: 3, Suite: 4 }[category];
    return {
      id: String(id),
      floor,
      category,
      status: seededStatuses[id] || 'Disponible',
      nightlyRate: ROOM_PRICING[category] + (floor >= 3 ? 15 : 0),
      capacity,
      beds: category === 'Doble' ? '2 individuales' : category === 'Suite' ? '1 king + sofá cama' : '1 cama',
      amenities: { airConditioning: id % 4 !== 0, television: true, hotWater: true, wifi: true, minibar: category === 'Suite' },
      guestId: null,
      activeStayId: null,
      checkInAt: null,
      expectedCheckOut: null,
      balance: 0,
      cleaningStatus: seededStatuses[id] === 'En limpieza' ? 'Pendiente' : 'Aprobada',
      operationalBlock: seededStatuses[id] === 'Bloqueada',
      incidentIds: [],
    };
  });
});

const isoDate = (offset = 0) => {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
};

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

export const getInitialHotelState = () => {
  const rooms = createRooms().map((room) => {
    if (room.id === '101') return { ...room, guestId: 'CLI-001', activeStayId: 'EST-001', checkInAt: isoDate(-1), expectedCheckOut: isoDate(1), balance: 350 };
    if (room.id === '201') return { ...room, guestId: 'CLI-002', activeStayId: 'EST-002', checkInAt: isoDate(-2), expectedCheckOut: isoDate(2), balance: 715 };
    if (room.id === '108') return { ...room, incidentIds: ['INC-003'] };
    if (room.id === '405') return { ...room, incidentIds: ['INC-001'] };
    return room;
  });

  return {
    rooms,
    clients: [
      { id: 'CLI-001', documentType: 'DNI', documentNumber: '72345678', firstName: 'María', lastName: 'González', name: 'María González', phone: '+51 987 654 321', email: 'maria.gonzalez@correo.pe', address: 'Av. Los Pinos 245, Lima', nationality: 'Peruana', birthDate: '1988-04-12', emergencyContact: 'Ana González · +51 955 400 123', notes: 'Prefiere habitaciones silenciosas.', preferences: ['Piso alto', 'Almohada hipoalergénica'], visits: 6, totalSpent: 8420, loyaltyTier: 'Oro', loyaltyPoints: 7550, promoAuth: true, petIds: ['PET-001'], rating: 4.8, status: 'Activo' },
      { id: 'CLI-002', documentType: 'Pasaporte', documentNumber: 'PA894210', firstName: 'Carlos', lastName: 'Ramírez', name: 'Carlos Ramírez', phone: '+51 922 301 776', email: 'carlos.ramirez@correo.pe', address: 'Miraflores, Lima', nationality: 'Colombiana', birthDate: '1985-09-02', emergencyContact: 'Laura Ramírez · +57 310 555 2040', notes: 'Viaja por trabajo.', preferences: ['Desayuno temprano'], visits: 3, totalSpent: 4350, loyaltyTier: 'Plata', loyaltyPoints: 3200, promoAuth: false, petIds: [], rating: 4.5, status: 'Activo' },
      { id: 'CLI-003', documentType: 'DNI', documentNumber: '40122887', firstName: 'Ana', lastName: 'Torres', name: 'Ana Torres', phone: '+51 944 112 209', email: 'ana.torres@correo.pe', address: 'San Borja, Lima', nationality: 'Peruana', birthDate: '1992-11-18', emergencyContact: 'Luis Torres · +51 966 212 555', notes: '', preferences: ['Habitación matrimonial'], visits: 1, totalSpent: 780, loyaltyTier: 'Bronce', loyaltyPoints: 780, promoAuth: true, petIds: [], rating: 5, status: 'Activo' },
    ],
    reservations: [
      { id: 'RES-000', clientId: 'CLI-001', roomId: '101', category: 'Doble', checkIn: isoDate(-1), checkOut: isoDate(1), nights: 2, guests: 2, extraGuests: 0, petIds: ['PET-001'], services: ['Piscina'], nightlyRate: 145, total: 350, advance: 0, balance: 350, status: 'Cliente presente', contractId: 'HP-2026-000000', arrivalLimit: '20:00', paymentMethod: 'Tarjeta' },
      { id: 'RES-001', clientId: 'CLI-003', roomId: '102', category: 'Triple', checkIn: isoDate(1), checkOut: isoDate(3), nights: 2, guests: 2, extraGuests: 0, petIds: [], services: ['Desayuno'], nightlyRate: 175, total: 370, advance: 185, balance: 185, status: 'Confirmada', contractId: 'HP-2026-000001', arrivalLimit: '20:00', paymentMethod: 'Yape' },
      { id: 'RES-002', clientId: 'CLI-002', roomId: '202', category: 'Suite', checkIn: isoDate(4), checkOut: isoDate(6), nights: 2, guests: 2, extraGuests: 0, petIds: [], services: [], nightlyRate: 260, total: 520, advance: 260, balance: 260, status: 'Confirmada', contractId: 'HP-2026-000002', arrivalLimit: '21:00', paymentMethod: 'Tarjeta' },
      { id: 'RES-003', clientId: 'CLI-002', roomId: '201', category: 'Triple', checkIn: isoDate(-2), checkOut: isoDate(2), nights: 4, guests: 1, extraGuests: 0, petIds: [], services: ['Cochera'], nightlyRate: 175, total: 715, advance: 0, balance: 715, status: 'Cliente presente', contractId: 'HP-2026-000003', arrivalLimit: '20:00', paymentMethod: 'Efectivo' },
    ],
    contracts: [
      { id: 'HP-2026-000001', reservationId: 'RES-001', clientId: 'CLI-003', roomId: '102', status: 'Pendiente de firma', version: 1, generatedAt: new Date().toISOString(), signedDocument: null, versions: [{ version: 1, reason: 'Generación por confirmación de reserva' }] },
      { id: 'HP-2026-000002', reservationId: 'RES-002', clientId: 'CLI-002', roomId: '202', status: 'Pendiente de firma', version: 1, generatedAt: new Date().toISOString(), signedDocument: null, versions: [{ version: 1, reason: 'Generación por confirmación de reserva' }] },
      { id: 'HP-2026-000000', reservationId: 'RES-000', clientId: 'CLI-001', roomId: '101', status: 'Firmado', version: 1, generatedAt: new Date().toISOString(), signedDocument: 'Registro local de demostración', versions: [{ version: 1, reason: 'Contrato inicial firmado' }] },
      { id: 'HP-2026-000003', reservationId: 'RES-003', clientId: 'CLI-002', roomId: '201', status: 'Firmado', version: 1, generatedAt: new Date().toISOString(), signedDocument: 'Registro local de demostración', versions: [{ version: 1, reason: 'Contrato inicial firmado' }] },
    ],
    stays: [
      { id: 'EST-001', reservationId: 'RES-000', clientId: 'CLI-001', roomId: '101', accountId: 'CTA-001', status: 'Activa', checkInAt: isoDate(-1), expectedCheckOut: isoDate(1), accessIds: ['ACC-001'] },
      { id: 'EST-002', reservationId: 'RES-003', clientId: 'CLI-002', roomId: '201', accountId: 'CTA-002', status: 'Activa', checkInAt: isoDate(-2), expectedCheckOut: isoDate(2), accessIds: [] },
    ],
    accounts: [
      { id: 'CTA-001', stayId: 'EST-001', roomId: '101', status: 'Abierta', charges: [{ id: 'CAR-001', concept: 'Hospedaje', category: 'Hospedaje', amount: 290, createdAt: isoDate(-1) }, { id: 'CAR-002', concept: 'Piscina · 2 personas', category: 'Piscina', amount: 60, createdAt: isoDate(-1) }], payments: [] },
      { id: 'CTA-002', stayId: 'EST-002', roomId: '201', status: 'Abierta', charges: [{ id: 'CAR-003', concept: 'Hospedaje', category: 'Hospedaje', amount: 700, createdAt: isoDate(-2) }, { id: 'CAR-004', concept: 'Cochera', category: 'Cochera', amount: 15, createdAt: isoDate(-1) }], payments: [] },
    ],
    payments: [
      { id: 'PAG-001', clientId: 'CLI-003', reservationId: 'RES-001', accountId: null, orderId: null, amount: 185, method: 'Yape', operationNumber: 'YAP-741205', status: 'Registrado', concept: 'Adelanto 50 %', createdAt: new Date().toISOString(), responsible: 'Recepción demo' },
      { id: 'PAG-002', clientId: 'CLI-002', reservationId: 'RES-002', accountId: null, orderId: null, amount: 260, method: 'Tarjeta', operationNumber: 'POS-102985', status: 'Registrado', concept: 'Adelanto 50 %', createdAt: new Date().toISOString(), responsible: 'Recepción demo' },
    ],
    documents: [
      { id: 'DOC-001', type: 'Comprobante de adelanto', referenceId: 'RES-001', status: 'Borrador interno', fiscalStatus: 'Integración fiscal pendiente' },
      { id: 'DOC-002', type: 'Contrato de hospedaje', referenceId: 'HP-2026-000001', status: 'Generado', fiscalStatus: 'No aplica' },
    ],
    cleaningTasks: [
      { id: 'LIM-001', roomId: '103', status: 'Pendiente', assignedTo: 'Teresa Quispe', reason: 'Salida de huésped', startedAt: null, completedAt: null, evidence: [] },
      { id: 'LIM-002', roomId: '309', status: 'En proceso', assignedTo: 'Patricia López', reason: 'Limpieza profunda', startedAt: new Date().toISOString(), completedAt: null, evidence: [] },
    ],
    maintenanceTickets: [
      { id: 'MAN-001', roomId: '108', type: 'Aire acondicionado', description: 'Equipo sin respuesta; habitación bloqueada preventivamente.', priority: 'Alta', assignedTo: 'Carlos Méndez', status: 'En reparación', severe: false, evidence: ['Diagnóstico inicial registrado'], solution: '' },
      { id: 'MAN-002', roomId: '405', type: 'Electricidad', description: 'Falla de tablero eléctrico.', priority: 'Urgente', assignedTo: 'Jorge Herrera', status: 'Asignado', severe: true, evidence: ['Reporte técnico pendiente'], solution: '' },
    ],
    orders: [
      { id: 'PED-001', stayId: 'EST-001', roomId: '101', source: 'Habitación', items: [{ recipeId: 'REC-001', name: 'Sándwich club', quantity: 1, price: 32, ingredientSnapshot: [{ inventoryId: 'INV-001', quantity: 2 }, { inventoryId: 'INV-002', quantity: 120 }, { inventoryId: 'INV-005', quantity: 30 }] }], total: 32, paymentMethod: 'Cargar a la habitación', status: 'Pedido recibido', inventoryStage: 'Sin reservar', accountingStage: 'Pendiente', comment: 'Sin mayonesa', estimatedMinutes: 25 },
      { id: 'PED-002', stayId: null, roomId: null, source: 'Barra', items: [{ recipeId: 'REC-002', name: 'Mojito', quantity: 2, price: 28, ingredientSnapshot: [{ inventoryId: 'INV-003', quantity: 1.5 }, { inventoryId: 'INV-004', quantity: 1 }] }], total: 56, paymentMethod: 'Tarjeta', status: 'En preparación', inventoryStage: 'Reservado', accountingStage: 'Pendiente', comment: '', estimatedMinutes: 12 },
      { id: 'PED-003', stayId: null, roomId: null, source: 'Terraza', items: [{ recipeId: 'REC-001', name: 'Sándwich club', quantity: 1, price: 32, ingredientSnapshot: [{ inventoryId: 'INV-001', quantity: 2 }, { inventoryId: 'INV-002', quantity: 120 }, { inventoryId: 'INV-005', quantity: 30 }] }], total: 32, paymentMethod: 'Yape', status: 'Pedido recibido', inventoryStage: 'Sin reservar', accountingStage: 'Pendiente', comment: 'Entrega en mesa T-04', estimatedMinutes: 20 },
    ],
    inventoryLedger: [
      { id: 'LED-001', inventoryId: 'INV-001', type: 'Entrada', quantity: 26, referenceId: 'INICIAL', note: 'Saldo inicial', createdAt: new Date().toISOString(), responsible: 'Sistema demo' },
      { id: 'LED-002', inventoryId: 'INV-002', type: 'Entrada', quantity: 4200, referenceId: 'INICIAL', note: 'Saldo inicial', createdAt: new Date().toISOString(), responsible: 'Sistema demo' },
      { id: 'LED-003', inventoryId: 'INV-003', type: 'Entrada', quantity: 48.2, referenceId: 'INICIAL', note: 'Saldo inicial', createdAt: new Date().toISOString(), responsible: 'Sistema demo' },
      { id: 'LED-004', inventoryId: 'INV-004', type: 'Entrada', quantity: 32, referenceId: 'INICIAL', note: 'Saldo inicial', createdAt: new Date().toISOString(), responsible: 'Sistema demo' },
      { id: 'LED-005', inventoryId: 'INV-005', type: 'Entrada', quantity: 650, referenceId: 'INICIAL', note: 'Saldo inicial', createdAt: new Date().toISOString(), responsible: 'Sistema demo' },
      { id: 'LED-006', inventoryId: 'INV-003', type: 'Reserva', quantity: -3, referenceId: 'PED-002', note: 'Reserva heredada', createdAt: new Date().toISOString(), responsible: 'Sistema demo' },
      { id: 'LED-007', inventoryId: 'INV-004', type: 'Reserva', quantity: -2, referenceId: 'PED-002', note: 'Reserva heredada', createdAt: new Date().toISOString(), responsible: 'Sistema demo' },
    ],
    inventory: [
      { id: 'INV-001', name: 'Pan de molde', category: 'Alimentos', unit: 'unidad', stock: 26, reserved: 0, minimum: 10, lot: 'PAN-0808', expiresAt: isoDate(4), supplierId: 'PRO-001', cost: 0.8 },
      { id: 'INV-002', name: 'Pechuga de pollo', category: 'Alimentos', unit: 'g', stock: 4200, reserved: 0, minimum: 1500, lot: 'POL-0807', expiresAt: isoDate(3), supplierId: 'PRO-001', cost: 0.03 },
      { id: 'INV-003', name: 'Ron blanco', category: 'Licores', unit: 'oz', stock: 48.2, reserved: 3, minimum: 15, lot: 'RON-0721', expiresAt: null, supplierId: 'PRO-002', cost: 4.4 },
      { id: 'INV-004', name: 'Jugo de limón', category: 'Bebidas', unit: 'oz', stock: 32, reserved: 2, minimum: 12, lot: 'LIM-0808', expiresAt: isoDate(2), supplierId: 'PRO-001', cost: 0.9 },
      { id: 'INV-005', name: 'Queso', category: 'Alimentos', unit: 'g', stock: 650, reserved: 0, minimum: 800, lot: 'QUE-0805', expiresAt: isoDate(1), supplierId: 'PRO-003', cost: 0.04 },
    ],
    recipes: [
      { id: 'REC-001', name: 'Sándwich club', type: 'Cocina', salePrice: 32, ingredients: [{ inventoryId: 'INV-001', quantity: 2 }, { inventoryId: 'INV-002', quantity: 120 }, { inventoryId: 'INV-005', quantity: 30 }], status: 'Activa' },
      { id: 'REC-002', name: 'Mojito', type: 'Bar', salePrice: 28, ingredients: [{ inventoryId: 'INV-003', quantity: 1.5 }, { inventoryId: 'INV-004', quantity: 1 }], status: 'Activa' },
    ],
    vehicles: [
      { id: 'VEH-001', clientId: 'CLI-001', stayId: 'EST-001', roomId: '101', type: 'Auto', brandModel: 'Toyota Corolla', plate: 'ABC-123', entryAt: new Date().toISOString(), exitAt: null, space: 'A-01', fee: 15, status: 'Dentro' },
      { id: 'VEH-002', clientId: 'CLI-002', stayId: 'EST-002', roomId: '201', type: 'Moto', brandModel: 'Honda CB190R', plate: 'M2-4812', entryAt: new Date().toISOString(), exitAt: null, space: 'M-03', fee: 0, status: 'Dentro' },
    ],
    pets: [
      { id: 'PET-001', clientId: 'CLI-001', stayId: 'EST-001', type: 'Perro', name: 'Milo', size: 'Mediano', lodgingPlace: 'Habitación 101', charge: 45, notes: 'Requiere cama para mascota.', damageIncidentId: null, status: 'Activa' },
      { id: 'PET-002', clientId: 'CLI-003', stayId: null, type: 'Gato', name: 'Nube', size: 'Pequeño', lodgingPlace: 'Zona habilitada de cochera', charge: 30, notes: 'Registro previo; sin estadía activa.', damageIncidentId: null, status: 'Activa' },
    ],
    recreationAccess: [
      { id: 'ACC-001', stayId: 'EST-001', clientId: 'CLI-001', roomId: '101', zone: 'Piscina', status: 'Habilitado', paid: true, validUntil: isoDate(1), allowedPeople: 2, peopleInside: 0, entries: 0, qrReference: 'QR dinámico demo' },
    ],
    accessLog: [],
    poolCapacity: 30,
    suppliers: [
      { id: 'PRO-001', businessName: 'Mercado Fresco Lima SAC', ruc: '20518877121', contact: 'Andrea Ruiz', phone: '+51 944 500 120', email: 'ventas@mercadofresco.pe', products: ['Alimentos', 'Bebidas'], averageDeliveryDays: 1, primary: true },
      { id: 'PRO-002', businessName: 'Licores Andinos SAC', ruc: '20604410982', contact: 'Javier Luna', phone: '+51 933 227 401', email: 'pedidos@licoresandinos.pe', products: ['Licores'], averageDeliveryDays: 2, primary: true },
      { id: 'PRO-003', businessName: 'Distribuciones Plaza EIRL', ruc: '20499120443', contact: 'Rosa Medina', phone: '+51 955 440 882', email: 'contacto@displaza.pe', products: ['Limpieza', 'Lácteos'], averageDeliveryDays: 3, primary: false },
    ],
    events: [
      { id: 'EVE-001', clientId: 'CLI-003', title: 'Reunión familiar', date: isoDate(5), startTime: '18:00', endTime: '22:00', venue: 'Terraza', attendees: 35, services: ['Catering', 'Sonido'], advance: 0, total: 1300, status: 'Confirmado' },
      { id: 'EVE-002', clientId: 'CLI-002', title: 'Encuentro empresarial', date: isoDate(8), startTime: '09:00', endTime: '13:00', venue: 'Bar', attendees: 24, services: ['Coffee break', 'Proyector'], advance: 0, total: 900, status: 'Tentativo' },
    ],
    staff: [
      { id: 'PER-001', documentNumber: '44556677', name: 'Sofía Medina', role: 'Recepcionista', area: 'Recepción', phone: '+51 955 102 003', email: 'sofia.medina@parkplaza.pe', salary: 2400, status: 'Activo', shift: '07:00 - 15:00', attendance: 'Ingreso 06:57', overtimeHours: 1.5 },
      { id: 'PER-002', documentNumber: '33221188', name: 'Teresa Quispe', role: 'Camarista', area: 'Limpieza', phone: '+51 944 012 849', email: 'teresa.quispe@parkplaza.pe', salary: 1900, status: 'Activo', shift: '08:00 - 16:00', attendance: 'Ingreso 08:03', overtimeHours: 0 },
      { id: 'PER-003', documentNumber: '70112233', name: 'Juan Martínez', role: 'Cocinero', area: 'Cocina', phone: '+51 922 710 344', email: 'juan.martinez@parkplaza.pe', salary: 2300, status: 'Activo', shift: '12:00 - 20:00', attendance: 'Pendiente', overtimeHours: 2 },
    ],
    staffShifts: [
      { id: 'TUR-001', staffId: 'PER-001', date: isoDate(0), startTime: '07:00', endTime: '15:00', status: 'Programado', responsible: 'Administrador demo', createdAt: new Date().toISOString() },
      { id: 'TUR-002', staffId: 'PER-002', date: isoDate(0), startTime: '08:00', endTime: '16:00', status: 'Programado', responsible: 'Administrador demo', createdAt: new Date().toISOString() },
    ],
    attendanceLog: [],
    cashSessions: [{ id: 'CAJ-001', openedAt: new Date().toISOString(), closedAt: null, openingAmount: 500, countedAmount: null, expectedAmount: null, difference: null, responsible: 'Sofía Medina', shift: 'Mañana', status: 'Abierta', notes: 'Turno mañana' }],
    cashMovements: [
      { id: 'MOV-001', sessionId: 'CAJ-001', type: 'Ingreso', concept: 'Adelanto RES-001', referenceId: 'PAG-001', amount: 185, method: 'Yape', createdAt: new Date().toISOString(), responsible: 'Sofía Medina' },
      { id: 'MOV-002', sessionId: 'CAJ-001', type: 'Ingreso', concept: 'Adelanto RES-002', referenceId: 'PAG-002', amount: 260, method: 'Tarjeta', createdAt: new Date().toISOString(), responsible: 'Sofía Medina' },
      { id: 'MOV-003', sessionId: 'CAJ-001', type: 'Egreso', concept: 'Compra urgente de limpieza', referenceId: null, amount: 42, method: 'Efectivo', createdAt: new Date().toISOString(), responsible: 'Sofía Medina' },
    ],
    incidents: [
      { id: 'INC-001', type: 'Mantenimiento', referenceId: 'MAN-002', roomId: '405', description: 'Falla eléctrica grave; habitación fuera de servicio.', priority: 'Urgente', responsible: 'Jorge Herrera', status: 'Asignada', evidence: ['Reporte técnico inicial'], solution: '' },
      { id: 'INC-002', type: 'Servicio', referenceId: 'EST-002', roomId: '201', description: 'Demora reportada en room service.', priority: 'Media', responsible: 'Supervisión', status: 'Pendiente', evidence: [], solution: '' },
      { id: 'INC-003', type: 'Mantenimiento', referenceId: 'MAN-001', roomId: '108', description: 'Equipo de aire acondicionado sin respuesta.', priority: 'Alta', responsible: 'Carlos Méndez', status: 'En proceso', evidence: ['Diagnóstico inicial registrado'], solution: '' },
    ],
    surveys: [
      { id: 'ENC-001', clientId: 'CLI-001', stayId: null, sentAt: isoDate(-15), status: 'Respondida', overall: 5, cleaning: 5, service: 4, room: 5, food: 4, comment: 'Excelente atención.', promotionsAuthorized: true },
      { id: 'ENC-002', clientId: 'CLI-003', stayId: null, sentAt: isoDate(-2), status: 'Pendiente', overall: null, cleaning: null, service: null, room: null, food: null, comment: '', promotionsAuthorized: false },
    ],
    roles: [
      { id: 'ROL-ADMIN', name: 'Administrador', users: 1, permissions: ['Todos los módulos', 'Configuración', 'Auditoría'] },
      { id: 'ROL-REC', name: 'Recepcionista', users: 3, permissions: ['Clientes', 'Reservas', 'Check-in/out', 'Pagos'] },
      { id: 'ROL-LIM', name: 'Limpieza', users: 4, permissions: ['Tareas asignadas', 'Evidencias', 'Incidencias'] },
      { id: 'ROL-COC', name: 'Cocina', users: 3, permissions: ['Pedidos', 'Recetas', 'Inventario relacionado'] },
    ],
    auditLog: [
      { id: 'AUD-001', user: 'Sistema demo', action: 'Generó contrato', module: 'Contratos', recordId: 'HP-2026-000001', createdAt: new Date().toISOString(), detail: 'Versión 1 por reserva confirmada' },
      { id: 'AUD-002', user: 'Sofía Medina', action: 'Registró pago', module: 'Pagos', recordId: 'PAG-001', createdAt: new Date().toISOString(), detail: 'Adelanto 50 % mediante Yape' },
    ],
    notifications: [
      { id: 'NOT-001', type: 'warning', title: 'Stock bajo: Queso', description: '650 g disponibles; mínimo 800 g.', route: 'inventario', read: false },
      { id: 'NOT-002', type: 'info', title: 'Contrato pendiente de firma', description: 'HP-2026-000001 requiere revisión en check-in.', route: 'contratos', read: false },
    ],
    integrations: [
      { id: 'INT-FISCAL', name: 'Facturación electrónica', status: 'Pendiente de integración', detail: 'No se emiten comprobantes fiscales reales.' },
      { id: 'INT-MSG', name: 'Correo y WhatsApp', status: 'Pendiente de integración', detail: 'Las notificaciones se registran solo dentro del prototipo.' },
      { id: 'INT-POOL', name: 'Lector QR y valla', status: 'Pendiente de hardware', detail: 'La validación se simula sin abrir dispositivos.' },
      { id: 'INT-BACKUP', name: 'Copias de seguridad', status: 'No configurado', detail: 'No existe persistencia ni respaldo automático en este frontend.' },
      { id: 'INT-AUTH', name: 'Autenticación segura', status: 'Pendiente de backend', detail: 'Roles visibles sin control de sesión real.' },
    ],
  };
};

export const selectClientName = (state, clientId) => state.clients.find((client) => client.id === clientId)?.name || 'Sin cliente';
export const selectRoom = (state, roomId) => state.rooms.find((room) => room.id === String(roomId));
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
