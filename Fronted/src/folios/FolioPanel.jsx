import { useCallback, useEffect, useState } from 'react';
import { createFolioCharge, createFolioPayment, getFolio, reverseFolioEntry } from './folioClient.js';
import { PAYMENT_METHODS, canReverseEntry, folioBalanceLabel, validateFolioAmount } from './folioModel.js';
import { CreditCard, DollarSign, PlusCircle, RefreshCw, AlertTriangle, CheckCircle2, History, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function FolioPanel({ stayId, canCharge, canPay, canReverse, onFolioChange }) {
  const [folio, setFolio] = useState(null);
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
      const next = await getFolio(stayId);
      setFolio(next);
      onFolioChange?.(next);
      return next;
    } catch (failure) {
      setError(failure.message);
    }
  }, [onFolioChange, stayId]);

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
      await refresh();
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
      await refresh();
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
      await refresh();
      setReversingEntryId(null);
      setReversalReason('');
    } catch (failure) {
      setError(failure.message || 'No se pudo revertir el movimiento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#FFFFFF', borderRadius: 10, border: '1px solid #E2E8F0', padding: 16 }}>
      {/* Folio Balance Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: isSettled ? 'rgba(22, 163, 74, 0.08)' : 'rgba(217, 119, 6, 0.08)',
        border: `1.5px solid ${isSettled ? '#86EFAC' : '#FCD34D'}`,
        borderRadius: 8,
        padding: '12px 16px',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: isSettled ? '#16A34A' : '#D97706', letterSpacing: '0.05em' }}>
            Estado de Cuenta de la Habitación
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: isSettled ? '#15803D' : '#B45309', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {isSettled ? <CheckCircle2 size={22} color="#16A34A" /> : <AlertTriangle size={22} color="#D97706" />}
            {folio ? folioBalanceLabel(folio.balance) : 'Cargando saldo…'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => refresh()}
            disabled={busy}
            title="Recargar saldo del folio"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: 12 }}
          >
            <RefreshCw size={13} className={busy ? 'spin' : ''} /> Actualizar
          </button>
        </div>
      </div>

      {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}

      {/* Quick Action Navigation Tabs */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #E2E8F0', paddingBottom: 6 }}>
        {canPay && balanceNumber > 0 && (
          <button
            type="button"
            onClick={() => { setActiveTab('pay'); handleQuickPayAll(); }}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'pay' ? '#0F172A' : '#F1F5F9',
              color: activeTab === 'pay' ? '#FFFFFF' : '#475569',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <CreditCard size={14} /> Registrar Pago / Liquidar
          </button>
        )}
        {canCharge && (
          <button
            type="button"
            onClick={() => setActiveTab('charge')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: activeTab === 'charge' ? '#0F172A' : '#F1F5F9',
              color: activeTab === 'charge' ? '#FFFFFF' : '#475569',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <PlusCircle size={14} /> Agregar Cargo Extra
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'history' ? '#0F172A' : '#F1F5F9',
            color: activeTab === 'history' ? '#FFFFFF' : '#475569',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <History size={14} /> Historial ({folio?.entries?.length || 0})
        </button>
      </div>

      {/* TAB: Pay / Liquidate */}
      {activeTab === 'pay' && canPay && (
        <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
            Liquidar saldo pendiente de la estadía:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
              <span>Monto a pagar (S/):</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount || (balanceNumber > 0 ? balanceNumber.toFixed(2) : '')}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, fontWeight: 700 }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
              <span>Método de pago:</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF' }}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              type="submit"
              disabled={busy || balanceNumber <= 0}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', fontWeight: 800 }}
            >
              <CheckCircle2 size={16} /> {busy ? 'Procesando pago…' : `Cobrar y Liquidar S/ ${amount || balanceNumber.toFixed(2)}`}
            </button>
          </div>
        </form>
      )}

      {/* TAB: Add Charge */}
      {activeTab === 'charge' && canCharge && (
        <form onSubmit={handleCharge} style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>
            Agregar cargo de último minuto (Minibar, Daño, Servicio):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
              <span>Monto (S/):</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 14, fontWeight: 700 }}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 600 }}>
              <span>Concepto / Descripción:</span>
              <input
                type="text"
                required
                maxLength={250}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej. Consumo frigobar, toalla adicional, penalidad..."
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="submit"
              disabled={busy || !amount || !description.trim()}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <PlusCircle size={15} /> {busy ? 'Agregando...' : 'Confirmar Cargo'}
            </button>
          </div>
        </form>
      )}

      {/* TAB: History / Breakdown */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
          {(folio?.entries || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 16, color: '#94A3B8', fontSize: 12 }}>
              Sin movimientos registrados en este folio.
            </div>
          ) : (
            (folio?.entries || []).map((entry) => {
              const isPayment = entry.type === 'payment';
              return (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: isPayment ? 'rgba(22, 163, 74, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                    border: `1px solid ${isPayment ? '#DCFCE7' : '#FEE2E2'}`,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isPayment ? (
                      <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                        <ArrowDownLeft size={16} /> Pago
                      </span>
                    ) : (
                      <span style={{ color: '#DC2626', display: 'flex', alignItems: 'center', fontWeight: 700 }}>
                        <ArrowUpRight size={16} /> Cargo
                      </span>
                    )}
                    <span style={{ color: '#334155' }}>
                      {entry.reason || entry.description || entry.paymentMethod || entry.sourceType || 'Consumo'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <strong style={{ color: isPayment ? '#15803D' : '#991B1B', fontSize: 13 }}>
                      {isPayment ? '-' : '+'} {folioBalanceLabel(entry.amount)}
                    </strong>
                    {canReverse && canReverseEntry(entry, folio.entries) && (
                      <div>
                        {reversingEntryId === entry.id ? (
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="text"
                              placeholder="Motivo de reversión..."
                              value={reversalReason}
                              onChange={(e) => setReversalReason(e.target.value)}
                              style={{ padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #CBD5E1' }}
                            />
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              disabled={busy || !reversalReason.trim()}
                              onClick={() => handleReverse(entry)}
                              style={{ padding: '2px 6px', fontSize: 10 }}
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => setReversingEntryId(null)}
                              style={{ padding: '2px 4px', fontSize: 10 }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setReversingEntryId(entry.id)}
                            style={{ padding: '2px 6px', fontSize: 11, color: '#DC2626' }}
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
        </div>
      )}
    </div>
  );
}
