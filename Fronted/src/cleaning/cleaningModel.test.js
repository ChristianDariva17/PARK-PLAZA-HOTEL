import { describe, expect, it } from 'vitest';
import { adaptCleaningCommandResponse, adaptCleaningTask, CleaningContractError, mapCleaningStatusToApi } from './cleaningModel.js';

const task = {
  id: 'task-1',
  roomId: 'room-1',
  status: 'pending',
  assignedTo: 'Ana Torres',
  reason: 'Check-out completado',
  observation: null,
  evidence: [],
  startedAt: null,
  completedAt: null,
  createdAt: '2026-09-16T10:00:00.000Z',
  updatedAt: '2026-09-16T10:00:00.000Z',
};

describe('cleaning model', () => {
  it('adapts API task and room states for the operational UI', () => {
    const response = adaptCleaningCommandResponse({
      task,
      room: { id: 'room-1', status: 'cleaning' },
    });

    expect(response.task).toMatchObject({ id: 'task-1', status: 'Pendiente' });
    expect(response.room).toEqual({ id: 'room-1', status: 'En limpieza' });
  });

  it('accepts a bare task for local command consumers', () => {
    expect(adaptCleaningCommandResponse(task).task.status).toBe('Pendiente');
  });

  it('fails closed when the command response has no task contract', () => {
    expect(() => adaptCleaningCommandResponse({ room: { id: 'room-1', status: 'available' } })).toThrow(CleaningContractError);
  });

  it('maps local progress states to the API contract', () => {
    expect(mapCleaningStatusToApi('En proceso')).toBe('in_progress');
    expect(adaptCleaningTask({ ...task, status: 'approved' }).status).toBe('Aprobada');
  });
});
