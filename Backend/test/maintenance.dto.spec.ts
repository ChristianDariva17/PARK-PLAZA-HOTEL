import { describe, expect, it } from 'vitest';
import { parseCreateMaintenanceDto, parseProgressMaintenanceDto, parseUpdateMaintenanceDto } from '../src/maintenance/maintenance.dto.js';

describe('maintenance DTOs', () => {
  it('normalizes a strict create payload', () => {
    expect(parseCreateMaintenanceDto({ description: '  Broken lock ', priority: 'high', blocksRoom: true })).toMatchObject({
      description: 'Broken lock',
      priority: 'high',
      blocksRoom: true,
    });
  });

  it('requires a responsible and solution for the matching progress actions', () => {
    expect(() => parseProgressMaintenanceDto({ action: 'assign' })).toThrow('Invalid request body');
    expect(() => parseProgressMaintenanceDto({ action: 'resolve' })).toThrow('Invalid request body');
    expect(parseProgressMaintenanceDto({ action: 'assign', responsible: 'Ana Torres' })).toMatchObject({ action: 'assign' });
    expect(parseProgressMaintenanceDto({ action: 'resolve', solution: 'Lock replaced' })).toMatchObject({ action: 'resolve' });
  });

  it('rejects releasing a room outside the close transition and unknown patch fields', () => {
    expect(() => parseProgressMaintenanceDto({ action: 'resolve', solution: 'Fixed', releaseRoom: true })).toThrow('Invalid request body');
    expect(() => parseUpdateMaintenanceDto({ status: 'closed' })).toThrow('Invalid request body');
  });
});
