export const isCurrentOperationalRequest = (generation, currentGeneration, signal) =>
  generation === currentGeneration && !signal?.aborted;

export async function loadOperationalRecords({
  fetchRecords,
  adaptRecord,
  generation,
  getCurrentGeneration,
  signal,
  onSuccess,
  onFailure,
}) {
  try {
    const records = await fetchRecords(signal);
    if (!isCurrentOperationalRequest(generation, getCurrentGeneration(), signal)) return { status: 'superseded' };
    const adapted = records.map(adaptRecord);
    onSuccess(adapted);
    return { status: 'committed', records: adapted };
  } catch (error) {
    if (!isCurrentOperationalRequest(generation, getCurrentGeneration(), signal)) return { status: 'superseded' };
    onFailure(error);
    return { status: 'failed', error };
  }
}

export async function runConfirmedOperationalRequest({
  request,
  adaptRecord,
  generation,
  getCurrentGeneration,
  signal,
  onCommit,
  reconcile,
}) {
  try {
    const response = await request(signal);
    if (!isCurrentOperationalRequest(generation, getCurrentGeneration(), signal)) return { status: 'superseded' };
    const record = adaptRecord(response);
    onCommit(record);
    return { status: 'committed', record };
  } catch (error) {
    if (!isCurrentOperationalRequest(generation, getCurrentGeneration(), signal)) return { status: 'superseded' };
    if (error.reloadRecommended) await reconcile();
    throw error;
  }
}
