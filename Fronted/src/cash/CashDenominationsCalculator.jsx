import { useState, useEffect, useMemo } from 'react';
import { Banknote, Coins, Calculator, RotateCcw, Plus, Minus } from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';

const PEN_BILLS = [
  { value: 200, label: 'S/ 200', badge: 'Santa Rosa / Tilsa', bg: 'rgba(126, 34, 206, 0.08)', border: '#c084fc', text: '#6b21a8' },
  { value: 100, label: 'S/ 100', badge: 'Jorge Chávez / Paulet', bg: 'rgba(29, 78, 216, 0.08)', border: '#93c5fd', text: '#1e40af' },
  { value: 50, label: 'S/ 50', badge: 'Valdelomar / Rostworowski', bg: 'rgba(180, 83, 9, 0.08)', border: '#fcd34d', text: '#92400e' },
  { value: 20, label: 'S/ 20', badge: 'Porras / Arguedas', bg: 'rgba(4, 120, 87, 0.08)', border: '#86efac', text: '#065f46' },
  { value: 10, label: 'S/ 10', badge: 'Quiñones / Chabuca', bg: 'rgba(2, 132, 199, 0.08)', border: '#7dd3fc', text: '#0369a1' },
];
const PEN_COINS = [
  { value: 5.0, label: 'S/ 5.00', bg: 'rgba(234, 179, 8, 0.08)', border: '#fde047' },
  { value: 2.0, label: 'S/ 2.00', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
  { value: 1.0, label: 'S/ 1.00', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
  { value: 0.5, label: 'S/ 0.50', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
  { value: 0.2, label: 'S/ 0.20', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
  { value: 0.1, label: 'S/ 0.10', bg: 'rgba(203, 213, 225, 0.25)', border: '#cbd5e1' },
];

const EMPTY_COUNTS = { 200: '', 100: '', 50: '', 20: '', 10: '', 5.0: '', 2.0: '', 1.0: '', 0.5: '', 0.2: '', 0.1: '' };

export function CashDenominationsCalculator({ onChange, onSummaryChange }) {
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const updateQuantity = (value, rawQty) => setCounts((prev) => ({ ...prev, [value]: rawQty === '' ? '' : Math.max(0, parseInt(rawQty, 10) || 0) }));
  const increment = (value, step = 1) => setCounts((prev) => ({ ...prev, [value]: Math.max(0, (prev[value] === '' ? 0 : parseInt(prev[value], 10) || 0) + step) }));
  const billsTotal = useMemo(() => PEN_BILLS.reduce((sum, b) => sum + (parseInt(counts[b.value], 10) || 0) * b.value, 0), [counts]);
  const coinsTotal = useMemo(() => PEN_COINS.reduce((sum, c) => sum + (parseInt(counts[c.value], 10) || 0) * c.value, 0), [counts]);
  const totalCalculated = useMemo(() => Math.round((billsTotal + coinsTotal) * 100) / 100, [billsTotal, coinsTotal]);
  const summaryText = useMemo(() => {
    const active = (items) => items.filter((item) => (parseInt(counts[item.value], 10) || 0) > 0).map((item) => `${counts[item.value]}xS/${item.value}`).join(', ');
    const parts = []; const bills = active(PEN_BILLS); const coins = active(PEN_COINS);
    if (bills) parts.push(`Billetes: [${bills} = ${formatMoney(billsTotal)}]`);
    if (coins) parts.push(`Monedas: [${coins} = ${formatMoney(coinsTotal)}]`);
    return parts.join(' | ');
  }, [counts, billsTotal, coinsTotal]);
  useEffect(() => { onChange?.(totalCalculated); onSummaryChange?.(summaryText); }, [totalCalculated, summaryText, onChange, onSummaryChange]);

  const renderItems = (items, kind) => items.map((item) => {
    const qty = counts[item.value] === '' ? 0 : parseInt(counts[item.value], 10) || 0;
    const subtotal = kind === 'coins' ? Math.round(qty * item.value * 100) / 100 : qty * item.value;
    return <div key={item.value} className={`cash-denominations-item cash-denominations-${kind}-${String(item.value).replace('.', '-')} ${qty > 0 ? 'is-active' : ''}`}>
      <div className="cash-denominations-label"><strong>{item.label}</strong></div>
      <div className="cash-denominations-controls"><button type="button" className="cash-denominations-stepper" onClick={() => increment(item.value, -1)} disabled={qty <= 0}><Minus size={12} /></button><input className="cash-denominations-input" type="number" min="0" step="1" placeholder="0" value={counts[item.value]} onChange={(e) => updateQuantity(item.value, e.target.value)} /><button type="button" className="cash-denominations-stepper" onClick={() => increment(item.value, 1)}><Plus size={12} /></button></div>
      <div className="cash-denominations-subtotal">{formatMoney(subtotal)}</div>
    </div>;
  });
  const renderSection = (items, kind, title, Icon) => <div className="cash-denominations-section"><div className="cash-denominations-section-header"><div className={`cash-denominations-section-title cash-denominations-section-title-${kind}`}><Icon size={18} /><span>{title}</span></div><span className="cash-denominations-total">{formatMoney(kind === 'bills' ? billsTotal : coinsTotal)}</span></div><div className="cash-denominations-items">{renderItems(items, kind)}</div></div>;
  return <div className="cash-denominations-calculator">
    <div className="cash-denominations-header"><div className="cash-denominations-title"><Calculator size={18} className="cash-denominations-calculator-icon" /><span>Calculadora de Soles Peruanos (PEN)</span></div><button type="button" onClick={() => setCounts(EMPTY_COUNTS)} className="btn btn-sm btn-outline cash-denominations-reset"><RotateCcw size={12} /> Limpiar calculadora</button></div>
    <div className="cash-denominations-sections">{renderSection(PEN_BILLS, 'bills', 'Billetes', Banknote)}{renderSection(PEN_COINS, 'coins', 'Monedas', Coins)}</div>
    <div className="cash-denominations-summary"><div className="cash-denominations-summary-copy"><span className="cash-denominations-summary-label">Suma física de gaveta</span><span className="cash-denominations-summary-detail">Billetes ({formatMoney(billsTotal)}) + Monedas ({formatMoney(coinsTotal)})</span></div><div className="cash-denominations-summary-total"><span className="cash-denominations-summary-label">Total Contado</span><strong className="cash-denominations-total-value">{formatMoney(totalCalculated)}</strong></div></div>
  </div>;
}
