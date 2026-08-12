import {
  CLOSED_INCIDENT_STATUSES,
  CLOSED_MAINTENANCE_STATUSES,
  currentCalendarDate,
  getOrderRequirements,
  getOrderShortages,
  isReservationArrivalExpired,
  nightsBetween,
  ORDER_STATUSES,
  PENALTIES,
  ROOM_PRICING,
  selectAccountBalance,
  validateOrder,
  validateReservation,
} from '../domain/hotelModel.js';

const nextId = (prefix, records) => {
  const highest = records.reduce((max, record) => {
    const match = String(record.id).match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
};

const padCalendarPart = (value) => String(value).padStart(2, '0');
const formatCalendarDate = (value) => `${value.getFullYear()}-${padCalendarPart(value.getMonth() + 1)}-${padCalendarPart(value.getDate())}`;

const addAudit = (state, auditAction, module, recordId, detail, metadata = {}) => ({
  ...state,
  auditLog: [{ id: nextId('AUD', state.auditLog), user: metadata.user || 'Administrador demo', action: auditAction, module, recordId, detail, createdAt: new Date().toISOString(), ...metadata }, ...state.auditLog],
});

const getOpenCashSession = (state) => state.cashSessions.find((session) => session.status === 'Abierta');
const createCashMovement = (state, movement) => {
  const session = getOpenCashSession(state);
  return session ? { id: nextId('MOV', state.cashMovements), sessionId: session.id, responsible: session.responsible, createdAt: new Date().toISOString(), ...movement } : null;
};

const normalizeDocument = (value = '') => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizeName = (value = '') => value.trim().toLocaleLowerCase('es-PE').replace(/\s+/g, ' ');
const hasText = (value) => Boolean(value?.trim());
const isFiniteAtLeast = (value, minimum = 0) => Number.isFinite(Number(value)) && Number(value) >= minimum;
const isFiniteGreaterThan = (value, minimum = 0) => Number.isFinite(Number(value)) && Number(value) > minimum;
const getAttendanceContext = (state, staffId, createdAt = new Date()) => {
  const calendarDate = formatCalendarDate(createdAt);
  const localTime = `${padCalendarPart(createdAt.getHours())}:${padCalendarPart(createdAt.getMinutes())}`;
  const shift = state.staffShifts.find((item) => item.staffId === staffId && item.date === calendarDate && item.status !== 'Cancelado' && localTime >= item.startTime && localTime <= item.endTime)
    || state.staffShifts.find((item) => item.staffId === staffId && item.date === calendarDate && item.status !== 'Cancelado');
  const scopedEntries = state.attendanceLog.filter((item) => item.staffId === staffId && (item.shiftId ? item.shiftId === shift?.id : item.calendarDate ? item.calendarDate === calendarDate : formatCalendarDate(new Date(item.createdAt)) === calendarDate));
  const latest = scopedEntries.toSorted((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  return { calendarDate, shiftId: shift?.id || null, expectedMovement: latest?.movement === 'Entrada' ? 'Salida' : 'Entrada' };
};
const getAdvanceAccountLink = (state, payment) => {
  if (!payment?.reservationId || payment.accountId) return null;
  const stay = state.stays.find((item) => item.reservationId === payment.reservationId);
  if (!stay) return null;
  const account = state.accounts.find((item) => item.id === stay.accountId);
  const accountPayment = account?.payments.find((item) => item.sourcePaymentId === payment.id || item.id === `AP-${payment.reservationId}`);
  return { stay, account, accountPayment };
};
const eventOverlaps = (state, payload, eventId = null) => state.events.some((event) => event.id !== eventId && event.status !== 'Cancelado' && event.status !== 'Archivado' && event.date === payload.date && event.venue === payload.venue && payload.startTime < event.endTime && payload.endTime > event.startTime);
const validateEvent = (state, payload, eventId = null) => {
  if (!hasText(payload.title) || !state.clients.some((client) => client.id === payload.clientId && client.status !== 'Archivado')) return 'Indicá nombre y cliente activo.';
  if (!payload.date || !payload.startTime || !payload.endTime || payload.endTime <= payload.startTime) return 'La fecha y el horario no son válidos.';
  if (!Number.isInteger(Number(payload.attendees)) || Number(payload.attendees) < 1 || !Number.isFinite(Number(payload.total)) || Number(payload.total) < 0) return 'Revisá asistentes e importe.';
  return eventOverlaps(state, payload, eventId) ? 'El espacio ya tiene un evento superpuesto.' : null;
};
const validateRecipe = (state, payload, recipeId = null) => {
  if (!hasText(payload.name) || !['Cocina', 'Bar'].includes(payload.type) || !Number.isFinite(Number(payload.salePrice)) || Number(payload.salePrice) < 0) return 'Revisá nombre, tipo y precio.';
  if (!payload.ingredients?.length) return 'Agregá al menos un ingrediente.';
  const ids = payload.ingredients.map((item) => item.inventoryId);
  if (new Set(ids).size !== ids.length || payload.ingredients.some((item) => !isFiniteGreaterThan(item.quantity) || !state.inventory.some((inventory) => inventory.id === item.inventoryId && inventory.status !== 'Archivado'))) return 'Los ingredientes deben ser activos, únicos y con cantidad mayor que cero.';
  if (state.recipes.some((recipe) => recipe.id !== recipeId && recipe.status !== 'Archivada' && recipe.name.trim().toLowerCase() === payload.name.trim().toLowerCase())) return 'Ya existe una receta activa con ese nombre.';
  return null;
};
const getOpenAccount = (state, accountId) => state.accounts.find((account) => account.id === accountId && account.status === 'Abierta');

const createLedgerEntries = (state, requirements, type, referenceId, sign) => {
  const totals = new Map();
  requirements.forEach((requirement) => totals.set(requirement.inventoryId, (totals.get(requirement.inventoryId) || 0) + requirement.quantity));
  const highest = state.inventoryLedger.reduce((max, entry) => Math.max(max, Number(String(entry.id).match(/(\d+)$/)?.[1] || 0)), 0);
  return [...totals.entries()].flatMap(([inventoryId, quantity], index) => state.inventory.some((item) => item.id === inventoryId) ? [{ id: `LED-${String(highest + index + 1).padStart(3, '0')}`, inventoryId, type, quantity: quantity * sign, referenceId, note: `${type} por ${referenceId}`, createdAt: new Date().toISOString(), responsible: 'Administrador demo' }] : []);
};

const roomStatusAfterBlockChange = (state, roomId, ignoredMaintenanceId = null) => {
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room) return null;
  if (room.activeStayId) return 'Ocupada';
  const activeTickets = state.maintenanceTickets.filter((ticket) => ticket.roomId === roomId && ticket.id !== ignoredMaintenanceId && !CLOSED_MAINTENANCE_STATUSES.includes(ticket.status));
  if (activeTickets.some((ticket) => ticket.severe)) return 'Fuera de servicio';
  if (activeTickets.length) return 'En mantenimiento';
  if (state.incidents.some((incident) => incident.roomId === roomId && incident.blocksRoom && !CLOSED_INCIDENT_STATUSES.includes(incident.status))) return 'Bloqueada';
  if (state.cleaningTasks.some((task) => task.roomId === roomId && task.status !== 'Aprobada')) return 'En limpieza';
  const today = currentCalendarDate();
  if (state.reservations.some((reservation) => reservation.roomId === roomId && reservation.status === 'Confirmada' && reservation.checkIn <= today && reservation.checkOut > today)) return 'Reservada';
  return room.operationalBlock ? 'Bloqueada' : 'Disponible';
};

const updateRoomStatus = (state, roomId, ignoredMaintenanceId = null) => state.rooms.map((room) => room.id === roomId ? { ...room, status: roomStatusAfterBlockChange(state, roomId, ignoredMaintenanceId) } : room);

export const validateHotelAction = (state, action) => {
  switch (action.type) {
    case 'BIOMETRIC_ENROLLED': {
      const collection = action.subjectType === 'client' ? state.clients : action.subjectType === 'employee' ? state.staff : [];
      const subject = collection.find((item) => item.id === action.subjectId && item.status !== 'Archivado');
      const message = !subject ? 'La persona biométrica no existe o no está activa.' : !hasText(action.templateReference) || !hasText(action.enrolledAt) ? 'Faltan la referencia opaca o la fecha de enrolamiento.' : null;
      return { ok: !message, message };
    }
    case 'BIOMETRIC_ATTEMPT': {
      const subject = [...state.clients, ...state.staff].find((item) => item.id === action.subjectId);
      const scoreValid = action.score == null || Number.isFinite(Number(action.score));
      const message = !subject ? 'La persona biométrica no existe.' : !['enroll', 'verify'].includes(action.kind) || !hasText(action.result) ? 'El intento biométrico no tiene metadatos válidos.' : !scoreValid ? 'El puntaje biométrico no es finito.' : null;
      return { ok: !message, message };
    }
    case 'STAFF_ATTENDANCE_VERIFIED': {
      const person = state.staff.find((item) => item.id === action.staffId && item.status !== 'Archivado');
      const context = getAttendanceContext(state, action.staffId);
      const referenceMatches = hasText(action.templateReference) && (!person?.biometric?.templateReference || action.templateReference === person.biometric.templateReference);
      const message = !person ? 'La persona no está activa.' : action.matched !== true || !referenceMatches ? 'La coincidencia biométrica no corresponde al registro enrolado.' : !hasText(action.requestId) ? 'La operación biométrica no tiene identificador estable.' : state.attendanceLog.some((item) => item.requestId === action.requestId) ? 'La asistencia biométrica ya fue aplicada.' : !Number.isFinite(Number(action.score)) ? 'El puntaje biométrico no es finito.' : !['Entrada', 'Salida'].includes(context.expectedMovement) ? 'La secuencia de asistencia no es válida.' : null;
      return { ok: !message, message };
    }
    case 'CLIENT_CREATE':
    case 'CLIENT_UPDATE': {
      const current = action.type === 'CLIENT_UPDATE' ? state.clients.find((client) => client.id === action.clientId) : null;
      const payload = action.type === 'CLIENT_UPDATE' ? { ...current, ...action.changes } : action.payload;
      const documentNumber = normalizeDocument(payload?.documentNumber);
      const duplicate = state.clients.some((client) => client.id !== current?.id && client.status !== 'Archivado' && normalizeDocument(client.documentNumber) === documentNumber);
      const message = !current && action.type === 'CLIENT_UPDATE' ? 'El cliente no existe.' : current?.status === 'Archivado' ? 'Reactivá el cliente antes de editarlo.' : !hasText(payload?.firstName) || !hasText(payload?.lastName) || !documentNumber ? 'Completá nombres, apellidos y documento.' : duplicate ? 'El documento ya pertenece a otro cliente activo.' : null;
      return { ok: !message, message };
    }
    case 'CLIENT_ARCHIVE': {
      const client = state.clients.find((item) => item.id === action.clientId);
      const active = state.stays.some((stay) => stay.clientId === action.clientId && stay.status === 'Activa') || state.reservations.some((reservation) => reservation.clientId === action.clientId && ['Pendiente', 'Confirmada', 'Cliente presente'].includes(reservation.status));
      const message = !client || client.status === 'Archivado' ? 'El cliente ya está archivado o no existe.' : active ? 'No se puede archivar con reserva o estadía activa.' : !hasText(action.reason) ? 'Indicá el motivo del archivo.' : null;
      return { ok: !message, message };
    }
    case 'CLIENT_REACTIVATE': {
      const client = state.clients.find((item) => item.id === action.clientId);
      const duplicate = client && state.clients.some((item) => item.id !== client.id && item.status !== 'Archivado' && normalizeDocument(item.documentNumber) === normalizeDocument(client.documentNumber));
      const message = !client || client.status !== 'Archivado' ? 'El cliente no está archivado.' : duplicate ? 'Otro cliente activo usa ese documento.' : !hasText(action.reason) ? 'Indicá el motivo de reactivación.' : null;
      return { ok: !message, message };
    }
    case 'ROOM_UPDATE': {
      const room = state.rooms.find((item) => item.id === action.roomId);
      const payload = action.payload;
      const message = !room ? 'La habitación no existe.' : !Number.isFinite(Number(payload.nightlyRate)) || Number(payload.nightlyRate) < 0 || !Number.isInteger(Number(payload.capacity)) || Number(payload.capacity) < 1 || !hasText(payload.beds) ? 'Revisá tarifa, capacidad y camas.' : null;
      return { ok: !message, message };
    }
    case 'ROOM_BLOCK': {
      const room = state.rooms.find((item) => item.id === action.roomId);
      const activeReservation = state.reservations.some((reservation) => reservation.roomId === action.roomId && ['Pendiente', 'Confirmada', 'Cliente presente'].includes(reservation.status));
      const message = !room || room.operationalBlock ? 'La habitación ya está bloqueada o no existe.' : room.activeStayId ? 'No se puede bloquear una habitación ocupada.' : activeReservation ? 'Reprogramá o cancelá primero las reservas activas de la habitación.' : !hasText(action.reason) ? 'Indicá el motivo del bloqueo.' : null;
      return { ok: !message, message };
    }
    case 'ROOM_UNBLOCK': {
      const room = state.rooms.find((item) => item.id === action.roomId);
      const blockedByOperation = room && (room.activeStayId || state.cleaningTasks.some((task) => task.roomId === room.id && task.status !== 'Aprobada') || state.maintenanceTickets.some((ticket) => ticket.roomId === room.id && !CLOSED_MAINTENANCE_STATUSES.includes(ticket.status)) || state.incidents.some((incident) => incident.roomId === room.id && incident.blocksRoom && !CLOSED_INCIDENT_STATUSES.includes(incident.status)));
      const message = !room || !room.operationalBlock ? 'La habitación no tiene bloqueo administrativo.' : blockedByOperation ? 'No se puede desbloquear mientras exista estadía, limpieza, mantenimiento o incidencia bloqueante.' : !hasText(action.reason) ? 'Indicá el motivo del desbloqueo.' : null;
      return { ok: !message, message };
    }
    case 'RESERVATION_CONFIRM': {
      const message = validateReservation(state, action.payload) || (!getOpenCashSession(state) ? 'Abrí una caja antes de registrar el adelanto.' : null);
      return { ok: !message, message };
    }
    case 'RESERVATION_UPDATE': {
      const reservation = state.reservations.find((item) => item.id === action.reservationId);
      const message = !reservation ? 'La reserva no existe.' : !['Pendiente', 'Confirmada'].includes(reservation.status) ? 'Sólo se pueden reprogramar reservas pendientes o confirmadas.' : validateReservation(state, { ...reservation, ...action.payload }, reservation.id);
      return { ok: !message, message };
    }
    case 'RESERVATION_STATUS': {
      const reservation = state.reservations.find((item) => item.id === action.reservationId);
      const allowed = reservation && ['Pendiente', 'Confirmada'].includes(reservation.status) && ['Cancelada', 'No presentado', 'Vencida'].includes(action.status);
      const timingValid = action.status === 'Cancelada' || (reservation && isReservationArrivalExpired(reservation));
      return { ok: Boolean(allowed && timingValid), message: !allowed ? 'La reserva ya no admite esa operación.' : !timingValid ? 'La fecha de llegada aún no venció.' : null };
    }
    case 'CHECK_IN': {
      const reservation = state.reservations.find((item) => item.id === action.reservationId);
      const room = state.rooms.find((item) => item.id === reservation?.roomId);
      const client = state.clients.find((item) => item.id === reservation?.clientId);
      const contract = state.contracts.find((item) => item.id === reservation?.contractId);
      const advancePayment = state.payments.find((item) => item.reservationId === reservation?.id && !item.reversalOf && item.status === 'Registrado');
      const today = currentCalendarDate();
      const identity = action.identityValidation;
      const identityValid = identity?.method === 'biometric' ? identity.matched === true : identity?.method === 'documentary' && identity.documentType === client?.documentType && normalizeDocument(identity.documentNumber) === normalizeDocument(client?.documentNumber) && hasText(identity.result) && hasText(identity.responsible) && hasText(identity.verifiedAt);
      const referencesValid = room && client?.status !== 'Archivado' && contract && contract.reservationId === reservation?.id && contract.clientId === reservation?.clientId && contract.roomId === reservation?.roomId && contract.status !== 'Anulado';
      const financialsValid = reservation && isFiniteAtLeast(reservation.total) && isFiniteAtLeast(reservation.advance) && reservation.advance <= reservation.total && (!reservation.advance || (advancePayment && advancePayment.amount === reservation.advance));
      const message = !reservation || reservation.status !== 'Confirmada' ? 'La reserva no está confirmada.' : !referencesValid ? 'La habitación, el cliente o el contrato de la reserva no existen o no son coherentes.' : !financialsValid ? 'Los importes o el adelanto de la reserva no son coherentes.' : state.stays.some((item) => item.reservationId === reservation.id) ? 'La reserva ya tiene una estadía vinculada.' : !identityValid ? 'Registrá una validación biométrica coincidente o una validación documental completa.' : today < reservation.checkIn || today >= reservation.checkOut ? 'El check-in debe realizarse dentro del intervalo reservado.' : room.activeStayId ? 'La habitación ya tiene una estadía activa.' : !['Disponible', 'Reservada'].includes(room.status) ? `La habitación está ${room.status.toLowerCase()}.` : null;
      return { ok: !message, message };
    }
    case 'CONTRACT_ADDENDUM':
    case 'CONTRACT_VOID': {
      const contract = state.contracts.find((item) => item.id === action.contractId);
      const message = !contract ? 'El contrato no existe.' : contract.status === 'Anulado' ? 'El contrato ya está anulado.' : !hasText(action.reason) || (action.type === 'CONTRACT_ADDENDUM' && !hasText(action.internalReference)) ? 'Indicá motivo y referencia interna.' : null;
      return { ok: !message, message };
    }
    case 'ACCOUNT_CHARGE':
    case 'ACCOUNT_PAYMENT': {
      const account = getOpenAccount(state, action.accountId);
      const amount = Number(action.amount);
      const requestDuplicate = state.auditLog.some((entry) => entry.requestId && entry.requestId === action.requestId);
      const message = !account ? 'La cuenta no está abierta.' : !getOpenCashSession(state) ? 'Abrí una caja antes de registrar la operación.' : !hasText(action.requestId) ? 'Falta el identificador estable de la operación.' : requestDuplicate ? 'La operación ya fue aplicada.' : !Number.isFinite(amount) || amount <= 0 || !hasText(action.concept) ? 'Indicá concepto e importe finito mayor que cero.' : action.type === 'ACCOUNT_PAYMENT' && amount > selectAccountBalance(account) ? 'El pago supera el saldo de la cuenta.' : null;
      return { ok: !message, message };
    }
    case 'MOVEMENT_VOID': {
      const movement = state.cashMovements.find((item) => item.id === action.movementId);
      const reversed = state.cashMovements.some((item) => item.reversalOf === action.movementId);
      const payment = state.payments.find((item) => item.id === movement?.referenceId);
      const linkedAccount = payment?.accountId ? getOpenAccount(state, payment.accountId) : null;
      const advanceLink = getAdvanceAccountLink(state, payment);
      const directAccountPayment = linkedAccount?.payments.find((item) => item.id === payment?.id);
      const accountingValid = !payment || (Number.isFinite(payment.amount) && payment.amount > 0 && payment.amount === movement?.amount && (payment.accountId ? directAccountPayment?.amount === payment.amount : advanceLink ? advanceLink.account?.status === 'Abierta' && advanceLink.accountPayment?.amount === payment.amount : state.reservations.some((item) => item.id === payment.reservationId && item.advance >= payment.amount)));
      const message = !movement ? 'El movimiento no existe.' : movement.reversalOf ? 'Un contramovimiento no se puede volver a anular.' : !isFiniteGreaterThan(movement.amount) ? 'El movimiento tiene un importe contablemente inválido.' : reversed ? 'El movimiento ya fue anulado.' : !getOpenCashSession(state) ? 'Abrí una caja para registrar el contramovimiento.' : payment?.accountId && !linkedAccount ? 'La cuenta vinculada debe estar abierta para anular el pago.' : !accountingValid ? 'No se puede anular sin desbalancear la cuenta, el pago o el adelanto vinculados.' : !hasText(action.reason) ? 'Indicá el motivo de anulación.' : null;
      return { ok: !message, message };
    }
    case 'PENALTY_CHARGE': {
      const penalty = PENALTIES.find((item) => item.id === action.penaltyId);
      const duplicate = state.auditLog.some((entry) => entry.requestId === action.requestId);
      const message = !getOpenAccount(state, action.accountId) ? 'La cuenta no está abierta.' : !getOpenCashSession(state) ? 'Abrí una caja antes de registrar la penalidad.' : !hasText(action.requestId) ? 'Falta el identificador estable de la penalidad.' : duplicate ? 'La penalidad ya fue aplicada.' : !penalty?.active || !isFiniteGreaterThan(penalty.amount) ? 'La penalidad no existe, está inactiva o tiene un importe inválido.' : penalty.evidenceRequired && !hasText(action.evidence) ? 'Esta penalidad exige una referencia de evidencia declarada.' : null;
      return { ok: !message, message };
    }
    case 'CLEANING_UPDATE': {
      const task = state.cleaningTasks.find((item) => item.id === action.taskId);
      return { ok: Boolean(task && task.status !== 'Aprobada' && hasText(action.assignedTo)), message: 'Indicá responsable; una tarea aprobada no se reasigna.' };
    }
    case 'CLEANING_INCIDENT': {
      const task = state.cleaningTasks.find((item) => item.id === action.taskId);
      return { ok: Boolean(task && hasText(action.description)), message: 'La tarea no existe o falta la descripción de la incidencia.' };
    }
    case 'CLEANING_PROGRESS': {
      const task = state.cleaningTasks.find((item) => item.id === action.taskId);
      const completing = task?.status === 'En proceso';
      const message = !task || task.status === 'Aprobada' || task.status !== action.expectedStatus ? 'La tarea cambió de estado o ya fue aprobada.' : completing && !hasText(action.evidence) && !task.evidence.length ? 'Declarar una referencia de evidencia es obligatorio para completar.' : null;
      return { ok: !message, message };
    }
    case 'PARKING_CREATE':
    case 'PARKING_UPDATE': {
      const current = action.type === 'PARKING_UPDATE' ? state.vehicles.find((item) => item.id === action.vehicleId) : null;
      const payload = action.payload;
      const duplicate = state.vehicles.some((item) => item.id !== current?.id && item.status === 'Dentro' && (item.plate.toUpperCase() === payload.plate?.trim().toUpperCase() || item.space.toUpperCase() === payload.space?.trim().toUpperCase()));
      const message = action.type === 'PARKING_UPDATE' && (!current || current.status !== 'Dentro') ? 'Sólo se editan vehículos que están dentro.' : !state.stays.some((stay) => stay.id === payload.stayId && stay.status === 'Activa') ? 'Seleccioná una estadía activa.' : !hasText(payload.plate) || !hasText(payload.space) || !Number.isFinite(Number(payload.fee)) || Number(payload.fee) < 0 ? 'Revisá placa, espacio y tarifa manual.' : duplicate ? 'La placa o el espacio ya están ocupados.' : null;
      return { ok: !message, message };
    }
    case 'PARKING_EXIT': {
      const vehicle = state.vehicles.find((item) => item.id === action.vehicleId);
      return { ok: Boolean(vehicle && vehicle.status === 'Dentro' && hasText(action.responsible)), message: 'El vehículo ya salió o falta responsable.' };
    }
    case 'PARKING_ARCHIVE': {
      const vehicle = state.vehicles.find((item) => item.id === action.vehicleId);
      return { ok: Boolean(vehicle && vehicle.status === 'Fuera' && hasText(action.reason)), message: 'Sólo se archiva un vehículo fuera y con motivo.' };
    }
    case 'PET_CREATE':
    case 'PET_UPDATE': {
      const pet = action.type === 'PET_UPDATE' ? state.pets.find((item) => item.id === action.petId) : null;
      const payload = action.payload;
      const stay = payload.stayId ? state.stays.find((item) => item.id === payload.stayId && item.status === 'Activa' && item.clientId === payload.clientId) : null;
      const account = stay ? getOpenAccount(state, stay.accountId) : null;
      const duplicateRequest = hasText(action.requestId) && (state.auditLog.some((entry) => entry.requestId === action.requestId) || state.accounts.some((item) => item.charges.some((charge) => charge.requestId === action.requestId)));
      const chargeChanged = pet && Number(payload.charge) !== pet.charge;
      const message = action.type === 'PET_UPDATE' && !pet ? 'La mascota no existe.' : pet?.status === 'Archivada' ? 'Reactivá la mascota antes de editarla.' : !state.clients.some((client) => client.id === payload.clientId && client.status !== 'Archivado') || !hasText(payload.name) || !isFiniteAtLeast(payload.charge) ? 'Revisá propietario activo, nombre y cargo.' : action.type === 'PET_UPDATE' && chargeChanged ? 'El cargo aplicado no se edita; registrá una operación financiera separada.' : action.type === 'PET_CREATE' && Number(payload.charge) > 0 && (!stay || !account) ? 'Para aplicar el cargo seleccioná una estadía y cuenta abiertas del propietario.' : action.type === 'PET_CREATE' && Number(payload.charge) > 0 && !hasText(action.requestId) ? 'Falta el identificador estable del cargo.' : action.type === 'PET_CREATE' && duplicateRequest ? 'La operación de mascota ya fue aplicada.' : null;
      return { ok: !message, message };
    }
    case 'PET_ARCHIVE':
    case 'PET_REACTIVATE': {
      const pet = state.pets.find((item) => item.id === action.petId);
      const expected = action.type === 'PET_ARCHIVE' ? 'Activa' : 'Archivada';
      return { ok: Boolean(pet && pet.status === expected && hasText(action.reason)), message: 'La transición no corresponde o falta motivo.' };
    }
    case 'ACCESS_MANUAL': {
      const access = state.recreationAccess.find((item) => item.id === action.accessId);
      const entering = action.movement === 'Entrada';
      const currentInside = state.recreationAccess.filter((item) => item.zone === 'Piscina').reduce((sum, item) => sum + item.peopleInside, 0);
      const message = !access || !['Habilitado', 'Dentro de piscina'].includes(access.status) ? 'El acceso no está habilitado.' : state.accessLog.some((item) => item.requestId === action.requestId) ? 'La solicitud ya fue aplicada.' : !['Entrada', 'Salida'].includes(action.movement) || !hasText(action.responsible) || !hasText(action.reason) ? 'Movimiento, responsable y motivo son obligatorios.' : entering && access.zone === 'Piscina' && currentInside >= state.poolCapacity ? 'El aforo máximo fue alcanzado.' : entering && access.peopleInside >= access.allowedPeople ? 'El acceso alcanzó su límite de personas.' : !entering && access.peopleInside <= 0 ? 'No hay personas dentro para registrar salida.' : null;
      return { ok: !message, message };
    }
    case 'ACCESS_SELL': {
      const stay = state.stays.find((item) => item.id === action.stayId && item.status === 'Activa');
      const account = getOpenAccount(state, stay?.accountId);
      const duplicate = state.recreationAccess.some((item) => item.stayId === action.stayId && item.zone === action.zone && !['Finalizado', 'Vencido'].includes(item.status));
      const allowedPeople = Number(action.allowedPeople);
      const amount = Number(action.amount);
      const message = !stay || !account ? 'La estadía o cuenta no está activa.' : duplicate ? 'La estadía ya tiene ese servicio habilitado.' : !Number.isInteger(allowedPeople) || allowedPeople < 1 || allowedPeople > state.poolCapacity || !Number.isFinite(amount) || amount < 0 ? 'Revisá personas e importe.' : !hasText(action.requestId) ? 'Falta el identificador estable de la venta.' : state.accessLog.some((item) => item.requestId === action.requestId) ? 'La solicitud ya fue aplicada.' : null;
      return { ok: !message, message };
    }
    case 'ACCESS_SCAN': {
      const access = state.recreationAccess.find((item) => item.id === action.accessId);
      const currentInside = state.recreationAccess.filter((item) => item.zone === 'Piscina').reduce((sum, item) => sum + item.peopleInside, 0);
      const entering = action.movement === 'Entrada';
      const message = !access || !['Habilitado', 'Dentro de piscina'].includes(access.status) ? 'El acceso no está habilitado.' : !['Entrada', 'Salida'].includes(action.movement) || !hasText(action.requestId) ? 'El movimiento y su identificador estable son obligatorios.' : state.accessLog.some((item) => item.requestId === action.requestId) ? 'La solicitud ya fue aplicada.' : !access.paid ? 'El acceso tiene pago pendiente.' : access.validUntil < formatCalendarDate(new Date()) ? 'El acceso está vencido.' : entering && access.zone === 'Piscina' && currentInside >= state.poolCapacity ? 'El aforo máximo fue alcanzado.' : entering && access.peopleInside >= access.allowedPeople ? 'El acceso alcanzó su límite de personas.' : !entering && access.peopleInside <= 0 ? 'No hay personas dentro para registrar salida.' : null;
      return { ok: !message, message };
    }
    case 'EVENT_CREATE':
    case 'EVENT_UPDATE': {
      const current = action.type === 'EVENT_UPDATE' ? state.events.find((item) => item.id === action.eventId) : null;
      const message = action.type === 'EVENT_UPDATE' && (!current || ['Cancelado', 'Archivado'].includes(current.status)) ? 'El evento ya no se puede editar.' : validateEvent(state, action.payload, current?.id);
      return { ok: !message, message };
    }
    case 'EVENT_CONFIRM':
    case 'EVENT_CANCEL':
    case 'EVENT_ARCHIVE': {
      const event = state.events.find((item) => item.id === action.eventId);
      const message = !event ? 'El evento no existe.' : action.type === 'EVENT_CONFIRM' && event.status !== 'Tentativo' ? 'Sólo se confirma un evento tentativo.' : action.type === 'EVENT_CANCEL' && ['Cancelado', 'Archivado'].includes(event.status) ? 'El evento ya está cerrado.' : action.type === 'EVENT_ARCHIVE' && !['Cancelado'].includes(event.status) ? 'Sólo se archivan eventos cancelados.' : action.type !== 'EVENT_CONFIRM' && !hasText(action.reason) ? 'Indicá el motivo.' : null;
      return { ok: !message, message };
    }
    case 'RECIPE_CREATE':
    case 'RECIPE_UPDATE': {
      const recipe = action.type === 'RECIPE_UPDATE' ? state.recipes.find((item) => item.id === action.recipeId) : null;
      const message = action.type === 'RECIPE_UPDATE' && !recipe ? 'La receta no existe.' : recipe?.status === 'Archivada' ? 'Reactivá la receta antes de editarla.' : validateRecipe(state, action.payload, recipe?.id);
      return { ok: !message, message };
    }
    case 'RECIPE_ARCHIVE': {
      const recipe = state.recipes.find((item) => item.id === action.recipeId);
      const openOrder = state.orders.some((order) => !['Pagado', 'Cancelado'].includes(order.status) && order.items.some((item) => item.recipeId === action.recipeId));
      return { ok: Boolean(recipe && recipe.status !== 'Archivada' && !openOrder && hasText(action.reason)), message: openOrder ? 'Hay un pedido operativo abierto con esa receta.' : 'La receta ya está archivada o falta motivo.' };
    }
    case 'RECIPE_REACTIVATE': {
      const recipe = state.recipes.find((item) => item.id === action.recipeId);
      const duplicate = recipe && state.recipes.some((item) => item.id !== recipe.id && item.status !== 'Archivada' && normalizeName(item.name) === normalizeName(recipe.name));
      const message = !recipe || recipe.status !== 'Archivada' ? 'La receta no está archivada.' : duplicate ? 'Ya existe una receta activa con ese nombre.' : !hasText(action.reason) ? 'Indicá el motivo de reactivación.' : null;
      return { ok: !message, message };
    }
    case 'STAFF_CREATE':
    case 'STAFF_UPDATE': {
      const current = action.type === 'STAFF_UPDATE' ? state.staff.find((item) => item.id === action.staffId) : null;
      const payload = action.payload;
      const document = normalizeDocument(payload?.documentNumber);
      const duplicate = state.staff.some((item) => item.id !== current?.id && item.status !== 'Archivado' && normalizeDocument(item.documentNumber) === document);
      const message = action.type === 'STAFF_UPDATE' && !current ? 'La persona no existe.' : current?.status === 'Archivado' ? 'Reactivá la persona antes de editarla.' : !hasText(payload?.name) || !document ? 'Nombre y DNI son obligatorios.' : !isFiniteAtLeast(payload.salary || 0) ? 'El sueldo debe ser un importe finito no negativo.' : duplicate ? 'El DNI ya pertenece a otra persona activa.' : null;
      return { ok: !message, message };
    }
    case 'STAFF_ARCHIVE':
    case 'STAFF_REACTIVATE': {
      const person = state.staff.find((item) => item.id === action.staffId);
      const expected = action.type === 'STAFF_ARCHIVE' ? 'Activo' : 'Archivado';
      const duplicate = action.type === 'STAFF_REACTIVATE' && person && state.staff.some((item) => item.id !== person.id && item.status !== 'Archivado' && normalizeDocument(item.documentNumber) === normalizeDocument(person.documentNumber));
      return { ok: Boolean(person && person.status === expected && !duplicate && hasText(action.reason)), message: duplicate ? 'Otro registro activo usa ese DNI.' : 'La transición no corresponde o falta motivo.' };
    }
    case 'SHIFT_CREATE':
    case 'SHIFT_UPDATE': {
      const current = action.type === 'SHIFT_UPDATE' ? state.staffShifts.find((item) => item.id === action.shiftId) : null;
      const payload = action.payload;
      const overlap = state.staffShifts.some((shift) => shift.id !== current?.id && shift.staffId === payload.staffId && shift.date === payload.date && shift.status !== 'Cancelado' && payload.startTime < shift.endTime && payload.endTime > shift.startTime);
      const message = !state.staff.some((person) => person.id === payload.staffId && person.status !== 'Archivado') || !payload.date || payload.endTime <= payload.startTime ? 'Revisá persona, fecha y horario.' : overlap ? 'El turno se superpone con otro de la misma persona.' : null;
      return { ok: !message, message };
    }
    case 'SHIFT_CANCEL':
      return { ok: Boolean(state.staffShifts.some((item) => item.id === action.shiftId && item.status !== 'Cancelado') && hasText(action.reason)), message: 'El turno ya está cancelado o falta motivo.' };
    case 'STAFF_ATTENDANCE_MANUAL': {
      const person = state.staff.find((item) => item.id === action.staffId);
      const context = getAttendanceContext(state, action.staffId);
      const message = !person || person.status === 'Archivado' ? 'La persona no está activa.' : !hasText(action.requestId) ? 'Falta el identificador estable de la asistencia.' : state.attendanceLog.some((item) => item.requestId === action.requestId) ? 'La asistencia ya fue aplicada.' : !['Entrada', 'Salida'].includes(action.movement) || !hasText(action.responsible) || !hasText(action.reason) ? 'Indicá movimiento, responsable y motivo.' : action.movement !== context.expectedMovement ? `La siguiente marcación debe ser ${context.expectedMovement.toLowerCase()}.` : null;
      return { ok: !message, message };
    }
    case 'SURVEY_RESPOND': {
      const survey = state.surveys.find((item) => item.id === action.surveyId);
      const scores = ['overall', 'cleaning', 'service', 'room', 'food'].map((key) => Number(action.payload[key]));
      return { ok: Boolean(survey && survey.status === 'Pendiente' && scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5)), message: 'La encuesta no está pendiente o las puntuaciones no están entre 1 y 5.' };
    }
    case 'NOTIFICATION_READ':
      return { ok: Boolean(state.notifications.some((item) => item.id === action.notificationId && !item.read)), message: 'La notificación ya fue leída o no existe.' };
    case 'CHECK_OUT': {
      const stay = state.stays.find((item) => item.id === action.stayId);
      const account = state.accounts.find((item) => item.id === stay?.accountId);
      const balance = selectAccountBalance(account);
      const message = !stay || stay.status !== 'Activa' || !account || account.status !== 'Abierta' ? 'La estadía o cuenta ya no está activa.' : balance > 0 && !getOpenCashSession(state) ? 'Abrí una caja antes de liquidar el saldo.' : null;
      return { ok: !message, message };
    }
    case 'ORDER_CREATE':
    case 'ORDER_UPDATE': {
      const current = action.type === 'ORDER_UPDATE' ? state.orders.find((item) => item.id === action.orderId) : null;
      const message = action.type === 'ORDER_UPDATE' && (!current || !['Pedido recibido', 'Confirmado'].includes(current.status)) ? 'El pedido ya no se puede editar.' : validateOrder(state, action.payload);
      return { ok: !message, message };
    }
    case 'ORDER_ADVANCE': {
      const order = state.orders.find((item) => item.id === action.orderId);
      if (!order || order.status !== action.expectedStatus) return { ok: false, message: 'El pedido cambió de estado; actualizá la operación.' };
      if (order.status === 'Confirmado' && getOrderShortages(state, order).length) return { ok: false, message: 'No hay inventario disponible para reservar los ingredientes.' };
      const nextStatus = ORDER_STATUSES[ORDER_STATUSES.indexOf(order.status) + 1];
      if (nextStatus === 'Entregado' && order.paymentMethod === 'Cargar a la habitación') {
        const stay = state.stays.find((item) => item.id === order.stayId && item.status === 'Activa');
        const account = state.accounts.find((item) => item.id === stay?.accountId && item.status === 'Abierta');
        if (!stay || !account) return { ok: false, message: 'No se puede entregar: la estadía o cuenta de habitación ya no está activa.' };
      }
      if (order.status === 'Entregado' && order.paymentMethod !== 'Cargar a la habitación' && !getOpenCashSession(state)) return { ok: false, message: 'Abrí una caja antes de registrar el pago.' };
      return { ok: ORDER_STATUSES.indexOf(order.status) < ORDER_STATUSES.indexOf('Pagado'), message: 'El pedido ya está cerrado.' };
    }
    case 'ORDER_CANCEL': {
      const order = state.orders.find((item) => item.id === action.orderId);
      const ok = order && order.status === action.expectedStatus && ['Pedido recibido', 'Confirmado', 'En preparación'].includes(order.status);
      return { ok: Boolean(ok), message: 'El pedido ya no admite cancelación.' };
    }
    case 'MAINTENANCE_PROGRESS': {
      const ticket = state.maintenanceTickets.find((item) => item.id === action.ticketId);
      const sequence = ['Reportado', 'Asignado', 'En reparación', 'Solucionado', 'Cerrado'];
      const nextStatus = ticket ? sequence[sequence.indexOf(ticket.status) + 1] : null;
      const ok = ticket && ticket.status === action.expectedStatus && nextStatus && (nextStatus !== 'Solucionado' || action.note?.trim() || ticket.solution);
      return { ok: Boolean(ok), message: nextStatus === 'Solucionado' ? 'Registrá una nota de solución antes de resolver.' : 'El ticket cambió de estado o ya está cerrado.' };
    }
    case 'MAINTENANCE_CREATE': {
      const payload = action.payload;
      const message = !state.rooms.some((item) => item.id === payload?.roomId) ? 'La habitación no existe.' : !hasText(payload?.type) || !hasText(payload?.description) ? 'Indicá tipo y descripción del mantenimiento.' : null;
      return { ok: !message, message };
    }
    case 'MAINTENANCE_UPDATE': {
      const ticket = state.maintenanceTickets.find((item) => item.id === action.ticketId);
      return { ok: Boolean(ticket && !CLOSED_MAINTENANCE_STATUSES.includes(ticket.status)), message: 'El ticket cerrado debe reabrirse antes de editarlo.' };
    }
    case 'MAINTENANCE_REOPEN': {
      const ticket = state.maintenanceTickets.find((item) => item.id === action.ticketId);
      return { ok: Boolean(ticket && CLOSED_MAINTENANCE_STATUSES.includes(ticket.status)), message: 'Sólo se pueden reabrir tickets solucionados o cerrados.' };
    }
    case 'INCIDENT_PROGRESS': {
      const incident = state.incidents.find((item) => item.id === action.incidentId);
      const nextStatus = incident && ({ Pendiente: 'Asignada', Asignada: 'En proceso', 'En proceso': 'Resuelta', Resuelta: 'Cerrada' })[incident.status];
      const ok = incident && incident.status === action.expectedStatus && nextStatus && (nextStatus !== 'Resuelta' || action.note?.trim() || incident.solution);
      return { ok: Boolean(ok), message: nextStatus === 'Resuelta' ? 'Registrá una nota de solución antes de resolver.' : 'La incidencia cambió de estado o ya está cerrada.' };
    }
    case 'INCIDENT_UPDATE': {
      const incident = state.incidents.find((item) => item.id === action.incidentId);
      return { ok: Boolean(incident && incident.status !== 'Cerrada'), message: 'La incidencia cerrada debe reabrirse antes de editarla.' };
    }
    case 'INCIDENT_REOPEN': {
      const incident = state.incidents.find((item) => item.id === action.incidentId);
      return { ok: Boolean(incident && CLOSED_INCIDENT_STATUSES.includes(incident.status)), message: 'Sólo se pueden reabrir incidencias resueltas o cerradas.' };
    }
    case 'INCIDENT_CREATE': {
      const payload = action.payload;
      const message = !hasText(payload?.description) ? 'Indicá la descripción de la incidencia.' : payload.roomId && !state.rooms.some((item) => item.id === payload.roomId) ? 'La habitación vinculada no existe.' : null;
      return { ok: !message, message };
    }
    case 'INVENTORY_ADJUST': {
      const item = state.inventory.find((entry) => entry.id === action.itemId);
      const quantity = Number(action.quantity);
      const nextStock = item ? item.stock + quantity : -1;
      const ok = item && item.status !== 'Archivado' && Number.isFinite(quantity) && quantity !== 0 && Number.isFinite(nextStock) && nextStock >= 0 && nextStock >= item.reserved;
      return { ok: Boolean(ok), message: !item ? 'El producto no existe.' : nextStock < item.reserved ? 'El ajuste dejaría stock físico por debajo de lo reservado.' : 'Indicá una cantidad válida.' };
    }
    case 'INVENTORY_ITEM_CREATE': {
      const payload = action.payload;
      const duplicate = state.inventory.some((item) => item.name.toLowerCase() === payload.name?.trim().toLowerCase() && item.lot === payload.lot);
      const stock = Number(payload.stock);
      const reserved = Number(payload.reserved || 0);
      const ok = payload.name?.trim() && payload.lot?.trim() && Number.isFinite(stock) && Number.isFinite(reserved) && isFiniteAtLeast(payload.minimum || 0) && isFiniteAtLeast(payload.cost || 0) && stock >= reserved && reserved >= 0 && !duplicate;
      return { ok: Boolean(ok), message: duplicate ? 'Ese producto y lote ya existen.' : 'Revisá nombre, lote, stock físico y reservado.' };
    }
    case 'INVENTORY_ITEM_UPDATE': {
      const duplicate = state.inventory.some((item) => item.id !== action.itemId && item.name.toLowerCase() === action.payload.name?.trim().toLowerCase() && item.lot === action.payload.lot);
      const ok = state.inventory.some((item) => item.id === action.itemId && item.status !== 'Archivado') && action.payload.name?.trim() && isFiniteAtLeast(action.payload.minimum) && isFiniteAtLeast(action.payload.cost) && !duplicate;
      return { ok: Boolean(ok), message: duplicate ? 'Ese producto y lote ya existen.' : 'Revisá los datos del producto o lote.' };
    }
    case 'INVENTORY_ITEM_ARCHIVE': {
      const item = state.inventory.find((entry) => entry.id === action.itemId);
      return { ok: Boolean(item && item.status !== 'Archivado' && item.reserved === 0), message: item?.reserved ? 'No se puede archivar un lote con stock reservado.' : 'El lote ya no está activo.' };
    }
    case 'SUPPLIER_CREATE':
      return { ok: Boolean(action.payload.businessName?.trim() && action.payload.ruc?.trim() && isFiniteAtLeast(action.payload.averageDeliveryDays || 0) && !state.suppliers.some((item) => item.ruc === action.payload.ruc.trim())), message: 'Revisá razón social, RUC y días de entrega; el RUC no puede repetirse.' };
    case 'SUPPLIER_UPDATE': {
      const duplicate = state.suppliers.some((item) => item.id !== action.supplierId && item.ruc === action.payload.ruc?.trim());
      const ok = state.suppliers.some((item) => item.id === action.supplierId && item.status !== 'Archivado') && action.payload.businessName?.trim() && action.payload.ruc?.trim() && isFiniteAtLeast(action.payload.averageDeliveryDays || 0) && !duplicate;
      return { ok: Boolean(ok), message: duplicate ? 'El RUC ya pertenece a otro proveedor.' : 'El proveedor archivado no se puede editar.' };
    }
    case 'SUPPLIER_ARCHIVE': {
      const linked = state.inventory.some((item) => item.supplierId === action.supplierId && item.status !== 'Archivado');
      return { ok: Boolean(state.suppliers.some((item) => item.id === action.supplierId) && !linked), message: linked ? 'Archivá o reasigná primero sus lotes activos.' : 'El proveedor no existe.' };
    }
    case 'CASH_OPEN':
      return { ok: Boolean(!getOpenCashSession(state) && isFiniteAtLeast(action.payload.openingAmount) && action.payload.responsible.trim()), message: getOpenCashSession(state) ? 'Ya existe una caja abierta.' : 'Revisá responsable y fondo inicial.' };
    case 'CASH_MOVEMENT':
      return { ok: Boolean(getOpenCashSession(state) && isFiniteGreaterThan(action.payload.amount) && action.payload.concept.trim()), message: getOpenCashSession(state) ? 'Revisá concepto e importe.' : 'No se pueden registrar movimientos con la caja cerrada.' };
    case 'CASH_COUNT':
    case 'CASH_CLOSE': {
      const session = getOpenCashSession(state);
      const amount = Number(action.countedAmount);
      return { ok: Boolean(session && Number.isFinite(amount) && amount >= 0), message: session ? 'Ingresá un conteo válido.' : 'No hay una caja abierta.' };
    }
    case 'NOTIFICATIONS_READ_ALL':
      return { ok: state.notifications.some((item) => !item.read), message: 'No hay notificaciones sin leer.' };
    default:
      return { ok: false, message: `Acción no admitida: ${action.type || 'sin tipo'}.` };
  }
};

const syncRoomBalances = (state) => ({
  ...state,
  rooms: state.rooms.map((room) => {
    if (!room.activeStayId) return room.balance === 0 ? room : { ...room, balance: 0 };
    const stay = state.stays.find((item) => item.id === room.activeStayId);
    const account = state.accounts.find((item) => item.id === stay?.accountId);
    const balance = selectAccountBalance(account);
    return room.balance === balance ? room : { ...room, balance };
  }),
});

export function hotelReducer(state, action) {
  if (!validateHotelAction(state, action).ok) return state;
  switch (action.type) {
    case 'CLIENT_CREATE': {
      const client = { ...action.payload, documentNumber: normalizeDocument(action.payload.documentNumber), id: nextId('CLI', state.clients), name: `${action.payload.firstName} ${action.payload.lastName}`.trim(), visits: 0, totalSpent: 0, loyaltyTier: 'Bronce', loyaltyPoints: 0, promoAuth: false, petIds: [], rating: null, preferences: [], status: 'Activo' };
      return addAudit({ ...state, clients: [client, ...state.clients] }, 'Registró cliente', 'Clientes', client.id, client.name);
    }
    case 'CLIENT_UPDATE': {
      const current = state.clients.find((client) => client.id === action.clientId);
      if (!current || Object.entries(action.changes).every(([key, value]) => current[key] === value)) return state;
      const changes = { ...action.changes };
      if (changes.documentNumber) changes.documentNumber = normalizeDocument(changes.documentNumber);
      if (changes.firstName || changes.lastName) changes.name = `${changes.firstName ?? current.firstName} ${changes.lastName ?? current.lastName}`.trim();
      const clients = state.clients.map((client) => client.id === action.clientId ? { ...client, ...changes, updatedAt: new Date().toISOString() } : client);
      return addAudit({ ...state, clients }, 'Actualizó cliente', 'Clientes', action.clientId, Object.keys(action.changes).join(', '));
    }
    case 'CLIENT_ARCHIVE':
      return addAudit({ ...state, clients: state.clients.map((client) => client.id === action.clientId ? { ...client, status: 'Archivado', archivedAt: new Date().toISOString(), archiveReason: action.reason } : client) }, 'Archivó cliente', 'Clientes', action.clientId, action.reason);
    case 'CLIENT_REACTIVATE':
      return addAudit({ ...state, clients: state.clients.map((client) => client.id === action.clientId ? { ...client, status: 'Activo', reactivatedAt: new Date().toISOString(), reactivationReason: action.reason } : client) }, 'Reactivó cliente', 'Clientes', action.clientId, action.reason);
    case 'ROOM_UPDATE': {
      const payload = action.payload;
      const rooms = state.rooms.map((room) => room.id === action.roomId ? { ...room, nightlyRate: Number(payload.nightlyRate), capacity: Number(payload.capacity), beds: payload.beds.trim(), amenities: { ...payload.amenities }, updatedAt: new Date().toISOString() } : room);
      return addAudit({ ...state, rooms }, 'Actualizó habitación', 'Habitaciones', action.roomId, 'Tarifa, capacidad, camas y comodidades');
    }
    case 'ROOM_BLOCK': {
      const changedAt = new Date().toISOString();
      const rooms = state.rooms.map((room) => room.id === action.roomId ? { ...room, operationalBlock: true, status: 'Bloqueada', blockReason: action.reason, blockedBy: action.responsible || 'Administrador demo', blockedAt: changedAt } : room);
      return addAudit({ ...state, rooms }, 'Bloqueó habitación', 'Habitaciones', action.roomId, action.reason, { user: action.responsible || 'Administrador demo' });
    }
    case 'ROOM_UNBLOCK': {
      let nextState = { ...state, rooms: state.rooms.map((room) => room.id === action.roomId ? { ...room, operationalBlock: false, blockReason: null, unblockedBy: action.responsible || 'Administrador demo', unblockedAt: new Date().toISOString() } : room) };
      nextState = { ...nextState, rooms: updateRoomStatus(nextState, action.roomId) };
      return addAudit(nextState, 'Desbloqueó habitación', 'Habitaciones', action.roomId, action.reason, { user: action.responsible || 'Administrador demo' });
    }
    case 'BIOMETRIC_ENROLLED': {
      const collection = action.subjectType === 'client' ? 'clients' : 'staff';
      if (!state[collection].some((item) => item.id === action.subjectId)) return state;
      const records = state[collection].map((item) => item.id === action.subjectId ? { ...item, biometric: { templateReference: action.templateReference, enrolledAt: action.enrolledAt } } : item);
      return addAudit({ ...state, [collection]: records }, 'Enroló huella', 'Biometría', action.subjectId, `Referencia opaca ${action.templateReference}`);
    }
    case 'BIOMETRIC_ATTEMPT':
      return addAudit(state, action.kind === 'enroll' ? 'Intento de enrolamiento' : 'Intento de verificación', 'Biometría', action.subjectId, `${action.result}${action.score == null ? '' : `; puntaje ${action.score}`}${action.errorCode ? `; ${action.errorCode}` : ''}`);
    case 'STAFF_ATTENDANCE_VERIFIED': {
      const person = state.staff.find((item) => item.id === action.staffId);
      if (!person) return state;
      const createdAt = new Date().toISOString();
      const context = getAttendanceContext(state, person.id, new Date(createdAt));
      const attendance = `${context.expectedMovement} biométrica ${new Date(createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
      const entry = { id: nextId('ASI', state.attendanceLog), staffId: person.id, movement: context.expectedMovement, method: 'Biométrica', responsible: 'Bridge ZK9500', reason: 'Coincidencia reportada por bridge local', observation: `Puntaje ${action.score}`, requestId: action.requestId, calendarDate: context.calendarDate, shiftId: context.shiftId, createdAt };
      return addAudit({ ...state, attendanceLog: [entry, ...state.attendanceLog], staff: state.staff.map((item) => item.id === person.id ? { ...item, attendance, attendanceVerifiedAt: createdAt } : item) }, 'Registró asistencia biométrica', 'Personal', person.id, `Coincidencia confirmada; puntaje ${action.score}`);
    }
    case 'RESERVATION_CONFIRM': {
      const room = state.rooms.find((item) => item.id === action.payload.roomId);
      const nights = nightsBetween(action.payload.checkIn, action.payload.checkOut);
      const nightlyRate = room.nightlyRate || ROOM_PRICING[room.category];
      const total = nightlyRate * nights + Number(action.payload.extraGuests || 0) * 45 * nights + (action.payload.services?.length || 0) * 20;
      const advance = total / 2;
      const reservationId = nextId('RES', state.reservations);
      const contractId = `HP-${new Date().getFullYear()}-${String(state.contracts.length + 1).padStart(6, '0')}`;
      const paymentId = nextId('PAG', state.payments);
      const reservation = { ...action.payload, id: reservationId, category: room.category, nights, nightlyRate, total, advance, balance: total - advance, refundableCredit: 0, status: 'Confirmada', contractId };
      const contract = { id: contractId, reservationId, clientId: action.payload.clientId, roomId: room.id, status: 'Pendiente de firma', version: 1, generatedAt: new Date().toISOString(), signedDocument: null, versions: [{ version: 1, reason: 'Generación por confirmación de reserva' }] };
      const payment = { id: paymentId, clientId: action.payload.clientId, reservationId, accountId: null, orderId: null, amount: advance, method: action.payload.paymentMethod, operationNumber: action.payload.operationNumber || 'Referencia de prototipo', status: 'Registrado', concept: 'Adelanto 50 %', createdAt: new Date().toISOString(), responsible: 'Administrador demo' };
      const notification = { id: nextId('NOT', state.notifications), type: 'info', title: 'Reserva confirmada', description: `${reservationId}: adelanto y contrato registrados. Envío externo pendiente de integración.`, route: 'reservas', read: false };
      const movement = createCashMovement(state, { type: 'Ingreso', concept: `Adelanto ${reservationId}`, referenceId: paymentId, amount: advance, method: payment.method });
      const nextState = {
        ...state,
        reservations: [reservation, ...state.reservations], contracts: [contract, ...state.contracts], payments: [payment, ...state.payments],
        documents: [{ id: nextId('DOC', state.documents), type: 'Contrato de hospedaje', referenceId: contractId, status: 'Generado', fiscalStatus: 'No aplica' }, ...state.documents],
        cashMovements: movement ? [movement, ...state.cashMovements] : state.cashMovements,
        notifications: [notification, ...state.notifications],
      };
      return addAudit({ ...nextState, rooms: updateRoomStatus(nextState, room.id) }, 'Confirmó reserva y generó contrato', 'Reservas', reservationId, `${contractId}; adelanto ${advance}${movement ? '' : '; sin caja abierta'}`);
    }
    case 'RESERVATION_UPDATE': {
      const current = state.reservations.find((item) => item.id === action.reservationId);
      const room = state.rooms.find((item) => item.id === action.payload.roomId);
      const nights = nightsBetween(action.payload.checkIn, action.payload.checkOut);
      const nightlyRate = room.nightlyRate || ROOM_PRICING[room.category];
      const total = nightlyRate * nights + Number(action.payload.extraGuests || 0) * 45 * nights + (action.payload.services?.length || 0) * 20;
      const updated = { ...current, ...action.payload, category: room.category, nights, nightlyRate, total, balance: Math.max(0, total - current.advance), refundableCredit: Math.max(0, current.advance - total), updatedAt: new Date().toISOString() };
      let nextState = {
        ...state,
        reservations: state.reservations.map((item) => item.id === current.id ? updated : item),
        contracts: state.contracts.map((contract) => contract.id === current.contractId ? { ...contract, roomId: room.id, version: contract.version + 1, versions: [...contract.versions, { version: contract.version + 1, reason: action.reason || 'Reprogramación de reserva' }] } : contract),
      };
      nextState = { ...nextState, rooms: updateRoomStatus(nextState, current.roomId) };
      nextState = { ...nextState, rooms: updateRoomStatus(nextState, room.id) };
      return addAudit(nextState, 'Reprogramó reserva', 'Reservas', current.id, `${current.roomId} ${current.checkIn}/${current.checkOut} → ${room.id} ${updated.checkIn}/${updated.checkOut}`);
    }
    case 'RESERVATION_STATUS': {
      const current = state.reservations.find((item) => item.id === action.reservationId);
      const changedAt = new Date().toISOString();
      const reservations = state.reservations.map((item) => item.id === current.id ? { ...item, status: action.status, statusReason: action.reason || 'Sin detalle', statusChangedAt: changedAt } : item);
      const contracts = state.contracts.map((contract) => contract.id === current.contractId ? { ...contract, status: action.status, version: contract.version + 1, versions: [...contract.versions, { version: contract.version + 1, reason: `${action.status}: ${action.reason || 'Sin detalle'}` }] } : contract);
      const nextState = { ...state, reservations, contracts };
      return addAudit({ ...nextState, rooms: updateRoomStatus(nextState, current.roomId) }, `${action.status === 'Cancelada' ? 'Canceló' : action.status === 'No presentado' ? 'Marcó no-show' : 'Expiró'} reserva`, 'Reservas', current.id, action.reason || action.status);
    }
    case 'CHECK_IN': {
      const reservation = state.reservations.find((item) => item.id === action.reservationId);
      if (!reservation || reservation.status !== 'Confirmada') return state;
      const stayId = nextId('EST', state.stays);
      const accountId = nextId('CTA', state.accounts);
      const advancePayment = state.payments.find((item) => item.reservationId === reservation.id && !item.reversalOf && item.status === 'Registrado');
      const stay = { id: stayId, reservationId: reservation.id, clientId: reservation.clientId, roomId: reservation.roomId, accountId, status: 'Activa', checkInAt: new Date().toISOString(), expectedCheckOut: reservation.checkOut, accessIds: [], identityValidation: { ...action.identityValidation } };
      const account = { id: accountId, stayId, roomId: reservation.roomId, status: 'Abierta', refundableCredit: reservation.refundableCredit || 0, charges: [{ id: `CAR-${reservation.id}`, concept: `Hospedaje ${reservation.nights} noche(s)`, category: 'Hospedaje', amount: reservation.total, createdAt: stay.checkInAt }], payments: reservation.advance > 0 ? [{ id: `AP-${reservation.id}`, sourcePaymentId: advancePayment.id, amount: reservation.advance, method: reservation.paymentMethod, createdAt: stay.checkInAt }] : [] };
      return addAudit({
        ...state,
        reservations: state.reservations.map((item) => item.id === reservation.id ? { ...item, status: 'Cliente presente' } : item),
        contracts: state.contracts.map((item) => item.id === reservation.contractId ? { ...item, status: 'Firmado', signedDocument: action.identityValidation.method === 'documentary' ? `Validación documental ${action.identityValidation.documentType} ${action.identityValidation.documentNumber}` : 'Identidad biométrica verificada por bridge local' } : item),
        rooms: state.rooms.map((item) => item.id === reservation.roomId ? { ...item, status: 'Ocupada', guestId: reservation.clientId, activeStayId: stayId, checkInAt: stay.checkInAt, expectedCheckOut: stay.expectedCheckOut, balance: reservation.balance } : item),
        stays: [stay, ...state.stays], accounts: [account, ...state.accounts],
      }, 'Completó check-in', 'Check-in', stayId, `${action.identityValidation.method === 'biometric' ? 'Identidad biométrica coincidente' : `Documento ${action.identityValidation.documentType} validado por ${action.identityValidation.responsible}`}; habitación ${reservation.roomId}`);
    }
    case 'ORDER_ADVANCE': {
      const order = state.orders.find((item) => item.id === action.orderId);
      if (!order || (action.expectedStatus && order.status !== action.expectedStatus)) return state;
      const currentIndex = ORDER_STATUSES.indexOf(order.status);
      if (currentIndex < 0 || currentIndex >= ORDER_STATUSES.indexOf('Pagado')) return state;
      const nextStatus = ORDER_STATUSES[currentIndex + 1];
      let inventory = state.inventory;
      let inventoryStage = order.inventoryStage;
      let accountingStage = order.accountingStage || 'Pendiente';
      const requirements = getOrderRequirements(state, order);

      if (nextStatus === 'En preparación' && inventoryStage === 'Sin reservar') {
        if (getOrderShortages(state, order).length > 0) return state;
        inventory = inventory.map((item) => {
          const required = requirements.filter((entry) => entry.inventoryId === item.id).reduce((sum, entry) => sum + entry.quantity, 0);
          return required ? { ...item, reserved: item.reserved + required } : item;
        });
        inventoryStage = 'Reservado';
      }
      if (nextStatus === 'Listo' && inventoryStage === 'Reservado') {
        const inconsistent = inventory.some((item) => {
          const required = requirements.filter((entry) => entry.inventoryId === item.id).reduce((sum, entry) => sum + entry.quantity, 0);
          return required > 0 && (item.stock < required || item.reserved < required);
        });
        if (inconsistent) return state;
        inventory = inventory.map((item) => {
          const required = requirements.filter((entry) => entry.inventoryId === item.id).reduce((sum, entry) => sum + entry.quantity, 0);
          return required ? { ...item, stock: item.stock - required, reserved: item.reserved - required } : item;
        });
        inventoryStage = 'Consumido';
      }

      let inventoryLedger = state.inventoryLedger;
      if (nextStatus === 'En preparación' && order.inventoryStage === 'Sin reservar') inventoryLedger = [...createLedgerEntries(state, requirements, 'Reserva', order.id, -1), ...inventoryLedger];
      if (nextStatus === 'Listo' && order.inventoryStage === 'Reservado') inventoryLedger = [...createLedgerEntries(state, requirements, 'Consumo', order.id, -1), ...inventoryLedger];

      let accounts = state.accounts;
      let payments = state.payments;
      let cashMovements = state.cashMovements;
      if (nextStatus === 'Entregado' && order.paymentMethod === 'Cargar a la habitación') {
        const stay = state.stays.find((item) => item.id === order.stayId && item.status === 'Activa');
        const account = state.accounts.find((item) => item.id === stay?.accountId && item.status === 'Abierta');
        if (!stay || !account) return state;
        const chargeId = `CAR-${order.id}`;
        accounts = accounts.map((item) => item.id === account.id && !item.charges.some((charge) => charge.id === chargeId) ? { ...item, charges: [...item.charges, { id: chargeId, concept: `Pedido ${order.id}`, category: 'Restaurante', amount: order.total, createdAt: new Date().toISOString() }] } : item);
        accountingStage = 'Cargado a cuenta';
      } else if (nextStatus === 'Entregado') {
        accountingStage = 'Pendiente de pago';
      }

      if (nextStatus === 'Pagado' && order.paymentMethod !== 'Cargar a la habitación') {
        if (state.payments.some((payment) => payment.orderId === order.id)) return state;
        const payment = { id: nextId('PAG', state.payments), clientId: order.stayId ? state.stays.find((stay) => stay.id === order.stayId)?.clientId || null : null, reservationId: null, accountId: null, orderId: order.id, amount: order.total, method: order.paymentMethod, operationNumber: action.operationNumber || `PED-${order.id}`, status: 'Registrado', concept: `Pago de pedido ${order.id}`, createdAt: new Date().toISOString(), responsible: 'Administrador demo' };
        const movement = createCashMovement(state, { type: 'Ingreso', concept: `Pago de pedido ${order.id}`, referenceId: payment.id, amount: order.total, method: order.paymentMethod });
        payments = [payment, ...payments];
        cashMovements = [movement, ...cashMovements];
        accountingStage = 'Pagado';
      }

      const orders = state.orders.map((item) => item.id === order.id ? { ...item, status: nextStatus, inventoryStage, accountingStage } : item);
      return addAudit(syncRoomBalances({ ...state, inventory, inventoryLedger, accounts, payments, cashMovements, orders }), 'Actualizó pedido', 'Pedidos QR', order.id, `${nextStatus}; ${accountingStage}`);
    }
    case 'ORDER_CREATE': {
      const items = action.payload.items.map((item) => { const recipe = state.recipes.find((entry) => entry.id === item.recipeId); return { recipeId: recipe.id, name: recipe.name, quantity: Number(item.quantity), price: recipe.salePrice, ingredientSnapshot: recipe.ingredients.map((ingredient) => ({ ...ingredient })) }; });
      const stay = state.stays.find((item) => item.id === action.payload.stayId);
      const order = { ...action.payload, id: nextId('PED', state.orders), stayId: stay?.id || null, roomId: stay?.roomId || null, items, total: items.reduce((sum, item) => sum + item.quantity * item.price, 0), status: 'Pedido recibido', inventoryStage: 'Sin reservar', accountingStage: 'Pendiente', createdAt: new Date().toISOString() };
      return addAudit({ ...state, orders: [order, ...state.orders] }, 'Creó pedido', 'Pedidos QR', order.id, `${order.source}; ${order.items.length} línea(s)`);
    }
    case 'ORDER_UPDATE': {
      const current = state.orders.find((item) => item.id === action.orderId);
      const items = action.payload.items.map((item) => { const recipe = state.recipes.find((entry) => entry.id === item.recipeId); return { recipeId: recipe.id, name: recipe.name, quantity: Number(item.quantity), price: recipe.salePrice, ingredientSnapshot: recipe.ingredients.map((ingredient) => ({ ...ingredient })) }; });
      const stay = state.stays.find((item) => item.id === action.payload.stayId);
      const updated = { ...current, ...action.payload, stayId: stay?.id || null, roomId: stay?.roomId || null, items, total: items.reduce((sum, item) => sum + item.quantity * item.price, 0), updatedAt: new Date().toISOString() };
      return addAudit({ ...state, orders: state.orders.map((item) => item.id === current.id ? updated : item) }, 'Editó pedido', 'Pedidos QR', current.id, `${items.length} línea(s); total ${updated.total}`);
    }
    case 'ORDER_CANCEL': {
      const order = state.orders.find((item) => item.id === action.orderId);
      if (!order || (action.expectedStatus && order.status !== action.expectedStatus) || ['Listo', 'En camino', 'Entregado', 'Pagado', 'Cancelado'].includes(order.status)) return state;
      let inventory = state.inventory;
      if (order.inventoryStage === 'Reservado') {
        const requirements = getOrderRequirements(state, order);
        inventory = inventory.map((item) => {
          const required = requirements.filter((entry) => entry.inventoryId === item.id).reduce((sum, entry) => sum + entry.quantity, 0);
          return required ? { ...item, reserved: item.reserved - required } : item;
        });
      }
      const inventoryLedger = order.inventoryStage === 'Reservado' ? [...createLedgerEntries(state, getOrderRequirements(state, order), 'Liberación', order.id, 1), ...state.inventoryLedger] : state.inventoryLedger;
      return addAudit({ ...state, inventory, inventoryLedger, orders: state.orders.map((item) => item.id === order.id ? { ...item, status: 'Cancelado', inventoryStage: order.inventoryStage === 'Reservado' ? 'Liberado' : item.inventoryStage, cancelledAt: new Date().toISOString(), cancellationReason: action.reason || 'Cancelación operativa' } : item) }, 'Canceló pedido', 'Pedidos QR', order.id, action.reason || 'Reserva de inventario liberada');
    }
    case 'CHECK_OUT': {
      const stay = state.stays.find((item) => item.id === action.stayId);
      const account = state.accounts.find((item) => item.id === stay?.accountId);
      if (!stay || !account || stay.status !== 'Activa' || account.status !== 'Abierta') return state;
      const balance = selectAccountBalance(account);
      const createdAt = new Date().toISOString();
      const payment = balance > 0 ? { id: nextId('PAG', state.payments), clientId: stay.clientId, reservationId: stay.reservationId, accountId: account.id, orderId: null, amount: balance, method: action.paymentMethod, operationNumber: action.operationNumber || 'Referencia de prototipo', status: 'Registrado', concept: 'Liquidación final de estadía', createdAt, responsible: 'Administrador demo' } : null;
      const movement = payment ? createCashMovement(state, { type: 'Ingreso', concept: `Liquidación ${stay.id}`, referenceId: payment.id, amount: balance, method: action.paymentMethod }) : null;
      const cleaningTask = { id: nextId('LIM', state.cleaningTasks), roomId: stay.roomId, status: 'Pendiente', assignedTo: 'Por asignar', reason: 'Check-out completado', startedAt: null, completedAt: null, evidence: [] };
      return addAudit({
        ...state,
        stays: state.stays.map((item) => item.id === stay.id ? { ...item, status: 'Finalizada', checkedOutAt: createdAt } : item),
        accounts: state.accounts.map((item) => item.id === account.id ? { ...item, status: 'Cerrada', payments: payment ? [...item.payments, { id: payment.id, amount: balance, method: action.paymentMethod, createdAt }] : item.payments } : item),
        payments: payment ? [payment, ...state.payments] : state.payments,
        reservations: state.reservations.map((item) => item.id === stay.reservationId ? { ...item, status: 'Completada', balance: 0 } : item),
        contracts: state.contracts.map((item) => item.reservationId === stay.reservationId ? { ...item, status: 'Finalizado' } : item),
        rooms: state.rooms.map((item) => item.id === stay.roomId ? { ...item, status: 'En limpieza', guestId: null, activeStayId: null, balance: 0, cleaningStatus: 'Pendiente' } : item),
        cleaningTasks: [cleaningTask, ...state.cleaningTasks],
        recreationAccess: state.recreationAccess.map((access) => access.stayId === stay.id && access.status !== 'Finalizado' ? { ...access, status: 'Finalizado', peopleInside: 0 } : access),
        cashMovements: movement ? [movement, ...state.cashMovements] : state.cashMovements,
        documents: [{ id: nextId('DOC', state.documents), type: 'Resumen final de consumo', referenceId: account.id, status: 'Borrador interno', fiscalStatus: 'Integración fiscal pendiente' }, ...state.documents],
      }, 'Completó check-out', 'Check-out', stay.id, `Cuenta ${account.id} cerrada; acceso desactivado; limpieza creada`);
    }
    case 'CLEANING_PROGRESS': {
      const task = state.cleaningTasks.find((item) => item.id === action.taskId);
      if (!task || task.status === 'Aprobada' || (action.expectedStatus && task.status !== action.expectedStatus)) return state;
      const nextStatus = task.status === 'Pendiente' ? 'En proceso' : task.status === 'En proceso' ? 'Completada' : 'Aprobada';
      const cleaningTasks = state.cleaningTasks.map((item) => item.id === task.id ? { ...item, status: nextStatus, startedAt: nextStatus === 'En proceso' ? new Date().toISOString() : item.startedAt, completedAt: nextStatus === 'Completada' ? new Date().toISOString() : item.completedAt, evidence: action.evidence?.trim() ? [...item.evidence, action.evidence.trim()] : item.evidence } : item);
      const nextState = { ...state, cleaningTasks };
      const rooms = nextStatus === 'Aprobada' ? updateRoomStatus(nextState, task.roomId).map((room) => room.id === task.roomId ? { ...room, cleaningStatus: 'Aprobada' } : room) : state.rooms;
      return addAudit({ ...nextState, rooms }, 'Actualizó limpieza', 'Limpieza', task.id, nextStatus);
    }
    case 'CLEANING_UPDATE': {
      const task = state.cleaningTasks.find((item) => item.id === action.taskId);
      const evidence = action.evidence?.trim() ? [...task.evidence, action.evidence.trim()] : task.evidence;
      const cleaningTasks = state.cleaningTasks.map((item) => item.id === task.id ? { ...item, assignedTo: action.assignedTo.trim(), observation: action.observation?.trim() || '', evidence, updatedAt: new Date().toISOString() } : item);
      return addAudit({ ...state, cleaningTasks }, 'Asignó limpieza', 'Limpieza', task.id, `${action.assignedTo}; ${action.observation || 'Sin observación'}`);
    }
    case 'CLEANING_INCIDENT': {
      const task = state.cleaningTasks.find((item) => item.id === action.taskId);
      if (!task || !hasText(action.description)) return state;
      const incident = { id: nextId('INC', state.incidents), type: 'Limpieza', referenceId: task.id, roomId: task.roomId, description: action.description.trim(), priority: action.priority || 'Media', responsible: action.responsible || task.assignedTo, status: 'Pendiente', evidence: action.evidence?.trim() ? [action.evidence.trim()] : [], solution: '', blocksRoom: Boolean(action.blocksRoom), createdAt: new Date().toISOString() };
      const nextState = { ...state, incidents: [incident, ...state.incidents], rooms: state.rooms.map((room) => room.id === task.roomId ? { ...room, incidentIds: [...new Set([...room.incidentIds, incident.id])], status: incident.blocksRoom ? 'Bloqueada' : room.status } : room) };
      return addAudit(nextState, 'Creó incidencia desde limpieza', 'Limpieza', incident.id, `${task.id}; habitación ${task.roomId}`);
    }
    case 'MAINTENANCE_CREATE': {
      const ticket = { ...action.payload, id: nextId('MAN', state.maintenanceTickets), status: 'Reportado', evidence: action.payload.evidence ? [action.payload.evidence] : [], solution: '' };
      const incident = { id: nextId('INC', state.incidents), type: 'Mantenimiento', referenceId: ticket.id, roomId: ticket.roomId, description: ticket.description, priority: ticket.priority, responsible: ticket.assignedTo || 'Por asignar', status: 'Pendiente', evidence: ticket.evidence, solution: '' };
      const rooms = state.rooms.map((room) => room.id === ticket.roomId ? { ...room, status: room.activeStayId ? 'Ocupada' : ticket.severe ? 'Fuera de servicio' : 'En mantenimiento', incidentIds: [...new Set([...room.incidentIds, incident.id])] } : room);
      return addAudit({ ...state, rooms, maintenanceTickets: [ticket, ...state.maintenanceTickets], incidents: [incident, ...state.incidents] }, 'Reportó mantenimiento', 'Mantenimiento', ticket.id, ticket.severe ? 'Incidencia grave; habitación fuera de servicio' : ticket.priority);
    }
    case 'MAINTENANCE_UPDATE': {
      const ticket = state.maintenanceTickets.find((item) => item.id === action.ticketId);
      if (!ticket || CLOSED_MAINTENANCE_STATUSES.includes(ticket.status)) return state;
      const evidence = action.payload.evidence?.trim() ? [...ticket.evidence, action.payload.evidence.trim()] : ticket.evidence;
      const maintenanceTickets = state.maintenanceTickets.map((item) => item.id === ticket.id ? { ...item, assignedTo: action.payload.assignedTo || item.assignedTo, priority: action.payload.priority || item.priority, evidence, solution: action.payload.solution ?? item.solution } : item);
      const incidents = state.incidents.map((incident) => incident.referenceId === ticket.id ? { ...incident, responsible: action.payload.assignedTo || incident.responsible, priority: action.payload.priority || incident.priority, evidence, solution: action.payload.solution ?? incident.solution } : incident);
      return addAudit({ ...state, maintenanceTickets, incidents }, 'Actualizó ticket', 'Mantenimiento', ticket.id, action.payload.note || 'Asignación, prioridad o evidencia actualizada');
    }
    case 'MAINTENANCE_PROGRESS': {
      const sequence = ['Reportado', 'Asignado', 'En reparación', 'Solucionado', 'Cerrado'];
      const ticket = state.maintenanceTickets.find((item) => item.id === action.ticketId);
      if (!ticket || ticket.status !== action.expectedStatus || ticket.status === 'Cerrado') return state;
      const nextStatus = sequence[sequence.indexOf(ticket.status) + 1];
      if (nextStatus === 'Solucionado' && !action.note?.trim() && !ticket.solution) return state;
      const solution = nextStatus === 'Solucionado' ? action.note?.trim() || ticket.solution : ticket.solution;
      const maintenanceTickets = state.maintenanceTickets.map((item) => item.id === ticket.id ? { ...item, status: nextStatus, solution, updatedAt: new Date().toISOString() } : item);
      const incidentStatus = ({ Asignado: 'Asignada', 'En reparación': 'En proceso', Solucionado: 'Resuelta', Cerrado: 'Cerrada' })[nextStatus] || 'Pendiente';
      const incidents = state.incidents.map((incident) => incident.referenceId === ticket.id ? { ...incident, status: incidentStatus, solution } : incident);
      const nextState = { ...state, maintenanceTickets, incidents };
      const rooms = CLOSED_MAINTENANCE_STATUSES.includes(nextStatus) ? updateRoomStatus(nextState, ticket.roomId) : state.rooms;
      return addAudit({ ...nextState, rooms }, 'Avanzó ticket', 'Mantenimiento', ticket.id, `${nextStatus}${solution ? `; ${solution}` : ''}`);
    }
    case 'MAINTENANCE_REOPEN': {
      const ticket = state.maintenanceTickets.find((item) => item.id === action.ticketId);
      if (!ticket || !CLOSED_MAINTENANCE_STATUSES.includes(ticket.status)) return state;
      const maintenanceTickets = state.maintenanceTickets.map((item) => item.id === ticket.id ? { ...item, status: 'En reparación', reopenedAt: new Date().toISOString() } : item);
      const incidents = state.incidents.map((incident) => incident.referenceId === ticket.id ? { ...incident, status: 'En proceso' } : incident);
      const nextState = { ...state, maintenanceTickets, incidents };
      const rooms = updateRoomStatus(nextState, ticket.roomId);
      return addAudit({ ...nextState, rooms }, 'Reabrió ticket', 'Mantenimiento', ticket.id, action.reason || 'Reapertura operativa');
    }
    case 'INVENTORY_ADJUST': {
      const current = state.inventory.find((item) => item.id === action.itemId);
      const quantity = Number(action.quantity);
      const nextStock = current.stock + quantity;
      const type = quantity > 0 ? 'Entrada' : ['Merma', 'Vencimiento'].includes(action.reason) ? 'Merma' : action.reason === 'Consumo manual' ? 'Consumo' : 'Ajuste';
      const ledger = { id: nextId('LED', state.inventoryLedger), inventoryId: current.id, type, quantity, referenceId: action.referenceId || null, note: action.reason, createdAt: new Date().toISOString(), responsible: 'Administrador demo' };
      return addAudit({ ...state, inventory: state.inventory.map((item) => item.id === action.itemId ? { ...item, stock: nextStock } : item), inventoryLedger: [ledger, ...state.inventoryLedger] }, 'Ajustó inventario', 'Inventario', action.itemId, `${quantity}: ${action.reason}`);
    }
    case 'INVENTORY_ITEM_CREATE': {
      const payload = action.payload;
      if (!payload.name?.trim() || Number(payload.stock) < 0 || Number(payload.reserved || 0) < 0 || Number(payload.stock) < Number(payload.reserved || 0) || state.inventory.some((item) => item.name.toLowerCase() === payload.name.trim().toLowerCase() && item.lot === payload.lot)) return state;
      const item = { ...payload, id: nextId('INV', state.inventory), name: payload.name.trim(), stock: Number(payload.stock), reserved: Number(payload.reserved || 0), minimum: Number(payload.minimum || 0), cost: Number(payload.cost || 0), status: 'Activo' };
      const entry = { id: nextId('LED', state.inventoryLedger), inventoryId: item.id, type: 'Entrada', quantity: item.stock, referenceId: item.lot, note: 'Alta de producto/lote', createdAt: new Date().toISOString(), responsible: 'Administrador demo' };
      const inventory = [item, ...state.inventory];
      const stateWithEntry = { ...state, inventory, inventoryLedger: [entry, ...state.inventoryLedger] };
      const reservationEntries = item.reserved > 0 ? createLedgerEntries(stateWithEntry, [{ inventoryId: item.id, quantity: item.reserved }], 'Reserva', item.lot, -1) : [];
      return addAudit({ ...stateWithEntry, inventoryLedger: [...reservationEntries, ...stateWithEntry.inventoryLedger] }, 'Creó producto/lote', 'Inventario', item.id, `${item.name}; lote ${item.lot}; reservado ${item.reserved}`);
    }
    case 'INVENTORY_ITEM_UPDATE': {
      const current = state.inventory.find((item) => item.id === action.itemId);
      if (!current || current.status === 'Archivado') return state;
      const changes = { ...action.payload, minimum: Number(action.payload.minimum), cost: Number(action.payload.cost) };
      return addAudit({ ...state, inventory: state.inventory.map((item) => item.id === current.id ? { ...item, ...changes } : item) }, 'Actualizó producto/lote', 'Inventario', current.id, Object.keys(changes).join(', '));
    }
    case 'INVENTORY_ITEM_ARCHIVE': {
      const current = state.inventory.find((item) => item.id === action.itemId);
      if (!current || current.status === 'Archivado' || current.reserved > 0) return state;
      return addAudit({ ...state, inventory: state.inventory.map((item) => item.id === current.id ? { ...item, status: 'Archivado', archivedAt: new Date().toISOString() } : item) }, 'Archivó producto/lote', 'Inventario', current.id, action.reason || 'Fuera de catálogo');
    }
    case 'SUPPLIER_CREATE': {
      if (!action.payload.businessName?.trim() || !action.payload.ruc?.trim()) return state;
      const supplier = { ...action.payload, id: nextId('PRO', state.suppliers), businessName: action.payload.businessName.trim(), averageDeliveryDays: Number(action.payload.averageDeliveryDays || 0), status: 'Activo' };
      return addAudit({ ...state, suppliers: [supplier, ...state.suppliers] }, 'Creó proveedor', 'Inventario', supplier.id, supplier.businessName);
    }
    case 'SUPPLIER_UPDATE': {
      if (!state.suppliers.some((item) => item.id === action.supplierId)) return state;
      return addAudit({ ...state, suppliers: state.suppliers.map((item) => item.id === action.supplierId ? { ...item, ...action.payload } : item) }, 'Actualizó proveedor', 'Inventario', action.supplierId, Object.keys(action.payload).join(', '));
    }
    case 'SUPPLIER_ARCHIVE': {
      const supplier = state.suppliers.find((item) => item.id === action.supplierId);
      if (!supplier || state.inventory.some((item) => item.supplierId === supplier.id && item.status !== 'Archivado')) return state;
      return addAudit({ ...state, suppliers: state.suppliers.map((item) => item.id === supplier.id ? { ...item, status: 'Archivado', archivedAt: new Date().toISOString() } : item) }, 'Archivó proveedor', 'Inventario', supplier.id, action.reason || 'Sin productos activos');
    }
    case 'CONTRACT_ADDENDUM': {
      const contract = state.contracts.find((item) => item.id === action.contractId);
      const version = contract.version + 1;
      const contracts = state.contracts.map((item) => item.id === contract.id ? { ...item, version, internalReference: action.internalReference.trim(), versions: [...item.versions, { version, reason: action.reason.trim(), internalReference: action.internalReference.trim(), createdAt: new Date().toISOString(), responsible: action.responsible || 'Administrador demo' }] } : item);
      return addAudit({ ...state, contracts }, 'Registró adenda', 'Contratos', contract.id, `V${version}; ${action.internalReference}; ${action.reason}`);
    }
    case 'CONTRACT_VOID': {
      const contract = state.contracts.find((item) => item.id === action.contractId);
      const version = contract.version + 1;
      const contracts = state.contracts.map((item) => item.id === contract.id ? { ...item, status: 'Anulado', voidedAt: new Date().toISOString(), voidReason: action.reason, version, versions: [...item.versions, { version, reason: `Anulación: ${action.reason}`, internalReference: action.internalReference || null, createdAt: new Date().toISOString(), responsible: action.responsible || 'Administrador demo' }] } : item);
      return addAudit({ ...state, contracts }, 'Anuló contrato', 'Contratos', contract.id, action.reason);
    }
    case 'ACCOUNT_CHARGE': {
      const account = getOpenAccount(state, action.accountId);
      const charge = { id: nextId('CAR', state.accounts.flatMap((item) => item.charges)), concept: action.concept.trim(), category: action.category || 'Manual', amount: Number(action.amount), evidence: action.evidence?.trim() || null, requestId: action.requestId, createdAt: new Date().toISOString(), responsible: action.responsible || 'Administrador demo' };
      const accounts = state.accounts.map((item) => item.id === account.id ? { ...item, charges: [...item.charges, charge] } : item);
      return addAudit(syncRoomBalances({ ...state, accounts }), 'Registró cargo manual', 'Finanzas', charge.id, `${account.id}; ${charge.concept}; ${charge.amount}`, { requestId: action.requestId });
    }
    case 'ACCOUNT_PAYMENT': {
      const account = getOpenAccount(state, action.accountId);
      const stay = state.stays.find((item) => item.id === account.stayId);
      const createdAt = new Date().toISOString();
      const payment = { id: nextId('PAG', state.payments), clientId: stay?.clientId || null, reservationId: stay?.reservationId || null, accountId: account.id, orderId: null, amount: Number(action.amount), method: action.method, operationNumber: action.operationNumber || action.requestId, status: 'Registrado', concept: action.concept.trim(), createdAt, responsible: action.responsible || 'Administrador demo', requestId: action.requestId };
      const movement = createCashMovement(state, { type: 'Ingreso', concept: payment.concept, referenceId: payment.id, amount: payment.amount, method: payment.method, requestId: action.requestId });
      const accounts = state.accounts.map((item) => item.id === account.id ? { ...item, payments: [...item.payments, { id: payment.id, amount: payment.amount, method: payment.method, createdAt, requestId: action.requestId }] } : item);
      return addAudit(syncRoomBalances({ ...state, accounts, payments: [payment, ...state.payments], cashMovements: [movement, ...state.cashMovements] }), 'Registró pago parcial', 'Finanzas', payment.id, `${account.id}; ${payment.amount}`, { requestId: action.requestId });
    }
    case 'MOVEMENT_VOID': {
      const original = state.cashMovements.find((item) => item.id === action.movementId);
      const reversal = createCashMovement(state, { type: original.type === 'Ingreso' ? 'Egreso' : 'Ingreso', concept: `Contramovimiento de ${original.id}: ${action.reason}`, referenceId: original.id, reversalOf: original.id, amount: original.amount, method: original.method });
      const originalPayment = state.payments.find((item) => item.id === original.referenceId);
      const advanceLink = getAdvanceAccountLink(state, originalPayment);
      const paymentReversal = originalPayment ? { ...originalPayment, id: nextId('PAG', state.payments), amount: -originalPayment.amount, status: 'Contramovimiento', concept: `Anulación de ${originalPayment.id}`, operationNumber: reversal.id, reversalOf: originalPayment.id, createdAt: new Date().toISOString() } : null;
      let accounts = state.accounts;
      let reservations = state.reservations;
      if (paymentReversal?.accountId) accounts = accounts.map((account) => account.id === paymentReversal.accountId ? { ...account, payments: [...account.payments, { id: paymentReversal.id, amount: paymentReversal.amount, method: paymentReversal.method, createdAt: paymentReversal.createdAt, reversalOf: originalPayment.id }] } : account);
      if (paymentReversal?.reservationId && !paymentReversal.accountId) {
        reservations = reservations.map((reservation) => reservation.id === paymentReversal.reservationId ? { ...reservation, advance: reservation.advance - originalPayment.amount, balance: Math.min(reservation.total, reservation.balance + originalPayment.amount) } : reservation);
        if (advanceLink) accounts = accounts.map((account) => account.id === advanceLink.account.id ? { ...account, payments: [...account.payments, { id: paymentReversal.id, sourcePaymentId: originalPayment.id, amount: paymentReversal.amount, method: paymentReversal.method, createdAt: paymentReversal.createdAt, reversalOf: originalPayment.id }] } : account);
      }
      const nextState = syncRoomBalances({ ...state, accounts, reservations, payments: paymentReversal ? [paymentReversal, ...state.payments] : state.payments, cashMovements: [reversal, ...state.cashMovements] });
      return addAudit(nextState, 'Anuló movimiento con contramovimiento', 'Caja', reversal.id, `${original.id}; ${action.reason}`);
    }
    case 'PENALTY_CHARGE': {
      const account = getOpenAccount(state, action.accountId);
      const penalty = PENALTIES.find((item) => item.id === action.penaltyId);
      const charge = { id: nextId('CAR', state.accounts.flatMap((item) => item.charges)), concept: `Penalidad: ${penalty.name}`, category: 'Penalidad', amount: penalty.amount, penaltyId: penalty.id, evidence: action.evidence?.trim() || null, requestId: action.requestId, createdAt: new Date().toISOString(), responsible: action.responsible || 'Administrador demo' };
      const accounts = state.accounts.map((item) => item.id === account.id ? { ...item, charges: [...item.charges, charge] } : item);
      return addAudit(syncRoomBalances({ ...state, accounts }), 'Aplicó penalidad', 'Finanzas', charge.id, `${account.id}; evidencia ${charge.evidence || 'no requerida'}`, { requestId: action.requestId });
    }
    case 'EVENT_CREATE': {
      const event = { ...action.payload, id: nextId('EVE', state.events), attendees: Number(action.payload.attendees), total: Number(action.payload.total), status: 'Tentativo', advance: 0, createdAt: new Date().toISOString() };
      return addAudit({ ...state, events: [event, ...state.events] }, 'Registró evento', 'Eventos', event.id, `${event.venue} ${event.date}`);
    }
    case 'EVENT_UPDATE': {
      const event = state.events.find((item) => item.id === action.eventId);
      const events = state.events.map((item) => item.id === event.id ? { ...item, ...action.payload, attendees: Number(action.payload.attendees), total: Number(action.payload.total), advance: 0, updatedAt: new Date().toISOString() } : item);
      return addAudit({ ...state, events }, 'Actualizó evento', 'Eventos', event.id, `${action.payload.venue} ${action.payload.date}`);
    }
    case 'EVENT_CONFIRM':
      return addAudit({ ...state, events: state.events.map((item) => item.id === action.eventId ? { ...item, status: 'Confirmado', confirmedAt: new Date().toISOString(), advance: 0 } : item) }, 'Confirmó evento', 'Eventos', action.eventId, 'Sin adelanto ni movimiento financiero automático');
    case 'EVENT_CANCEL':
      return addAudit({ ...state, events: state.events.map((item) => item.id === action.eventId ? { ...item, status: 'Cancelado', cancelledAt: new Date().toISOString(), cancellationReason: action.reason, advance: 0 } : item) }, 'Canceló evento', 'Eventos', action.eventId, action.reason);
    case 'EVENT_ARCHIVE':
      return addAudit({ ...state, events: state.events.map((item) => item.id === action.eventId ? { ...item, status: 'Archivado', archivedAt: new Date().toISOString(), archiveReason: action.reason } : item) }, 'Archivó evento', 'Eventos', action.eventId, action.reason);
    case 'RECIPE_CREATE': {
      const recipe = { ...action.payload, id: nextId('REC', state.recipes), name: action.payload.name.trim(), salePrice: Number(action.payload.salePrice), ingredients: action.payload.ingredients.map((item) => ({ inventoryId: item.inventoryId, quantity: Number(item.quantity) })), status: 'Activa', createdAt: new Date().toISOString() };
      return addAudit({ ...state, recipes: [recipe, ...state.recipes] }, 'Creó receta', 'Cocina y bar', recipe.id, `${recipe.name}; ${recipe.ingredients.length} ingrediente(s)`);
    }
    case 'RECIPE_UPDATE': {
      const recipes = state.recipes.map((item) => item.id === action.recipeId ? { ...item, ...action.payload, name: action.payload.name.trim(), salePrice: Number(action.payload.salePrice), ingredients: action.payload.ingredients.map((ingredient) => ({ inventoryId: ingredient.inventoryId, quantity: Number(ingredient.quantity) })), updatedAt: new Date().toISOString() } : item);
      return addAudit({ ...state, recipes }, 'Actualizó receta', 'Cocina y bar', action.recipeId, action.payload.name);
    }
    case 'RECIPE_ARCHIVE':
      return addAudit({ ...state, recipes: state.recipes.map((item) => item.id === action.recipeId ? { ...item, status: 'Archivada', archivedAt: new Date().toISOString(), archiveReason: action.reason } : item) }, 'Archivó receta', 'Cocina y bar', action.recipeId, action.reason);
    case 'RECIPE_REACTIVATE':
      return addAudit({ ...state, recipes: state.recipes.map((item) => item.id === action.recipeId ? { ...item, status: 'Activa', reactivatedAt: new Date().toISOString(), reactivationReason: action.reason } : item) }, 'Reactivó receta', 'Cocina y bar', action.recipeId, action.reason);
    case 'ACCESS_SELL': {
      if (state.accessLog.some((log) => log.requestId === action.requestId)) return state;
      const stay = state.stays.find((item) => item.id === action.stayId && item.status === 'Activa');
      const account = state.accounts.find((item) => item.id === stay?.accountId && item.status === 'Abierta');
      const duplicate = state.recreationAccess.some((item) => item.stayId === action.stayId && item.zone === action.zone && !['Finalizado', 'Vencido'].includes(item.status));
      const allowedPeople = Number(action.allowedPeople);
      const amount = Number(action.amount);
      const approved = Boolean(stay && account && !duplicate && Number.isInteger(allowedPeople) && allowedPeople > 0 && allowedPeople <= state.poolCapacity && Number.isFinite(amount) && amount >= 0);
      const reason = !stay || !account ? 'Estadía o cuenta no activa' : duplicate ? 'Servicio ya habilitado' : !Number.isInteger(allowedPeople) || allowedPeople <= 0 || allowedPeople > state.poolCapacity ? 'Cantidad de personas inválida' : !Number.isFinite(amount) || amount < 0 ? 'Importe inválido' : '';
      const log = { id: nextId('ACL', state.accessLog), requestId: action.requestId, accessId: null, stayId: action.stayId, movement: 'Venta', result: approved ? 'Aprobado' : 'Rechazado', reason, reader: 'Recepción prototipo', createdAt: new Date().toISOString() };
      if (!approved) return addAudit({ ...state, accessLog: [log, ...state.accessLog] }, 'Venta de acceso rechazada', 'Zonas recreativas', action.stayId, reason);
      const accessId = nextId('ACC', state.recreationAccess);
      const access = { id: accessId, stayId: stay.id, clientId: stay.clientId, roomId: stay.roomId, zone: action.zone, status: 'Habilitado', paid: true, validUntil: stay.expectedCheckOut, allowedPeople, peopleInside: 0, entries: 0, qrReference: `QR dinámico ${accessId}` };
      const charge = { id: `CAR-${accessId}`, concept: `${action.zone} · ${allowedPeople} persona(s)`, category: action.zone, amount, requestId: action.requestId, createdAt: log.createdAt };
      const updated = syncRoomBalances({
        ...state,
        recreationAccess: [access, ...state.recreationAccess],
        accessLog: [{ ...log, accessId }, ...state.accessLog],
        stays: state.stays.map((item) => item.id === stay.id ? { ...item, accessIds: [...item.accessIds, accessId] } : item),
        accounts: state.accounts.map((item) => item.id === account.id ? { ...item, charges: [...item.charges, charge] } : item),
      });
      return addAudit(updated, 'Vendió acceso recreativo', 'Zonas recreativas', accessId, `${action.zone}; cargo ${action.amount}`);
    }
    case 'ACCESS_SCAN': {
      if (action.requestId && state.accessLog.some((log) => log.requestId === action.requestId)) return state;
      const access = state.recreationAccess.find((item) => item.id === action.accessId);
      const currentInside = state.recreationAccess.filter((item) => item.zone === 'Piscina').reduce((sum, item) => sum + item.peopleInside, 0);
      const entering = action.movement === 'Entrada';
      let result = 'Aprobado';
      let reason = '';
      if (!access || !['Habilitado', 'Dentro de piscina'].includes(access.status)) { result = 'Rechazado'; reason = 'Acceso no habilitado'; }
      else if (!access.paid) { result = 'Rechazado'; reason = 'Pago pendiente'; }
      else if (access.validUntil < formatCalendarDate(new Date())) { result = 'Rechazado'; reason = 'Acceso vencido'; }
      else if (entering && access.zone === 'Piscina' && currentInside >= state.poolCapacity) { result = 'Rechazado'; reason = 'Aforo máximo alcanzado'; }
      else if (entering && access.peopleInside >= access.allowedPeople) { result = 'Rechazado'; reason = 'Límite de personas alcanzado'; }
      else if (!entering && access.peopleInside <= 0) { result = 'Rechazado'; reason = 'No hay personas dentro para registrar salida'; }
      const accessLog = [{ id: nextId('ACL', state.accessLog), requestId: action.requestId, accessId: action.accessId, stayId: access?.stayId || null, movement: action.movement, result, reason, reader: 'Lector prototipo (sin hardware)', createdAt: new Date().toISOString() }, ...state.accessLog];
      const recreationAccess = result === 'Aprobado' ? state.recreationAccess.map((item) => item.id === access.id ? { ...item, peopleInside: item.peopleInside + (entering ? 1 : -1), entries: item.entries + (entering ? 1 : 0), status: entering && item.zone === 'Piscina' ? 'Dentro de piscina' : 'Habilitado' } : item) : state.recreationAccess;
      return addAudit({ ...state, accessLog, recreationAccess }, `${action.movement} QR ${result.toLowerCase()}`, 'Zonas recreativas', action.accessId, reason || 'Validación local; hardware no conectado');
    }
    case 'ACCESS_MANUAL': {
      const access = state.recreationAccess.find((item) => item.id === action.accessId);
      const entering = action.movement === 'Entrada';
      const currentInside = state.recreationAccess.filter((item) => item.zone === 'Piscina').reduce((sum, item) => sum + item.peopleInside, 0);
      const approved = entering ? access.peopleInside < access.allowedPeople && (access.zone !== 'Piscina' || currentInside < state.poolCapacity) : access.peopleInside > 0;
      const reason = approved ? action.reason.trim() : entering ? 'Aforo o límite del acceso alcanzado' : 'No hay personas dentro para registrar salida';
      const log = { id: nextId('ACL', state.accessLog), requestId: action.requestId, accessId: access.id, stayId: access.stayId, movement: action.movement, result: approved ? 'Aprobado' : 'Rechazado', reason, reader: `Manual · ${action.responsible.trim()}`, observation: action.observation?.trim() || '', createdAt: new Date().toISOString() };
      const recreationAccess = approved ? state.recreationAccess.map((item) => item.id === access.id ? { ...item, peopleInside: item.peopleInside + (entering ? 1 : -1), entries: item.entries + (entering ? 1 : 0), status: entering && item.zone === 'Piscina' ? 'Dentro de piscina' : 'Habilitado' } : item) : state.recreationAccess;
      return addAudit({ ...state, accessLog: [log, ...state.accessLog], recreationAccess }, `Registró ${action.movement.toLowerCase()} manual ${approved ? 'aprobada' : 'rechazada'}`, 'Zonas recreativas', access.id, `${action.responsible}; ${reason}; ${action.observation || 'Sin observación'}`, { user: action.responsible.trim() });
    }
    case 'INCIDENT_PROGRESS': {
      const sequence = ['Pendiente', 'Asignada', 'En proceso', 'Resuelta', 'Cerrada'];
      const current = state.incidents.find((incident) => incident.id === action.incidentId);
      if (!current || current.status === 'Cerrada' || (action.expectedStatus && current.status !== action.expectedStatus)) return state;
      const nextStatus = sequence[Math.min(sequence.indexOf(current.status) + 1, sequence.length - 1)];
      if (nextStatus === 'Resuelta' && !action.note?.trim() && !current.solution) return state;
      const solution = nextStatus === 'Resuelta' ? action.note?.trim() || current.solution : current.solution;
      const incidents = state.incidents.map((incident) => incident.id === action.incidentId ? { ...incident, status: nextStatus, solution, updatedAt: new Date().toISOString() } : incident);
      let maintenanceTickets = state.maintenanceTickets;
      if (current.type === 'Mantenimiento') {
        const ticketStatus = ({ Asignada: 'Asignado', 'En proceso': 'En reparación', Resuelta: 'Solucionado', Cerrada: 'Cerrado' })[nextStatus] || 'Reportado';
        maintenanceTickets = state.maintenanceTickets.map((ticket) => ticket.id === current.referenceId ? { ...ticket, status: ticketStatus, solution } : ticket);
      }
      const nextState = { ...state, incidents, maintenanceTickets };
      const rooms = current.roomId && CLOSED_INCIDENT_STATUSES.includes(nextStatus) ? updateRoomStatus(nextState, current.roomId) : state.rooms;
      return addAudit({ ...nextState, rooms }, 'Actualizó incidencia', 'Incidencias', action.incidentId, `${nextStatus}${solution ? `; ${solution}` : ''}`);
    }
    case 'INCIDENT_CREATE': {
      if (!action.payload.description?.trim()) return state;
      const incident = { ...action.payload, id: nextId('INC', state.incidents), referenceId: action.payload.referenceId || null, responsible: action.payload.responsible || 'Por asignar', status: 'Pendiente', evidence: action.payload.evidence ? [action.payload.evidence] : [], solution: '', createdAt: new Date().toISOString() };
      const rooms = action.payload.blocksRoom && incident.roomId ? state.rooms.map((room) => room.id === incident.roomId && !room.activeStayId ? { ...room, status: 'Bloqueada', incidentIds: [...new Set([...room.incidentIds, incident.id])] } : room) : state.rooms;
      return addAudit({ ...state, rooms, incidents: [incident, ...state.incidents] }, 'Creó incidencia', 'Incidencias', incident.id, `${incident.type}; ${incident.priority}`);
    }
    case 'INCIDENT_UPDATE': {
      const current = state.incidents.find((item) => item.id === action.incidentId);
      if (!current || current.status === 'Cerrada') return state;
      const evidence = action.payload.evidence?.trim() ? [...current.evidence, action.payload.evidence.trim()] : current.evidence;
      const incidents = state.incidents.map((item) => item.id === current.id ? { ...item, responsible: action.payload.responsible || item.responsible, priority: action.payload.priority || item.priority, evidence, solution: action.payload.solution ?? item.solution } : item);
      const maintenanceTickets = current.type === 'Mantenimiento' ? state.maintenanceTickets.map((ticket) => ticket.id === current.referenceId ? { ...ticket, assignedTo: action.payload.responsible || ticket.assignedTo, priority: action.payload.priority || ticket.priority, evidence, solution: action.payload.solution ?? ticket.solution } : ticket) : state.maintenanceTickets;
      return addAudit({ ...state, incidents, maintenanceTickets }, 'Actualizó incidencia', 'Incidencias', current.id, action.payload.note || 'Asignación, prioridad o evidencia actualizada');
    }
    case 'INCIDENT_REOPEN': {
      const current = state.incidents.find((item) => item.id === action.incidentId);
      if (!current || !CLOSED_INCIDENT_STATUSES.includes(current.status)) return state;
      const incidents = state.incidents.map((item) => item.id === current.id ? { ...item, status: 'En proceso', reopenedAt: new Date().toISOString() } : item);
      const maintenanceTickets = current.type === 'Mantenimiento' ? state.maintenanceTickets.map((ticket) => ticket.id === current.referenceId ? { ...ticket, status: 'En reparación' } : ticket) : state.maintenanceTickets;
      const nextState = { ...state, incidents, maintenanceTickets };
      const rooms = current.roomId ? updateRoomStatus(nextState, current.roomId) : state.rooms;
      return addAudit({ ...nextState, rooms }, 'Reabrió incidencia', 'Incidencias', current.id, action.reason || 'Reapertura operativa');
    }
    case 'PARKING_CREATE': {
      const stay = state.stays.find((item) => item.id === action.payload.stayId);
      const vehicle = { ...action.payload, id: nextId('VEH', state.vehicles), clientId: stay.clientId, roomId: stay.roomId, plate: action.payload.plate.trim().toUpperCase(), space: action.payload.space.trim().toUpperCase(), fee: Number(action.payload.fee), status: 'Dentro', entryAt: new Date().toISOString(), exitAt: null, entryResponsible: action.responsible || 'Administrador demo' };
      return addAudit({ ...state, vehicles: [vehicle, ...state.vehicles] }, 'Registró ingreso a cochera', 'Cochera', vehicle.id, `${vehicle.plate}; espacio ${vehicle.space}; tarifa ${vehicle.fee}`);
    }
    case 'PARKING_UPDATE': {
      const payload = action.payload;
      const vehicles = state.vehicles.map((item) => item.id === action.vehicleId ? { ...item, ...payload, plate: payload.plate.trim().toUpperCase(), space: payload.space.trim().toUpperCase(), fee: Number(payload.fee), updatedAt: new Date().toISOString(), updatedBy: action.responsible || 'Administrador demo' } : item);
      return addAudit({ ...state, vehicles }, 'Actualizó vehículo dentro', 'Cochera', action.vehicleId, `${payload.plate}; ${payload.space}; tarifa ${payload.fee}`);
    }
    case 'PARKING_EXIT': {
      const vehicle = state.vehicles.find((item) => item.id === action.vehicleId);
      const stay = state.stays.find((item) => item.id === vehicle.stayId);
      const account = getOpenAccount(state, stay?.accountId);
      const chargeId = `CAR-${vehicle.id}`;
      const shouldCharge = account && vehicle.fee > 0 && !account.charges.some((charge) => charge.id === chargeId);
      const charge = shouldCharge ? { id: chargeId, concept: `Cochera ${vehicle.plate}`, category: 'Cochera', amount: vehicle.fee, createdAt: new Date().toISOString(), responsible: action.responsible } : null;
      const accounts = charge ? state.accounts.map((item) => item.id === account.id ? { ...item, charges: [...item.charges, charge] } : item) : state.accounts;
      const vehicles = state.vehicles.map((item) => item.id === vehicle.id ? { ...item, status: 'Fuera', exitAt: new Date().toISOString(), exitResponsible: action.responsible, exitObservation: action.observation?.trim() || '', chargeId: charge?.id || item.chargeId || null } : item);
      return addAudit(syncRoomBalances({ ...state, vehicles, accounts }), 'Registró salida de cochera', 'Cochera', vehicle.id, `${vehicle.plate}; cargo ${charge ? vehicle.fee : 'no aplicable'}`, { user: action.responsible });
    }
    case 'PARKING_ARCHIVE':
      return addAudit({ ...state, vehicles: state.vehicles.map((item) => item.id === action.vehicleId ? { ...item, status: 'Archivado', archivedAt: new Date().toISOString(), archiveReason: action.reason } : item) }, 'Archivó vehículo', 'Cochera', action.vehicleId, action.reason);
    case 'PET_CREATE': {
      const pet = { ...action.payload, id: nextId('PET', state.pets), charge: Number(action.payload.charge), status: 'Activa', createdAt: new Date().toISOString() };
      const stay = pet.stayId ? state.stays.find((item) => item.id === pet.stayId && item.status === 'Activa' && item.clientId === pet.clientId) : null;
      const account = stay ? getOpenAccount(state, stay.accountId) : null;
      const charge = pet.charge > 0 ? { id: `CAR-${pet.id}`, concept: `Mascota ${pet.name}`, category: 'Mascotas', amount: pet.charge, requestId: action.requestId, createdAt: pet.createdAt, responsible: action.responsible || 'Administrador demo' } : null;
      pet.chargeId = charge?.id || null;
      pet.chargeApplied = Boolean(charge);
      const clients = state.clients.map((client) => client.id === pet.clientId ? { ...client, petIds: [...new Set([...client.petIds, pet.id])] } : client);
      const accounts = charge ? state.accounts.map((item) => item.id === account.id ? { ...item, charges: [...item.charges, charge] } : item) : state.accounts;
      return addAudit(syncRoomBalances({ ...state, accounts, clients, pets: [pet, ...state.pets] }), 'Registró mascota', 'Mascotas', pet.id, `${pet.name}; ${pet.type}; ${charge ? `cargo ${charge.amount} en ${account.id}` : 'sin cargo'}`, { requestId: action.requestId });
    }
    case 'PET_UPDATE':
      return addAudit({ ...state, pets: state.pets.map((item) => item.id === action.petId ? { ...item, ...action.payload, charge: Number(action.payload.charge), updatedAt: new Date().toISOString() } : item) }, 'Actualizó mascota', 'Mascotas', action.petId, action.payload.name);
    case 'PET_ARCHIVE':
      return addAudit({ ...state, pets: state.pets.map((item) => item.id === action.petId ? { ...item, status: 'Archivada', archivedAt: new Date().toISOString(), archiveReason: action.reason } : item) }, 'Archivó mascota', 'Mascotas', action.petId, action.reason);
    case 'PET_REACTIVATE':
      return addAudit({ ...state, pets: state.pets.map((item) => item.id === action.petId ? { ...item, status: 'Activa', reactivatedAt: new Date().toISOString(), reactivationReason: action.reason } : item) }, 'Reactivó mascota', 'Mascotas', action.petId, action.reason);
    case 'STAFF_CREATE': {
      const person = { ...action.payload, id: nextId('PER', state.staff), documentNumber: normalizeDocument(action.payload.documentNumber), salary: Number(action.payload.salary || 0), status: 'Activo', attendance: 'Pendiente', overtimeHours: 0, createdAt: new Date().toISOString() };
      return addAudit({ ...state, staff: [person, ...state.staff] }, 'Registró personal', 'Personal', person.id, person.name);
    }
    case 'STAFF_UPDATE':
      return addAudit({ ...state, staff: state.staff.map((item) => item.id === action.staffId ? { ...item, ...action.payload, documentNumber: normalizeDocument(action.payload.documentNumber), salary: Number(action.payload.salary || 0), updatedAt: new Date().toISOString() } : item) }, 'Actualizó personal', 'Personal', action.staffId, action.payload.name);
    case 'STAFF_ARCHIVE':
      return addAudit({ ...state, staff: state.staff.map((item) => item.id === action.staffId ? { ...item, status: 'Archivado', archivedAt: new Date().toISOString(), archiveReason: action.reason } : item) }, 'Archivó personal', 'Personal', action.staffId, action.reason);
    case 'STAFF_REACTIVATE':
      return addAudit({ ...state, staff: state.staff.map((item) => item.id === action.staffId ? { ...item, status: 'Activo', reactivatedAt: new Date().toISOString(), reactivationReason: action.reason } : item) }, 'Reactivó personal', 'Personal', action.staffId, action.reason);
    case 'SHIFT_CREATE': {
      const shift = { ...action.payload, id: nextId('TUR', state.staffShifts), status: 'Programado', responsible: action.responsible || 'Administrador demo', createdAt: new Date().toISOString() };
      return addAudit({ ...state, staffShifts: [shift, ...state.staffShifts] }, 'Creó turno', 'Personal', shift.id, `${shift.staffId}; ${shift.date} ${shift.startTime}-${shift.endTime}`);
    }
    case 'SHIFT_UPDATE':
      return addAudit({ ...state, staffShifts: state.staffShifts.map((item) => item.id === action.shiftId ? { ...item, ...action.payload, updatedAt: new Date().toISOString(), updatedBy: action.responsible || 'Administrador demo' } : item) }, 'Actualizó turno', 'Personal', action.shiftId, `${action.payload.date} ${action.payload.startTime}-${action.payload.endTime}`);
    case 'SHIFT_CANCEL':
      return addAudit({ ...state, staffShifts: state.staffShifts.map((item) => item.id === action.shiftId ? { ...item, status: 'Cancelado', cancelledAt: new Date().toISOString(), cancellationReason: action.reason } : item) }, 'Canceló turno', 'Personal', action.shiftId, action.reason);
    case 'STAFF_ATTENDANCE_MANUAL': {
      const createdAt = new Date().toISOString();
      const context = getAttendanceContext(state, action.staffId, new Date(createdAt));
      const entry = { id: nextId('ASI', state.attendanceLog), staffId: action.staffId, movement: action.movement, method: 'Manual', responsible: action.responsible.trim(), reason: action.reason.trim(), observation: action.observation?.trim() || '', requestId: action.requestId, calendarDate: context.calendarDate, shiftId: context.shiftId, createdAt };
      const attendance = `${action.movement} manual ${new Date(createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
      const staff = state.staff.map((item) => item.id === action.staffId ? { ...item, attendance } : item);
      return addAudit({ ...state, staff, attendanceLog: [entry, ...state.attendanceLog] }, 'Registró asistencia manual', 'Personal', entry.id, `${action.staffId}; ${action.movement}; ${action.reason}`, { user: action.responsible.trim() });
    }
    case 'SURVEY_RESPOND': {
      const survey = state.surveys.find((item) => item.id === action.surveyId);
      const payload = action.payload;
      const surveys = state.surveys.map((item) => item.id === survey.id ? { ...item, ...payload, overall: Number(payload.overall), cleaning: Number(payload.cleaning), service: Number(payload.service), room: Number(payload.room), food: Number(payload.food), status: 'Respondida', respondedAt: new Date().toISOString() } : item);
      const clients = state.clients.map((item) => item.id === survey.clientId ? { ...item, promoAuth: Boolean(payload.promotionsAuthorized), rating: Number(payload.overall) } : item);
      return addAudit({ ...state, surveys, clients }, 'Registró respuesta de encuesta', 'Encuestas', survey.id, `Puntuación ${payload.overall}; promociones ${payload.promotionsAuthorized ? 'sí' : 'no'}`);
    }
    case 'CASH_OPEN': {
      const session = { id: nextId('CAJ', state.cashSessions), openedAt: new Date().toISOString(), closedAt: null, openingAmount: Number(action.payload.openingAmount), countedAmount: null, expectedAmount: null, difference: null, responsible: action.payload.responsible.trim(), shift: action.payload.shift, status: 'Abierta', notes: action.payload.notes || '' };
      return addAudit({ ...state, cashSessions: [session, ...state.cashSessions] }, 'Abrió caja', 'Caja', session.id, `${session.responsible}; ${session.shift}; fondo ${session.openingAmount}`);
    }
    case 'CASH_MOVEMENT': {
      const movement = createCashMovement(state, { ...action.payload, amount: Number(action.payload.amount), referenceId: action.payload.referenceId || null });
      return addAudit({ ...state, cashMovements: [movement, ...state.cashMovements] }, 'Registró movimiento manual', 'Caja', movement.id, `${movement.type}; ${movement.concept}; ${movement.amount}`);
    }
    case 'CASH_COUNT': {
      const session = getOpenCashSession(state);
      const movements = state.cashMovements.filter((item) => item.sessionId === session.id);
      const expectedAmount = session.openingAmount + movements.reduce((sum, item) => sum + (item.type === 'Ingreso' ? item.amount : -item.amount), 0);
      const countedAmount = Number(action.countedAmount);
      const cashSessions = state.cashSessions.map((item) => item.id === session.id ? { ...item, countedAmount, expectedAmount, difference: countedAmount - expectedAmount, countedAt: new Date().toISOString(), countNote: action.note || '' } : item);
      return addAudit({ ...state, cashSessions }, 'Registró arqueo', 'Caja', session.id, `Esperado ${expectedAmount}; contado ${countedAmount}; diferencia ${countedAmount - expectedAmount}`);
    }
    case 'CASH_CLOSE': {
      const session = getOpenCashSession(state);
      const movements = state.cashMovements.filter((item) => item.sessionId === session.id);
      const expectedAmount = session.openingAmount + movements.reduce((sum, item) => sum + (item.type === 'Ingreso' ? item.amount : -item.amount), 0);
      const countedAmount = Number(action.countedAmount);
      const cashSessions = state.cashSessions.map((item) => item.id === session.id ? { ...item, status: 'Cerrada', closedAt: new Date().toISOString(), countedAmount, expectedAmount, difference: countedAmount - expectedAmount, closingNote: action.note || '' } : item);
      return addAudit({ ...state, cashSessions }, 'Cerró caja', 'Caja', session.id, `Esperado ${expectedAmount}; contado ${countedAmount}; diferencia ${countedAmount - expectedAmount}`);
    }
    case 'NOTIFICATIONS_READ_ALL':
      if (state.notifications.every((item) => item.read)) return state;
      {
        const readAt = new Date().toISOString();
        return { ...state, notifications: state.notifications.map((item) => item.read ? item : { ...item, read: true, readAt }) };
      }
    case 'NOTIFICATION_READ':
      return { ...state, notifications: state.notifications.map((item) => item.id === action.notificationId ? { ...item, read: true, readAt: new Date().toISOString() } : item) };
    default:
      return state;
  }
}
