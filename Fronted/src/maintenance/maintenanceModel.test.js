import { describe, expect, it } from 'vitest';
import { adaptMaintenanceTicket, mapMaintenancePriorityToApi, mapMaintenanceStatusToApi } from './maintenanceModel.js';

const ticket = {
  id: 'ticket-1',
  roomId: 'room-1',
  description: 'Aire acondicionado sin flujo',
  priority: 'high',
  responsible: 'Ana Torres',
  status: 'in_progress',
  blocksRoom: true,
  evidence: ['photo'],
  solution: '',
  createdAt: '2026-09-16T10:00:00.000Z',
  updatedAt: '2026-09-16T10:00:00.000Z',
};

describe('maintenance model', () => {
  it('adapts API priorities, statuses, responsibility, and evidence', () => {
    expect(adaptMaintenanceTicket(ticket)).toMatchObject({
      id: 'ticket-1',
      priority: 'Alta',
      status: 'En reparación',
      assignedTo: 'Ana Torres',
      evidence: ['photo'],
      blocksRoom: true,
    });
  });

  it('maps local mutation values to the API contract', () => {
    expect(mapMaintenancePriorityToApi('Urgente')).toBe('urgent');
    expect(mapMaintenanceStatusToApi('En reparación')).toBe('in_progress');
    expect(mapMaintenanceStatusToApi('En reparacion')).toBe('in_progress');
  });

  it('preserves the evidence count when list responses omit evidence bodies', () => {
    expect(adaptMaintenanceTicket({ ...ticket, evidence: [], evidenceCount: 3 })).toMatchObject({
      evidence: [],
      evidenceCount: 3,
    });
  });
});
