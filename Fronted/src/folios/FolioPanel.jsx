import { useCallback, useEffect, useState } from 'react';
import { createFolioCharge, createFolioPayment, getFolio, reverseFolioEntry } from './folioClient.js';
import { PAYMENT_METHODS, canReverseEntry, folioBalanceLabel, validateFolioAmount } from './folioModel.js';
import { CreditCard, PlusCircle, RefreshCw, AlertTriangle, CheckCircle2, History, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function FolioPanel({ stayId, canCharge, canPay, canReverse, onFolioChange }) {
  const [folio, setFolio] = useState(null);
  const [offset, setOffset] = useState(0);
  const [activeTab, setActiveTab] = useState('pay'); // 'pay' | 'charge' | 'history'
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [description, setDescription] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [reversingEntryId, setReversingEntryId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await getFolio(stayId, { offset });
      setFolio(next);
      onFolioChange?.(next);
      return next;
    } catch (failure) {
      setError(failure.message);
    }
  }, [offset, onFolioChange, stayId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const balanceNumber = Number(folio?.balance || 0);
  const isSettled = balanceNumber === 0;

  // Auto-fill amount with current balance when switching to pay
  const handleQuickPayAll = () => {
    if (balanceNumber > 0) {
      setAmount(balanceNumber.toFixed(2));
    }
  };

  const handlePayment = async (e) => {
    e?.preventDefault();
    const payAmount = amount || (balanceNumber > 0 ? balanceNumber.toFixed(2) : '');
    if (!payAmount) return;
    setBusy(true);
    setError('');
    try {
      await createFolioPayment(stayId, {
        amount: validateFolioAmount(payAmount),
        method,
      });
      if (offset) setOffset(0); else await refresh();
      setAmount('');
    } catch (failure) {
      setError(failure.message || 'No se pudo registrar el pago.');
    } finally {
      setBusy(false);
    }
  };

  const handleCharge = async (e) => {
    e?.preventDefault();
    if (!amount || !description.trim()) return;
    setBusy(true);
    setError('');
    try {
      await createFolioCharge(stayId, {
        amount: validateFolioAmount(amount),
        description: description.trim(),
      });
      if (offset) setOffset(0); else await refresh();
      setAmount('');
      setDescription('');
    } catch (failure) {
      setError(failure.message || 'No se pudo agregar el cargo.');
    } finally {
      setBusy(false);
    }
  };

  const handleReverse = async (entry) => {
    if (!reversalReason.trim()) return;
    setBusy(true);
    setError('');
    try {
      await reverseFolioEntry(stayId, entry.id, { reason: reversalReason.trim() });
      if (offset) setOffset(0); else await refresh();
      setReversingEntryId(null);
      setReversalReason('');
    } catch (failure) {
      setError(failure.message || 'No se pudo revertir el movimiento.');
    } finally {
      setBusy(false);
    }
  };

  return (
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
            onClick={() => refresh()}
            disabled={busy}
            title="Recargar saldo del folio"
          >
            <RefreshCw size={13} className={busy ? 'spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}

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
        <form onSubmit={handlePayment} className="folio-form">
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
                value={amount || (balanceNumber > 0 ? balanceNumber.toFixed(2) : '')}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="form-control"
              />
            </label>

            <label className="folio-field">
              <span>Método de pago:</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="form-control"
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
              className="btn btn-primary folio-submit-button"
            >
              <CheckCircle2 size={16} /> {busy ? 'Procesando pago…' : `Cobrar y Liquidar S/ ${amount || balanceNumber.toFixed(2)}`}
            </button>
          </div>
        </form>
      )}

      {/* TAB: Add Charge */}
      {activeTab === 'charge' && canCharge && (
        <form onSubmit={handleCharge} className="folio-form">
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
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="form-control"
              />
            </label>

            <label className="folio-field">
              <span>Concepto / Descripción:</span>
              <input
                type="text"
                required
                maxLength={250}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Consumo frigobar, toalla adicional, penalidad..."
                className="form-control"
              />
            </label>
          </div>

          <div className="folio-form-actions">
            <button
              type="submit"
              disabled={busy || !amount || !description.trim()}
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
                              onChange={(e) => setReversalReason(e.target.value)}
                              className="form-control folio-reversal-input"
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busy || !reversalReason.trim()}
                              onClick={() => handleReverse(entry)}
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => setReversingEntryId(null)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setReversingEntryId(entry.id)}
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
  );
}
