import { describe, expect, it } from 'vitest';
import { adaptIncident } from './incidentsModel.js';

describe('incidents model', () => {
  it('preserves the evidence count when list responses omit evidence bodies', () => {
    expect(adaptIncident({
      id: 'incident-1',
      type: 'service',
      description: 'Noise report',
      priority: 'medium',
      status: 'pending',
      evidence: [],
      evidenceCount: 2,
    })).toMatchObject({
      type: 'service',
      priority: 'Media',
      status: 'Pendiente',
      evidence: [],
      evidenceCount: 2,
    });
  });
});
