import { useState, useEffect } from 'react';
import { useHotelCommands } from '../state/hotelContext';
import { useActionPermission } from '../components/auth/useActionPermission';
import { CASH_PAYMENT_METHODS } from './cashModel';
import { formatMoney } from '../domain/hotelModel';
import { ShieldAlert, FileText, AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Tag } from 'lucide-react';

export const EXPENSE_CATEGORIES = [
  { id: 'caja_chica', label: 'Caja Chica - Compras de Emergencia', icon: '🛒', desc: 'Insumos de aseo, alimentos menores, ferretería o cafetería urgente.' },
  { id: 'proveedores', label: 'Pago a Proveedores Menores', icon: '📦', desc: 'Agua de bidón, diarios, mensajería, flores o lavandería express.' },
  { id: 'reembolso', label: 'Devolución / Reembolso a Huésped', icon: '↩️', desc: 'Devolución de depósito en garantía o anulación de cobro en recepción.' },
  { id: 'movilidad', label: 'Movilidad y Transporte', icon: '🚕', desc: 'Taxi nocturno de personal, recojo de compras o traslados de emergencia.' },
  { id: 'cash_drop', label: 'Pase a Bóveda / Caja Fuerte (Cash Drop)', icon: '🛡️', desc: 'Remesa de retiro por exceso de efectivo en gaveta.' },
  { id: 'mantenimiento', label: 'Mantenimiento Urgente', icon: '🔧', desc: 'Reparaciones menores inmediatas de cerrajería, plomería o electricidad.' },
  { id: 'otros_egreso', label: 'Otros Egresos Justificados', icon: '📝', desc: 'Cualquier otro egreso autorizado por supervisor de turno.' },
];

export const INCOME_CATEGORIES = [
  { id: 'cobro_extra', label: 'Cobro Extraordinario en Efectivo', icon: '💵', desc: 'Servicios de lavandería, late check-out o tours cobrados en recepción.' },
  { id: 'reposicion', label: 'Aporte / Reposición de Fondo Fijo', icon: '💰', desc: 'Inyección de sencillo o reposición de fondo por supervisor.' },
  { id: 'cambio_divisa', label: 'Cambio de Divisas / Sencillo', icon: '💱', desc: 'Intercambio de denominaciones para gaveta de recepción.' },
  { id: 'otros_ingreso', label: 'Otros Ingresos Justificados', icon: '✨', desc: 'Cualquier otro ingreso operativo autorizado.' },
];

export const VOUCHER_TYPES = [
  'Boleta de Venta',
  'Factura',
  'Recibo de Caja Chica',
  'Vale de Egreso / Remesa',
  'Sin Comprobante',
];

export function CashMovementEnhancedForm({ initialPreset, onClose, notify }) {
  const { cashCommands } = useHotelCommands();
  const allowed = useActionPermission('CASH_MOVEMENT');

  const [type, setType] = useState(initialPreset?.type || 'Egreso');
  const [category, setCategory] = useState(
    initialPreset?.category || (initialPreset?.type === 'Ingreso' ? INCOME_CATEGORIES[0].label : EXPENSE_CATEGORIES[0].label)
  );
  const [concept, setConcept] = useState(initialPreset?.concept || '');
  const [amount, setAmount] = useState(initialPreset?.amount || '');
  const [beneficiary, setBeneficiary] = useState(initialPreset?.beneficiary || '');
  const [voucherType, setVoucherType] = useState(initialPreset?.voucherType || 'Recibo de Caja Chica');
  const [voucherNumber, setVoucherNumber] = useState(initialPreset?.voucherNumber || '');
  const [method] = useState('Efectivo');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initialPreset) {
      if (initialPreset.type) setType(initialPreset.type);
      if (initialPreset.category) setCategory(initialPreset.category);
      if (initialPreset.concept) setConcept(initialPreset.concept);
      if (initialPreset.amount != null) setAmount(initialPreset.amount);
      if (initialPreset.voucherType) setVoucherType(initialPreset.voucherType);
      if (initialPreset.voucherNumber) setVoucherNumber(initialPreset.voucherNumber);
    }
  }, [initialPreset]);

  // Si cambia el tipo, ajustar la categoría por defecto correspondiente
  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === 'Ingreso') {
      setCategory(INCOME_CATEGORIES[0].label);
      if (voucherType === 'Recibo de Caja Chica' || voucherType === 'Vale de Egreso / Remesa') {
        setVoucherType('Boleta de Venta');
      }
    } else {
      setCategory(EXPENSE_CATEGORIES[0].label);
      if (voucherType === 'Boleta de Venta') {
        setVoucherType('Recibo de Caja Chica');
      }
    }
  };

  const applyPreset = (pType, pCat, pConcept, pVoucher) => {
    setType(pType);
    setCategory(pCat);
    setConcept(pConcept);
    if (pVoucher) setVoucherType(pVoucher);
  };

  const numericAmount = Number(amount) || 0;
  const isCashDrop = category.includes('Cash Drop') || category.includes('Bóveda');
  const isHighExpense = type === 'Egreso' && numericAmount > 150;

  const submit = async (event) => {
    event.preventDefault();
    if (!cashCommands) return;

    if (numericAmount <= 0) {
      notify?.('Monto inválido', 'El importe debe ser mayor a S/ 0.00.', 'error');
      return;
    }

    if (isHighExpense && !beneficiary.trim() && !concept.trim()) {
      notify?.(
        'Justificación requerida',
        'Todo egreso mayor a S/ 150.00 requiere indicar el beneficiario y el concepto detallado.',
        'error'
      );
      return;
    }

    setBusy(true);
    try {
      // Construir el concepto enriquecido respetando el límite de 200 caracteres de la base de datos
      const categoryTag = `[${category.split(' - ')[0] || category}]`;
      const parts = [categoryTag, concept.trim()];
      if (beneficiary.trim()) parts.push(`(Benef: ${beneficiary.trim()})`);
      if (voucherType && voucherType !== 'Sin Comprobante') {
        parts.push(`[${voucherType}${voucherNumber.trim() ? `: ${voucherNumber.trim()}` : ''}]`);
      }

      let finalConcept = parts.filter(Boolean).join(' ');
      if (finalConcept.length > 200) {
        finalConcept = finalConcept.slice(0, 197) + '...';
      }

      // Referencia única (máx 48 caracteres)
      let finalReferenceId = voucherNumber.trim() || undefined;
      if (isCashDrop && !finalReferenceId) {
        finalReferenceId = `DROP-${Date.now().toString().slice(-8)}`;
      }

      await cashCommands.move({
        type,
        concept: finalConcept,
        amount: numericAmount,
        method: 'Efectivo',
        referenceId: finalReferenceId,
      });

      notify?.(
        isCashDrop ? 'Remesa registrada' : 'Movimiento registrado',
        `${type === 'Ingreso' ? 'Ingreso' : 'Egreso'} de ${formatMoney(numericAmount)} registrado con éxito.`,
        'success'
      );
      onClose();
    } catch (error) {
      notify?.('Error al registrar movimiento', error.message || 'Ocurrió un error inesperado.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) return null;

  const currentCategories = type === 'Ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <form className="form-grid" onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Botones de Presets Rápidos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Atajos Rápidos de Mostrador
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => applyPreset('Egreso', 'Pase a Bóveda / Caja Fuerte (Cash Drop)', 'Remesa a caja fuerte principal por exceso de efectivo', 'Vale de Egreso / Remesa')}
          >
            <span>🛡️</span> Pase a Bóveda (Cash Drop)
          </button>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => applyPreset('Egreso', 'Caja Chica - Compras de Emergencia', 'Compra de insumos urgentes para recepción/huésped', 'Recibo de Caja Chica')}
          >
            <span>🛒</span> Compra Caja Chica
          </button>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => applyPreset('Egreso', 'Movilidad y Transporte', 'Taxi nocturno de personal o envío urgente', 'Recibo de Caja Chica')}
          >
            <span>🚕</span> Movilidad / Taxi
          </button>
          <button
            type="button"
            className="btn btn-xs btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={() => applyPreset('Egreso', 'Devolución / Reembolso a Huésped', 'Devolución de garantía en efectivo a huésped', 'Vale de Egreso / Remesa')}
          >
            <span>↩️</span> Reembolso a Huésped
          </button>
        </div>
      </div>

      {/* Selector de Tipo (Ingreso vs Egreso) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button
          type="button"
          onClick={() => handleTypeChange('Egreso')}
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: `2px solid ${type === 'Egreso' ? '#dc2626' : '#e2e8f0'}`,
            backgroundColor: type === 'Egreso' ? '#fef2f2' : '#ffffff',
            color: type === 'Egreso' ? '#991b1b' : '#64748b',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <ArrowDownRight size={18} color={type === 'Egreso' ? '#dc2626' : '#94a3b8'} />
          <span>Egreso (Salida de Dinero)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTypeChange('Ingreso')}
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: `2px solid ${type === 'Ingreso' ? '#16a34a' : '#e2e8f0'}`,
            backgroundColor: type === 'Ingreso' ? '#f0fdf4' : '#ffffff',
            color: type === 'Ingreso' ? '#166534' : '#64748b',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          <ArrowUpRight size={18} color={type === 'Ingreso' ? '#16a34a' : '#94a3b8'} />
          <span>Ingreso (Entrada de Dinero)</span>
        </button>
      </div>

      {/* Selector de Categoría Predefinida */}
      <label className="span-2">
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', fontWeight: '600' }}>
          <Tag size={15} />
          Categoría del Movimiento
        </span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
        >
          {currentCategories.map((c) => (
            <option key={c.id} value={c.label}>
              {c.icon} {c.label}
            </option>
          ))}
        </select>
      </label>

      {/* Monto e Importe */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
        <label>
          <span style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
            Importe (PEN S/) *
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            style={{ width: '100%', fontSize: '1.1rem', fontWeight: '700', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
        </label>

        <label>
          <span style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
            Método de Pago
          </span>
          <select
            disabled
            value={method}
            style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9' }}
          >
            {CASH_PAYMENT_METHODS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Comprobante de Respaldo */}
      <div style={{
        padding: '12px 14px',
        backgroundColor: '#f8fafc',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
          <FileText size={16} />
          <span>Comprobante de Respaldo Contable</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <label>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '3px' }}>Tipo Comprobante</span>
            <select
              value={voucherType}
              onChange={(event) => setVoucherType(event.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            >
              {VOUCHER_TYPES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>

          <label>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '3px' }}>N° Comprobante / Referencia</span>
            <input
              type="text"
              placeholder="Ej: B001-00421 o REC-015"
              value={voucherNumber}
              onChange={(event) => setVoucherNumber(event.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
            />
          </label>
        </div>

        <label>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '3px' }}>
            Beneficiario / Entregado a (Persona o Empresa) {isHighExpense ? '(Requerido por monto > S/ 150)' : '(Opcional)'}
          </span>
          <input
            type="text"
            placeholder="Ej: Distribuidora San Lucas SAC / Luis Alva (Conductor)"
            value={beneficiary}
            required={isHighExpense}
            onChange={(event) => setBeneficiary(event.target.value)}
            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
        </label>
      </div>

      {/* Alerta de gasto alto */}
      {isHighExpense && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: '#92400e',
        }}>
          <AlertTriangle size={16} />
          <span>Egreso superior a S/ 150.00: Requiere justificación clara y comprobante de respaldo para auditoría.</span>
        </div>
      )}

      {/* Alerta Cash Drop */}
      {isCashDrop && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          fontSize: '0.8rem',
          color: '#1e40af',
        }}>
          <ShieldAlert size={16} />
          <span>Pase a Bóveda: El efectivo retirado se ingresará a la caja fuerte principal del hotel. Anote el N° de sobre/remesa.</span>
        </div>
      )}

      {/* Concepto / Motivo Detallado */}
      <label className="span-2">
        <span style={{ display: 'block', marginBottom: '4px', fontWeight: '600' }}>
          Concepto / Justificación del Movimiento *
        </span>
        <textarea
          required
          rows={2}
          value={concept}
          placeholder="Ej: Pago de 5 bidones de agua de mesa para recepción y restaurante..."
          onChange={(event) => setConcept(event.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
        />
      </label>

      {/* Acciones del Formulario */}
      <div className="form-actions span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{
            backgroundColor: type === 'Egreso' ? '#dc2626' : '#16a34a',
            borderColor: type === 'Egreso' ? '#dc2626' : '#16a34a',
          }}
        >
          {busy ? 'Guardando...' : type === 'Egreso' ? 'Registrar Egreso' : 'Registrar Ingreso'}
        </button>
      </div>
    </form>
  );
}
