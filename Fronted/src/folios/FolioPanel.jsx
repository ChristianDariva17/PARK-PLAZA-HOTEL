import { useCallback, useEffect, useRef, useState } from 'react';
import { createIdempotencyKey } from '../auth/authClient.js';
import { createFolioCharge, createFolioPayment, getFolio, reverseFolioEntry } from './folioClient.js';
import { PAYMENT_METHODS, canReverseEntry, formatFolioAmount, folioBalanceLabel, validateFolioAmount } from './folioModel.js';
import { ResourceState } from '../components/views/SharedViewParts.jsx';
import { CreditCard, PlusCircle, RefreshCw, AlertTriangle, CheckCircle2, History, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

function FolioLoadingSkeleton() {
  return (
    <div className="folio-loading-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando folio...</span>
      <div className="folio-loading-balance" aria-hidden="true">
        <div>
          <span className="loading-skeleton loading-skeleton-line loading-skeleton-line-short" />
          <span className="loading-skeleton folio-loading-balance-value" />
        </div>
        <span className="loading-skeleton folio-loading-button" />
      </div>
      <div className="folio-loading-tabs" aria-hidden="true">
        <span className="loading-skeleton folio-loading-tab" />
        <span className="loading-skeleton folio-loading-tab" />
        <span className="loading-skeleton folio-loading-tab folio-loading-tab-short" />
      </div>
      <div className="folio-loading-form" aria-hidden="true">
        <span className="loading-skeleton loading-skeleton-line folio-loading-form-intro" />
        <div className="folio-loading-fields">
          <span className="loading-skeleton folio-loading-field" />
          <span className="loading-skeleton folio-loading-field" />
        </div>
        <span className="loading-skeleton folio-loading-submit" />
      </div>
    </div>
  );
}

export default function FolioPanel({ stayId, canCharge, canPay, canReverse, onFolioChange, onStatusChange }) {
  const [folio, setFolio] = useState(null);
  const [offset, setOffset] = useState(0);
  const [activeTab, setActiveTab] = useState('pay'); // 'pay' | 'charge' | 'history'
  const [amount, setAmount] = useState('');
  const [paymentAmountTouched, setPaymentAmountTouched] = useState(false);
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [description, setDescription] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [reversingEntryId, setReversingEntryId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('loading');
  const [fieldErrors, setFieldErrors] = useState({});
  const requestGenerationRef = useRef(0);
  const requestControllerRef = useRef(null);
  const submitLockRef = useRef(false);
  const paymentKeyRef = useRef(null);
  const chargeKeyRef = useRef(null);
  const reversalKeyRef = useRef(null);
  const folioRef = useRef(null);
  const errorRef = useRef(null);
  const onFolioChangeRef = useRef(onFolioChange);
  const onStatusChangeRef = useRef(onStatusChange);
  onFolioChangeRef.current = onFolioChange;
  onStatusChangeRef.current = onStatusChange;
  folioRef.current = folio;

  const refresh = useCallback(async () => {
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    const nextStatus = folioRef.current ? 'refreshing' : 'loading';
    setStatus(nextStatus);
    onStatusChangeRef.current?.(nextStatus);
    setError('');
    try {
      const next = await getFolio(stayId, { offset }, controller.signal);
      if (generation !== requestGenerationRef.current || controller.signal.aborted) return null;
      folioRef.current = next;
      setFolio(next);
      onFolioChangeRef.current?.(next);
      setStatus('success');
      onStatusChangeRef.current?.('success');
      return next;
    } catch (failure) {
      if (generation !== requestGenerationRef.current || controller.signal.aborted) return null;
      setError(failure.message);
      setStatus('error');
      onStatusChangeRef.current?.('error');
      return null;
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [offset, stayId]);

  useEffect(() => {
    void refresh();
    return () => {
      requestGenerationRef.current += 1;
      requestControllerRef.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const balanceNumber = Number(folio?.balance || 0);
  const isSettled = balanceNumber === 0;

  // Auto-fill amount with current balance when switching to pay
  const handleQuickPayAll = () => {
    if (balanceNumber > 0) {
      setAmount(balanceNumber.toFixed(2));
      setPaymentAmountTouched(false);
      paymentKeyRef.current = null;
    }
  };

  const normalizeAmount = (value) => {
    try {
      return validateFolioAmount(formatFolioAmount(value));
    } catch {
      throw new Error('Ingresa un monto positivo con hasta dos decimales.');
    }
  };

  const showFieldError = (field, message) => {
    setFieldErrors({ [field]: message });
    setError('Revisa los campos marcados antes de continuar.');
  };

  const clearFieldError = (field) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handlePayment = async (e) => {
    e?.preventDefault();
    if (submitLockRef.current || busy) return;
    const payAmount = paymentAmountTouched ? amount : (balanceNumber > 0 ? balanceNumber.toFixed(2) : '');
    let normalizedAmount;
    try {
      normalizedAmount = normalizeAmount(payAmount);
    } catch (failure) {
      showFieldError('amount', failure.message);
      return;
    }
    if (Number(normalizedAmount) > balanceNumber) {
      showFieldError('amount', `El pago no puede superar el saldo pendiente de ${folioBalanceLabel(balanceNumber)}.`);
      return;
    }
    submitLockRef.current = true;
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await createFolioPayment(stayId, {
        amount: normalizedAmount,
        method,
      }, paymentKeyRef.current || (paymentKeyRef.current = createIdempotencyKey()));
      if (offset) setOffset(0); else await refresh();
      setAmount('');
      setPaymentAmountTouched(false);
      paymentKeyRef.current = null;
    } catch (failure) {
      setError(failure.message || 'No se pudo registrar el pago.');
    } finally {
      setBusy(false);
      submitLockRef.current = false;
    }
  };

  const handleCharge = async (e) => {
    e?.preventDefault();
    if (submitLockRef.current || busy) return;
    let normalizedAmount;
    try {
      normalizedAmount = normalizeAmount(amount);
    } catch (failure) {
      showFieldError('amount', failure.message);
      return;
    }
    if (!description.trim()) {
      showFieldError('description', 'Ingresa una descripción para el cargo.');
      return;
    }
    submitLockRef.current = true;
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await createFolioCharge(stayId, {
        amount: normalizedAmount,
        description: description.trim(),
      }, chargeKeyRef.current || (chargeKeyRef.current = createIdempotencyKey()));
      if (offset) setOffset(0); else await refresh();
      setAmount('');
      setDescription('');
      chargeKeyRef.current = null;
    } catch (failure) {
      setError(failure.message || 'No se pudo agregar el cargo.');
    } finally {
      setBusy(false);
      submitLockRef.current = false;
    }
  };

  const handleReverse = async (entry) => {
    if (submitLockRef.current || busy) return;
    if (!reversalReason.trim()) {
      showFieldError('reversalReason', 'Ingresa el motivo de reversión.');
      return;
    }
    submitLockRef.current = true;
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await reverseFolioEntry(stayId, entry.id, { reason: reversalReason.trim() }, reversalKeyRef.current || (reversalKeyRef.current = createIdempotencyKey()));
      if (offset) setOffset(0); else await refresh();
      setReversingEntryId(null);
      setReversalReason('');
      reversalKeyRef.current = null;
    } catch (failure) {
      setError(failure.message || 'No se pudo revertir el movimiento.');
    } finally {
      setBusy(false);
      submitLockRef.current = false;
    }
  };

  const resourceStatus = status === 'loading' && folio ? 'refreshing' : status === 'error' && folio ? 'success' : status;

  return (
    <ResourceState status={resourceStatus} error={error} onRetry={() => void refresh()} loadingFallback={<FolioLoadingSkeleton />} emptyTitle="Folio no disponible" emptyDescription="No se encontró un folio para esta estadía.">
      {error && folio ? <div ref={errorRef} className="alert-banner alert-banner-danger" role="alert" tabIndex="-1"><span>{error}</span> <button type="button" className="btn btn-sm btn-outline" onClick={() => void refresh()}>Actualizar folio</button></div> : null}
    <div className="folio-panel">
      {/* Folio Balance Banner */}
      <div className={`folio-balance-banner ${isSettled ? 'is-settled' : 'is-outstanding'}`}>
        <div>
          <div className="folio-eyebrow">
            Estado de Cuenta de la Habitación
          </div>
          <div className="folio-balance-value">
            {isSettled ? <CheckCircle2 size={22} color="#16A34A" /> : <AlertTriangle size={22} color="#D97706" />}
            {folio ? folioBalanceLabel(folio.balance) : 'Cargando saldo…'}
          </div>
        </div>

        <div className="folio-toolbar">
          <button
            type="button"
            className="btn btn-sm btn-outline folio-refresh-button"
            onClick={() => void refresh()}
            disabled={busy}
            title="Recargar saldo del folio"
          >
            <RefreshCw size={13} className={busy ? 'spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {/* Quick Action Navigation Tabs */}
      <div className="folio-tabs">
        {canPay && balanceNumber > 0 && (
          <button
            type="button"
            onClick={() => { setActiveTab('pay'); handleQuickPayAll(); }}
            className={`folio-tab ${activeTab === 'pay' ? 'is-active' : ''}`}
          >
            <CreditCard size={14} /> Registrar Pago / Liquidar
          </button>
        )}
        {canCharge && (
          <button
            type="button"
            onClick={() => setActiveTab('charge')}
            className={`folio-tab ${activeTab === 'charge' ? 'is-active' : ''}`}
          >
            <PlusCircle size={14} /> Agregar Cargo Extra
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`folio-tab ${activeTab === 'history' ? 'is-active' : ''}`}
        >
          <History size={14} /> Historial ({folio?.page?.total || 0})
        </button>
      </div>

      {/* TAB: Pay / Liquidate */}
      {activeTab === 'pay' && canPay && (
        <form onSubmit={handlePayment} className="folio-form" aria-busy={busy}>
          <div className="folio-form-intro">
            Liquidar saldo pendiente de la estadía:
          </div>
          <div className="folio-form-grid folio-payment-grid">
            <label className="folio-field">
              <span>Monto a pagar (S/):</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={paymentAmountTouched ? amount : (balanceNumber > 0 ? balanceNumber.toFixed(2) : '')}
                onChange={(e) => { setAmount(e.target.value); setPaymentAmountTouched(true); paymentKeyRef.current = null; clearFieldError('amount'); }}
                placeholder="0.00"
                className="form-control"
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.amount)}
                aria-describedby={fieldErrors.amount ? 'folio-amount-error' : undefined}
              />
              {fieldErrors.amount ? <span id="folio-amount-error" className="form-error" role="alert">{fieldErrors.amount}</span> : null}
            </label>

            <label className="folio-field">
              <span>Método de pago:</span>
              <select
                value={method}
                onChange={(e) => { setMethod(e.target.value); paymentKeyRef.current = null; }}
                className="form-control"
                disabled={busy}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="folio-form-actions">
            <button
              type="submit"
              disabled={busy || balanceNumber <= 0}
              aria-busy={busy}
              className="btn btn-primary folio-submit-button"
            >
              <CheckCircle2 size={16} /> {busy ? 'Procesando pago…' : `Cobrar y Liquidar S/ ${amount || balanceNumber.toFixed(2)}`}
            </button>
          </div>
        </form>
      )}

      {/* TAB: Add Charge */}
      {activeTab === 'charge' && canCharge && (
        <form onSubmit={handleCharge} className="folio-form" aria-busy={busy}>
          <div className="folio-form-intro">
            Agregar cargo de último minuto (Minibar, Daño, Servicio):
          </div>
          <div className="folio-form-grid folio-charge-grid">
            <label className="folio-field">
              <span>Monto (S/):</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => { setAmount(e.target.value); chargeKeyRef.current = null; clearFieldError('amount'); }}
                placeholder="0.00"
                className="form-control"
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.amount)}
                aria-describedby={fieldErrors.amount ? 'folio-amount-error' : undefined}
              />
              {fieldErrors.amount ? <span id="folio-amount-error" className="form-error" role="alert">{fieldErrors.amount}</span> : null}
            </label>

            <label className="folio-field">
              <span>Concepto / Descripción:</span>
              <input
                type="text"
                required
                maxLength={250}
                value={description}
                onChange={(e) => { setDescription(e.target.value); chargeKeyRef.current = null; clearFieldError('description'); }}
                placeholder="Ej. Consumo frigobar, toalla adicional, penalidad..."
                className="form-control"
                disabled={busy}
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={fieldErrors.description ? 'folio-description-error' : undefined}
              />
              {fieldErrors.description ? <span id="folio-description-error" className="form-error" role="alert">{fieldErrors.description}</span> : null}
            </label>
          </div>

          <div className="folio-form-actions">
            <button
              type="submit"
              disabled={busy || !amount || !description.trim()}
              aria-busy={busy}
              className="btn btn-primary folio-submit-button"
            >
              <PlusCircle size={15} /> {busy ? 'Agregando...' : 'Confirmar Cargo'}
            </button>
          </div>
        </form>
      )}

      {/* TAB: History / Breakdown */}
      {activeTab === 'history' && (
        <div className="folio-history">
          {(folio?.entries || []).length === 0 ? (
            <div className="folio-empty-state">
              Sin movimientos registrados en este folio.
            </div>
          ) : (
            (folio?.entries || []).map((entry) => {
              const isPayment = entry.type === 'payment';
              return (
                <div
                  key={entry.id}
                  className="folio-entry"
                >
                  <div className="folio-entry-main">
                    {isPayment ? (
                      <span className="folio-entry-type is-payment">
                        <ArrowDownLeft size={16} /> Pago
                      </span>
                    ) : (
                      <span className="folio-entry-type is-charge">
                        <ArrowUpRight size={16} /> Cargo
                      </span>
                    )}
                    <span className="folio-entry-description">
                      {entry.reason || entry.description || entry.paymentMethod || entry.sourceType || 'Consumo'}
                    </span>
                  </div>

                  <div className="folio-entry-meta">
                    <strong className="folio-entry-amount">
                      {isPayment ? '-' : '+'} {folioBalanceLabel(entry.amount)}
                    </strong>
                    {canReverse && canReverseEntry(entry, folio.entries) && (
                      <div>
                        {reversingEntryId === entry.id ? (
                          <div className="folio-reversal-form">
                            <input
                              type="text"
                              placeholder="Motivo de reversión..."
                              value={reversalReason}
                              onChange={(e) => { setReversalReason(e.target.value); reversalKeyRef.current = null; clearFieldError('reversalReason'); }}
                              className="form-control folio-reversal-input"
                              disabled={busy}
                              aria-invalid={Boolean(fieldErrors.reversalReason)}
                              aria-describedby={fieldErrors.reversalReason ? 'folio-reversal-error' : undefined}
                            />
                            {fieldErrors.reversalReason ? <span id="folio-reversal-error" className="form-error" role="alert">{fieldErrors.reversalReason}</span> : null}
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busy || !reversalReason.trim()}
                              aria-busy={busy}
                              onClick={() => handleReverse(entry)}
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => { setReversingEntryId(null); reversalKeyRef.current = null; setReversalReason(''); clearFieldError('reversalReason'); }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => { setReversingEntryId(entry.id); reversalKeyRef.current = null; setFieldErrors({}); }}
                          >
                            Revertir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {(folio?.page?.total || 0) > folio?.page?.limit && (
            <div className="folio-pagination">
              <button type="button" className="btn btn-sm btn-outline" disabled={busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - folio.page.limit))}>Más recientes</button>
              <span className="folio-pagination-label">{offset + 1}-{Math.min(offset + folio.page.limit, folio.page.total)} de {folio.page.total}</span>
              <button type="button" className="btn btn-sm btn-outline" disabled={busy || offset + folio.page.limit >= folio.page.total} onClick={() => setOffset(offset + folio.page.limit)}>Anteriores</button>
            </div>
          )}
        </div>
      )}
     </div>
    </ResourceState>
   );
}
