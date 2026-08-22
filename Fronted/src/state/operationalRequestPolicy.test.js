import { describe, expect, it, vi } from 'vitest';
import { loadOperationalRecords, runConfirmedOperationalRequest } from './operationalRequestPolicy.js';

const current = (generation = 1) => ({ generation, getCurrentGeneration: () => generation, signal: new AbortController().signal });

describe('operational request policy', () => {
  it('reports server rejection without committing unconfirmed state', async () => {
    const failure = Object.assign(new Error('Rejected'), { reloadRecommended: false });
    const onCommit = vi.fn();
    await expect(runConfirmedOperationalRequest({ ...current(), request: vi.fn().mockRejectedValue(failure), adaptRecord: (value) => value, onCommit, reconcile: vi.fn() })).rejects.toBe(failure);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('reconciles ambiguous rejection before surfacing it and still does not commit the command response', async () => {
    const failure = Object.assign(new Error('Ambiguous'), { reloadRecommended: true });
    const reconcile = vi.fn().mockResolvedValue({ status: 'committed' });
    const onCommit = vi.fn();
    await expect(runConfirmedOperationalRequest({ ...current(), request: vi.fn().mockRejectedValue(failure), adaptRecord: (value) => value, onCommit, reconcile })).rejects.toBe(failure);
    expect(reconcile).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('prevents a superseded command response from committing', async () => {
    let resolve;
    let generation = 1;
    const request = vi.fn(() => new Promise((done) => { resolve = done; }));
    const onCommit = vi.fn();
    const pending = runConfirmedOperationalRequest({ request, adaptRecord: (value) => value, generation, getCurrentGeneration: () => generation, signal: new AbortController().signal, onCommit, reconcile: vi.fn() });
    generation = 2;
    resolve({ id: 'stale' });
    await expect(pending).resolves.toEqual({ status: 'superseded' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('checks generation after fetch before committing reconciliation data', async () => {
    let resolve;
    let generation = 1;
    const fetchRecords = vi.fn(() => new Promise((done) => { resolve = done; }));
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const pending = loadOperationalRecords({ fetchRecords, adaptRecord: (value) => value, generation, getCurrentGeneration: () => generation, signal: new AbortController().signal, onSuccess, onFailure });
    generation = 2;
    resolve([{ id: 'stale' }]);
    await expect(pending).resolves.toEqual({ status: 'superseded' });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('reports only current load failures through the visible error callback', async () => {
    const failure = new Error('Load failed');
    const onFailure = vi.fn();
    await expect(loadOperationalRecords({ ...current(), fetchRecords: vi.fn().mockRejectedValue(failure), adaptRecord: (value) => value, onSuccess: vi.fn(), onFailure })).resolves.toEqual({ status: 'failed', error: failure });
    expect(onFailure).toHaveBeenCalledWith(failure);
  });
});
