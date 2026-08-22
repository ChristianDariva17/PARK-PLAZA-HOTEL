const PRIORITY_FROM_API = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };
const PRIORITY_TO_API   = { Baja: 'low', Media: 'medium', Alta: 'high', Urgente: 'urgent' };
const STATUS_FROM_API   = { pending: 'Pendiente', assigned: 'Asignado', in_progress: 'En reparacion', resolved: 'Solucionado', closed: 'Cerrado' };
const STATUS_TO_API     = { Pendiente: 'pending', Asignado: 'assigned', 'En reparacion': 'in_progress', Solucionado: 'resolved', Cerrado: 'closed' };

export function adaptMaintenanceTicket(dto) {
  return {
    id: dto.id,
    roomId: dto.roomId ?? null,
    description: dto.description,
    priority: PRIORITY_FROM_API[dto.priority] ?? dto.priority,
    responsible: dto.responsible ?? 'Por asignar',
    assignedTo: dto.responsible ?? 'Por asignar',
    status: STATUS_FROM_API[dto.status] ?? dto.status,
    blocksRoom: Boolean(dto.blocksRoom),
    evidence: Array.isArray(dto.evidence) ? dto.evidence : [],
    solution: dto.solution ?? '',
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export const adaptMaintenanceList = (list) => (Array.isArray(list) ? list.map(adaptMaintenanceTicket) : []);

export const mapMaintenancePriorityToApi = (priority) => PRIORITY_TO_API[priority] ?? priority;
export const mapMaintenanceStatusToApi   = (status) => STATUS_TO_API[status] ?? status;
