const PRIORITY_FROM_API = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
const PRIORITY_TO_API   = { Baja: 'low', Media: 'medium', Alta: 'high', Urgente: 'urgent' };
const STATUS_FROM_API   = { pending: 'Pendiente', assigned: 'Asignada', in_progress: 'En proceso', resolved: 'Resuelta', closed: 'Cerrada' };
const STATUS_TO_API     = { Pendiente: 'pending', Asignada: 'assigned', 'En proceso': 'in_progress', Resuelta: 'resolved', Cerrada: 'closed' };
const TYPE_FROM_API     = { cleaning: 'Limpieza', maintenance: 'Mantenimiento' };
const TYPE_TO_API       = { Limpieza: 'cleaning', Mantenimiento: 'maintenance', Servicio: 'maintenance' };

export function adaptIncident(dto) {
  return {
    id: dto.id,
    roomId: dto.roomId ?? null,
    type: TYPE_FROM_API[dto.type] ?? dto.type,
    referenceId: dto.referenceId ?? null,
    description: dto.description,
    priority: PRIORITY_FROM_API[dto.priority] ?? dto.priority,
    responsible: dto.responsible ?? 'Por asignar',
    status: STATUS_FROM_API[dto.status] ?? dto.status,
    blocksRoom: Boolean(dto.blocksRoom),
    evidence: Array.isArray(dto.evidence) ? dto.evidence : [],
    solution: dto.solution ?? '',
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const adaptIncidentList = (list) => (Array.isArray(list) ? list.map(adaptIncident) : []);

export const mapIncidentPriorityToApi = (priority) => PRIORITY_TO_API[priority] ?? priority;
export const mapIncidentStatusToApi   = (status) => STATUS_TO_API[status] ?? status;
export const mapIncidentTypeToApi     = (type) => TYPE_TO_API[type] ?? type;
