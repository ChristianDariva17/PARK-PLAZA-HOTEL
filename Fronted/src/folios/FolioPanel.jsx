import { useCallback, useEffect, useState } from 'react';
import { createFolioCharge, createFolioPayment, getFolio, reverseFolioEntry } from './folioClient.js';
import { PAYMENT_METHODS, canReverseEntry, folioBalanceLabel, validateFolioAmount } from './folioModel.js';

const empty = { amount: '', description: '', method: PAYMENT_METHODS[0], reason: '' };

export default function FolioPanel({ stayId, canCharge, canPay, canReverse, onFolioChange }) {
  const [folio, setFolio] = useState(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const next = await getFolio(stayId);
    setFolio(next);
    onFolioChange?.(next);
    return next;
  }, [onFolioChange, stayId]);

  useEffect(() => { refresh().catch((failure) => setError(failure.message)); }, [refresh]);

  const update = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }));
  const run = async (operation) => {
    setBusy(true); setError('');
    try {
      await operation();
      await refresh();
      setForm(empty);
    } catch (failure) {
      setError(failure.message || 'No se pudo confirmar el movimiento.');
      if (failure.reloadRecommended) refresh().catch(() => {});
    } finally { setBusy(false); }
  };
  const charge = () => run(() => createFolioCharge(stayId, { amount: validateFolioAmount(form.amount), description: form.description.trim() }));
  const payment = () => run(() => createFolioPayment(stayId, { amount: validateFolioAmount(form.amount), method: form.method }));
  const reverse = (entry) => run(() => reverseFolioEntry(stayId, entry.id, { reason: form.reason.trim() }));

  return <section className="detail-stack" aria-label="Folio financiero">
    <div className="alert-banner alert-banner-info"><strong>Saldo del folio: {folio ? folioBalanceLabel(folio.balance) : 'Cargando…'}</strong>{folio?.receivable ? <span> Cuenta por cobrar: {folioBalanceLabel(folio.receivable.amount)}. {folio.receivable.reason}</span> : null}</div>
    {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}
    <div className="detail-grid">
      <label className="form-field">Monto (0.00)<input value={form.amount} onChange={update('amount')} placeholder="0.00" inputMode="decimal" /></label>
      <label className="form-field">Método de pago<select value={form.method} onChange={update('method')}>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
      <label className="form-field">Descripción de cargo<textarea value={form.description} onChange={update('description')} maxLength={300} /></label>
      <label className="form-field">Motivo de reversión<textarea value={form.reason} onChange={update('reason')} maxLength={300} /></label>
    </div>
    <div className="form-actions">
      {canCharge ? <button className="btn btn-outline" disabled={busy || !form.amount || !form.description.trim()} onClick={charge}>Agregar cargo</button> : null}
      {canPay ? <button className="btn btn-primary" disabled={busy || !form.amount} onClick={payment}>Registrar pago</button> : null}
      <button className="btn btn-outline" disabled={busy} onClick={() => refresh().catch((failure) => setError(failure.message))}>Actualizar folio</button>
    </div>
    <div className="detail-stack">
      {(folio?.entries || []).map((entry) => <article className="card" key={entry.id}>
        <div className="row-between"><strong>{entry.type}</strong><span>{folioBalanceLabel(entry.amount)}</span></div>
        <small>{entry.reason || entry.paymentMethod || entry.sourceType}</small>
        {canReverse && canReverseEntry(entry, folio.entries) ? <button className="btn btn-sm btn-outline" disabled={busy || !form.reason.trim()} onClick={() => reverse(entry)}>Revertir</button> : null}
      </article>)}
    </div>
  </section>;
}
