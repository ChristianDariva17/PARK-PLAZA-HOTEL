import { useState, useEffect, useMemo } from 'react';
import { Banknote, Coins, Calculator, RotateCcw, Plus, Minus } from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';

export const PEN_BILLS = [
  { value: 200, label: 'S/ 200', badge: 'Santa Rosa / Tilsa', bg: 'rgba(126, 34, 206, 0.08)', border: '#c084fc', text: '#6b21a8' },
  { value: 100, label: 'S/ 100', badge: 'Jorge Chávez / Paulet', bg: 'rgba(29, 78, 216, 0.08)', border: '#93c5fd', text: '#1e40af' },
  { value: 50, label: 'S/ 50', badge: 'Valdelomar / Rostworowski', bg: 'rgba(180, 83, 9, 0.08)', border: '#fcd34d', text: '#92400e' },
  { value: 20, label: 'S/ 20', badge: 'Porras / Arguedas', bg: 'rgba(4, 120, 87, 0.08)', border: '#86efac', text: '#065f46' },
  { value: 10, label: 'S/ 10', badge: 'Quiñones / Chabuca', bg: 'rgba(2, 132, 199, 0.08)', border: '#7dd3fc', text: '#0369a1' },
];

export const PEN_COINS = [
  { value: 5.0, label: 'S/ 5.00', bg: 'rgba(234, 179, 8, 0.08)', border: '#fde047' },
  { value: 2.0, label: 'S/ 2.00', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
  { value: 1.0, label: 'S/ 1.00', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
  { value: 0.5, label: 'S/ 0.50', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
  { value: 0.2, label: 'S/ 0.20', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
  { value: 0.1, label: 'S/ 0.10', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
];

export function CashDenominationsCalculator({ onChange, onSummaryChange }) {
  const [counts, setCounts] = useState({
    200: '',
    100: '',
    50: '',
    20: '',
    10: '',
    5.0: '',
    2.0: '',
    1.0: '',
    0.5: '',
    0.2: '',
    0.1: '',
  });

  const updateQuantity = (value, rawQty) => {
    const qty = rawQty === '' ? '' : Math.max(0, parseInt(rawQty, 10) || 0);
    setCounts((prev) => ({ ...prev, [value]: qty }));
  };

  const increment = (value, step = 1) => {
    setCounts((prev) => {
      const current = prev[value] === '' ? 0 : parseInt(prev[value], 10) || 0;
      return { ...prev, [value]: Math.max(0, current + step) };
    });
  };

  const resetAll = () => {
    setCounts({
      200: '',
      100: '',
      50: '',
      20: '',
      10: '',
      5.0: '',
      2.0: '',
      1.0: '',
      0.5: '',
      0.2: '',
      0.1: '',
    });
  };

  // Subtotals
  const billsTotal = useMemo(() => {
    return PEN_BILLS.reduce((sum, b) => {
      const qty = parseInt(counts[b.value], 10) || 0;
      return sum + qty * b.value;
    }, 0);
  }, [counts]);

  const coinsTotal = useMemo(() => {
    return PEN_COINS.reduce((sum, c) => {
      const qty = parseInt(counts[c.value], 10) || 0;
      return sum + qty * c.value;
    }, 0);
  }, [counts]);

  const totalCalculated = useMemo(() => {
    return Math.round((billsTotal + coinsTotal) * 100) / 100;
  }, [billsTotal, coinsTotal]);

  // Generate breakdown description for audit note
  const summaryText = useMemo(() => {
    const activeBills = PEN_BILLS.filter((b) => (parseInt(counts[b.value], 10) || 0) > 0)
      .map((b) => `${counts[b.value]}xS/${b.value}`)
      .join(', ');
    const activeCoins = PEN_COINS.filter((c) => (parseInt(counts[c.value], 10) || 0) > 0)
      .map((c) => `${counts[c.value]}xS/${c.value}`)
      .join(', ');

    const parts = [];
    if (activeBills) parts.push(`Billetes: [${activeBills} = ${formatMoney(billsTotal)}]`);
    if (activeCoins) parts.push(`Monedas: [${activeCoins} = ${formatMoney(coinsTotal)}]`);
    return parts.join(' | ');
  }, [counts, billsTotal, coinsTotal]);

  useEffect(() => {
    onChange?.(totalCalculated);
    onSummaryChange?.(summaryText);
  }, [totalCalculated, summaryText, onChange, onSummaryChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
      {/* Botón de limpiar y encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', color: '#1e293b', fontWeight: 600 }}>
          <Calculator size={18} style={{ color: '#0284c7' }} />
          <span>Calculadora de Soles Peruanos (PEN)</span>
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="btn btn-sm btn-outline"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px' }}
        >
          <RotateCcw size={12} /> Limpiar calculadora
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {/* Sección de Billetes */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#334155' }}>
              <Banknote size={18} style={{ color: '#059669' }} />
              <span>Billetes</span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
              {formatMoney(billsTotal)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PEN_BILLS.map((b) => {
              const qty = counts[b.value] === '' ? 0 : parseInt(counts[b.value], 10) || 0;
              const subtotal = qty * b.value;
              return (
                <div
                  key={b.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: qty > 0 ? b.bg : '#f8fafc',
                    border: `1px solid ${qty > 0 ? b.border : '#e2e8f0'}`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ minWidth: '70px' }}>
                    <strong style={{ fontSize: '0.95rem', color: b.text }}>{b.label}</strong>
                  </div>

                  {/* Controles de Cantidad */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => increment(b.value, -1)}
                      disabled={qty <= 0}
                      style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        cursor: qty <= 0 ? 'not-allowed' : 'pointer',
                        opacity: qty <= 0 ? 0.4 : 1
                      }}
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={counts[b.value]}
                      onChange={(e) => updateQuantity(b.value, e.target.value)}
                      style={{
                        width: '50px',
                        textAlign: 'center',
                        fontWeight: 600,
                        padding: '3px 4px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => increment(b.value, 1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div style={{ minWidth: '75px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
                    {formatMoney(subtotal)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sección de Monedas */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#334155' }}>
              <Coins size={18} style={{ color: '#d97706' }} />
              <span>Monedas</span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
              {formatMoney(coinsTotal)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PEN_COINS.map((c) => {
              const qty = counts[c.value] === '' ? 0 : parseInt(counts[c.value], 10) || 0;
              const subtotal = Math.round(qty * c.value * 100) / 100;
              return (
                <div
                  key={c.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    backgroundColor: qty > 0 ? c.bg : '#f8fafc',
                    border: `1px solid ${qty > 0 ? c.border : '#e2e8f0'}`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ minWidth: '70px' }}>
                    <strong style={{ fontSize: '0.95rem', color: '#475569' }}>{c.label}</strong>
                  </div>

                  {/* Controles de Cantidad */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => increment(c.value, -1)}
                      disabled={qty <= 0}
                      style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        cursor: qty <= 0 ? 'not-allowed' : 'pointer',
                        opacity: qty <= 0 ? 0.4 : 1
                      }}
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={counts[c.value]}
                      onChange={(e) => updateQuantity(c.value, e.target.value)}
                      style={{
                        width: '50px',
                        textAlign: 'center',
                        fontWeight: 600,
                        padding: '3px 4px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => increment(c.value, 1)}
                      style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer'
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div style={{ minWidth: '75px', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
                    {formatMoney(subtotal)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resumen Totalizador */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#f1f5f9',
        borderRadius: '10px',
        border: '1px solid #cbd5e1'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Suma física de gaveta</span>
          <span style={{ fontSize: '0.85rem', color: '#334155' }}>
            Billetes ({formatMoney(billsTotal)}) + Monedas ({formatMoney(coinsTotal)})
          </span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Total Contado</span>
          <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>
            {formatMoney(totalCalculated)}
          </strong>
        </div>
      </div>
    </div>
  );
}
