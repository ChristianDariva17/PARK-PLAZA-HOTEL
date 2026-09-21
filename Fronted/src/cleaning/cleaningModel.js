const STATUS_MAP_FROM_API = {
  pending: 'Pendiente',
  in_progress: 'En proceso',
  completed: 'Completada',
  approved: 'Aprobada',
};

const STATUS_MAP_TO_API = {
  Pendiente: 'pending',
  'En proceso': 'in_progress',
  Completada: 'completed',
  Aprobada: 'approved',
};

const ROOM_STATUS_MAP_FROM_API = {
  available: 'Disponible',
  occupied: 'Ocupada',
  cleaning: 'En limpieza',
  blocked: 'Bloqueada',
  maintenance: 'En mantenimiento',
  out_of_service: 'Fuera de servicio',
};

const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

export class CleaningContractError extends Error {
  constructor() {
    super('El servidor devolvió datos de limpieza no válidos. Se actualizarán los datos antes de permitir otro intento.');
    this.name = 'CleaningContractError';
    this.code = 'invalid_response';
    this.reloadRecommended = true;
    this.ambiguous = true;
  }
}

export function adaptCleaningTask(dto) {
  if (!isRecord(dto) || typeof dto.id !== 'string' || typeof dto.roomId !== 'string') throw new CleaningContractError();
  return {
    id: dto.id,
    roomId: dto.roomId,
    stayId: dto.stayId || null,
    status: STATUS_MAP_FROM_API[dto.status] || dto.status,
    assignedTo: dto.assignedTo || 'Por asignar',
    reason: dto.reason || 'Salida de huésped',
    observation: dto.observation || '',
    evidence: Array.isArray(dto.evidence) ? dto.evidence : [],
    startedAt: dto.startedAt || null,
    completedAt: dto.completedAt || null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function adaptPersistentCleaningList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((task) => adaptCleaningTask(task));
}

export function adaptCleaningCommandResponse(response) {
  if (!isRecord(response)) throw new CleaningContractError();

  // Keep accepting a bare task for local command consumers while the API response uses { task }.
  const taskDto = isRecord(response.task) ? response.task : response;
  const adapted = { ...response, task: adaptCleaningTask(taskDto) };
  if (isRecord(response.room)) {
    if (typeof response.room.id !== 'string' || typeof response.room.status !== 'string') throw new CleaningContractError();
    adapted.room = { ...response.room, status: ROOM_STATUS_MAP_FROM_API[response.room.status] || response.room.status };
  }
  return adapted;
}

export function mapCleaningStatusToApi(status) {
  return STATUS_MAP_TO_API[status] || status;
}
