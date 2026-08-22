export function adaptCashSession(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    propertyId: dto.propertyId,
    openedAt: dto.openedAt,
    closedAt: dto.closedAt ?? null,
    openingAmount: Number(dto.openingAmount),
    countedAmount: dto.countedAmount != null ? Number(dto.countedAmount) : null,
    expectedAmount: dto.expectedAmount != null ? Number(dto.expectedAmount) : null,
    difference: dto.difference != null ? Number(dto.difference) : null,
    responsible: dto.responsible,
    shift: dto.shift,
    status: dto.status === 'open' ? 'Abierta' : 'Cerrada',
    notes: dto.notes ?? '',
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const adaptCashSessionsList = (list) => (Array.isArray(list) ? list.map(adaptCashSession) : []);

export function adaptCashMovement(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    sessionId: dto.sessionId,
    type: dto.type, // 'Ingreso' | 'Egreso'
    concept: dto.concept,
    referenceId: dto.referenceId ?? null,
    amount: Number(dto.amount),
    method: dto.method,
    createdAt: dto.createdAt,
    responsible: dto.responsible,
  };
}

export const adaptCashMovementsList = (list) => (Array.isArray(list) ? list.map(adaptCashMovement) : []);
export const CASH_PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Transferencia', 'Yape', 'Plin'];

const optionalText = (value) => value?.trim() || undefined;

export const buildOpenCashSessionDto = (input) => ({
  openingAmount: Number(input.openingAmount),
  responsible: input.responsible.trim(),
  shift: input.shift,
  ...(optionalText(input.notes) ? { notes: optionalText(input.notes) } : {}),
});

export const buildCountCashSessionDto = (input) => ({
  countedAmount: Number(input.countedAmount),
  ...(optionalText(input.note) ? { note: optionalText(input.note) } : {}),
});

export const buildCashMovementDto = (input) => ({
  type: input.type,
  concept: input.concept.trim(),
  ...(optionalText(input.referenceId) ? { referenceId: optionalText(input.referenceId) } : {}),
  amount: Number(input.amount),
  method: input.method,
});
