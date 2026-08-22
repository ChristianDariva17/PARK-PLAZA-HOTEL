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

export function adaptCleaningTask(dto) {
  return {
    id: dto.id,
    roomId: dto.roomId,
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

export function mapCleaningStatusToApi(status) {
  return STATUS_MAP_TO_API[status] || status;
}
