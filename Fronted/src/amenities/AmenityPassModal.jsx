import { useState, useMemo } from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { Waves, Mountain, User, Sparkles, AlertCircle, Check, CreditCard, DollarSign, Wallet } from 'lucide-react';
import { createManualAmenityPass } from './amenitiesClient.js';
import { formatMoney } from '../domain/hotelModel.js';

export function AmenityPassModal({ open, onClose, configs = [], stays = [], onSuccess, notify }) {
  const [visitorType, setVisitorType] = useState('external'); // 'external' | 'guest'
  const [amenityType, setAmenityType] = useState('Piscina');
  const [stayId, setStayId] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [pax, setPax] = useState(1);
  const [paymentOption, setPaymentOption] = useState('open_tab'); // 'paid' | 'open_tab'
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const activeStays = useMemo(() => {
    return (stays || []).filter((s) => s.status === 'checked_in' || s.status === 'confirmed');
  }, [stays]);

  const piscinaConfig = useMemo(() => {
    return (configs || []).find((c) => c.amenityKey === 'piscina') || {
      name: 'Piscina',
      priceExternal: 25,
      priceGuest: 0,
      maxPax: 6,
      capacity: 24,
    };
  }, [configs]);

  const miradorConfig = useMemo(() => {
    return (configs || []).find((c) => c.amenityKey === 'mirador') || {
      name: 'Mirador',
      priceExternal: 10,
      priceGuest: 0,
      maxPax: 4,
      capacity: 12,
    };
  }, [configs]);

  const selectedConfig = useMemo(() => {
    return amenityType.toLowerCase().includes('mirador') ? miradorConfig : piscinaConfig;
  }, [amenityType, miradorConfig, piscinaConfig]);

  const calculatedTotal = useMemo(() => {
    if (visitorType === 'guest') {
      return Number(selectedConfig.priceGuest || 0) * pax;
    }
    return Number(selectedConfig.priceExternal || (amenityType === 'Mirador' ? 10 : 25)) * pax;
  }, [visitorType, selectedConfig, amenityType, pax]);

  const handleGuestSelect = (e) => {
    const sId = e.target.value;
    setStayId(sId);
    if (!sId) return;
    const stay = activeStays.find((s) => s.id === sId);
    if (stay) {
      setCustomerName(stay.guestName || stay.customerName || '');
      setDocumentNumber(stay.documentNumber || stay.documentId || '');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!customerName.trim()) {
      setError('Por favor ingrese el nombre del titular.');
      return;
    }

    if (visitorType === 'guest' && !stayId) {
      setError('Por favor seleccione la habitación del huésped.');
      return;
    }

    setSubmitting(true);
    try {
      await createManualAmenityPass({
        amenityType,
        stayId: visitorType === 'guest' ? stayId : undefined,
        documentNumber: documentNumber.trim() || undefined,
        customerName: customerName.trim(),
        pax: Number(pax),
        customPrice: calculatedTotal,
        paymentStatus: calculatedTotal === 0 ? 'paid' : paymentOption,
        paymentMethod: paymentOption === 'paid' ? paymentMethod : undefined,
      });

      notify?.('Pase registrado exitosamente', `Acceso confirmado para ${customerName} en ${amenityType}.`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al registrar el pase de acceso.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Registrar Acceso / Pase de Día"
      description="Emisión de pase presencial para Piscina o Mirador con control de aforo y cuenta de consumos."
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {error ? (
          <div className="alert-banner alert-banner-danger" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Tipo de Visitante */}
        <div>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Tipo de Visitante
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div
              onClick={() => {
                setVisitorType('external');
                setStayId('');
              }}
              style={{
                cursor: 'pointer',
                padding: '14px 16px',
                borderRadius: '12px',
                border: visitorType === 'external' ? '2px solid var(--color-primary, #2563eb)' : '1px solid var(--color-border, #e2e8f0)',
                background: visitorType === 'external' ? 'rgba(37, 99, 235, 0.05)' : 'var(--color-surface, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s ease',
                boxShadow: visitorType === 'external' ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: visitorType === 'external' ? 'rgba(37, 99, 235, 0.15)' : 'var(--color-surface-soft, #f1f5f9)',
                color: visitorType === 'external' ? 'var(--color-primary, #2563eb)' : 'var(--color-muted, #64748b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <User size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--color-navy, #0f172a)' }}>Visitante Externo</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)' }}>Day Pass Estándar</div>
              </div>
            </div>

            <div
              onClick={() => setVisitorType('guest')}
              style={{
                cursor: 'pointer',
                padding: '14px 16px',
                borderRadius: '12px',
                border: visitorType === 'guest' ? '2px solid #9333ea' : '1px solid var(--color-border, #e2e8f0)',
                background: visitorType === 'guest' ? 'rgba(147, 51, 234, 0.05)' : 'var(--color-surface, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s ease',
                boxShadow: visitorType === 'guest' ? '0 2px 8px rgba(147, 51, 234, 0.15)' : 'none'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: visitorType === 'guest' ? 'rgba(147, 51, 234, 0.15)' : 'var(--color-surface-soft, #f1f5f9)',
                color: visitorType === 'guest' ? '#9333ea' : 'var(--color-muted, #64748b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--color-navy, #0f172a)' }}>Huésped del Hotel</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)' }}>Tarifa Incluida / Preferencial</div>
              </div>
            </div>
          </div>
        </div>

        {/* Zona Recreativa */}
        <div>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Zona de Acceso
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div
              onClick={() => setAmenityType('Piscina')}
              style={{
                cursor: 'pointer',
                padding: '14px 16px',
                borderRadius: '12px',
                border: amenityType === 'Piscina' ? '2px solid #0891b2' : '1px solid var(--color-border, #e2e8f0)',
                background: amenityType === 'Piscina' ? 'rgba(8, 145, 178, 0.05)' : 'var(--color-surface, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s ease',
                boxShadow: amenityType === 'Piscina' ? '0 2px 8px rgba(8, 145, 178, 0.15)' : 'none'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: amenityType === 'Piscina' ? 'rgba(8, 145, 178, 0.15)' : 'var(--color-surface-soft, #f1f5f9)',
                color: amenityType === 'Piscina' ? '#0891b2' : 'var(--color-muted, #64748b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Waves size={20} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--color-navy, #0f172a)' }}>Piscina</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)' }}>
                  S/ {visitorType === 'guest' ? piscinaConfig.priceGuest : piscinaConfig.priceExternal} por persona
                </div>
              </div>
            </div>

            <div
              onClick={() => setAmenityType('Mirador')}
              style={{
                cursor: 'pointer',
                padding: '14px 16px',
                borderRadius: '12px',
                border: amenityType === 'Mirador' ? '2px solid #9333ea' : '1px solid var(--color-border, #e2e8f0)',
                background: amenityType === 'Mirador' ? 'rgba(147, 51, 234, 0.05)' : 'var(--color-surface, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s ease',
                boxShadow: amenityType === 'Mirador' ? '0 2px 8px rgba(147, 51, 234, 0.15)' : 'none'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: amenityType === 'Mirador' ? 'rgba(147, 51, 234, 0.15)' : 'var(--color-surface-soft, #f1f5f9)',
                color: amenityType === 'Mirador' ? '#9333ea' : 'var(--color-muted, #64748b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Mountain size={20} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '13.5px', color: 'var(--color-navy, #0f172a)' }}>Mirador</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)' }}>
                  S/ {visitorType === 'guest' ? miradorConfig.priceGuest : miradorConfig.priceExternal} por persona
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Si es huésped, seleccionar estadía */}
        {visitorType === 'guest' ? (
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Habitación / Estadía del Huésped *
            </label>
            <select
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #e2e8f0)',
                background: '#ffffff',
                color: 'var(--color-navy, #0f172a)',
                fontSize: '13.5px',
                fontWeight: '600',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              value={stayId}
              onChange={handleGuestSelect}
              required
            >
              <option value="">Seleccione una habitación activa...</option>
              {activeStays.map((s) => (
                <option key={s.id} value={s.id}>
                  Hab. {s.roomNumber || s.roomId || 'S/N'} — {s.guestName || s.customerName || 'Huésped'}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Datos del Titular */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              DNI / Documento
            </label>
            <input
              type="text"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #e2e8f0)',
                background: '#ffffff',
                color: 'var(--color-navy, #0f172a)',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="Ej. 71234567"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Nombre del Titular *
            </label>
            <input
              type="text"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #e2e8f0)',
                background: '#ffffff',
                color: 'var(--color-navy, #0f172a)',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="Nombre y Apellidos"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Cantidad de Pax y Total */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              N° de Personas (Pax)
            </label>
            <input
              type="number"
              min="1"
              max={selectedConfig.maxPax || 10}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid var(--color-border, #e2e8f0)',
                background: '#ffffff',
                color: 'var(--color-navy, #0f172a)',
                fontSize: '15px',
                fontWeight: '700',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              value={pax}
              onChange={(e) => setPax(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
          </div>

          <div style={{
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(240, 253, 244, 0.8) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            textAlign: 'right'
          }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-muted, #64748b)', textTransform: 'uppercase', display: 'block' }}>
              Total a Cobrar
            </span>
            <span style={{ fontSize: '24px', fontWeight: '800', color: '#059669', fontFamily: 'var(--font-serif)' }}>
              {formatMoney(calculatedTotal)}
            </span>
          </div>
        </div>

        {/* Modalidad de Pago (si total > 0) */}
        {calculatedTotal > 0 ? (
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Modalidad de Pago
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div
                onClick={() => setPaymentOption('open_tab')}
                style={{
                  cursor: 'pointer',
                  padding: '12px',
                  borderRadius: '10px',
                  border: paymentOption === 'open_tab' ? '2px solid #d97706' : '1px solid var(--color-border, #e2e8f0)',
                  background: paymentOption === 'open_tab' ? 'rgba(217, 119, 6, 0.06)' : '#ffffff',
                  textAlign: 'center',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: paymentOption === 'open_tab' ? '#b45309' : 'var(--color-navy, #0f172a)',
                  transition: 'all 0.2s'
                }}
              >
                Cuenta Abierta (Pagar al salir)
              </div>
              <div
                onClick={() => setPaymentOption('paid')}
                style={{
                  cursor: 'pointer',
                  padding: '12px',
                  borderRadius: '10px',
                  border: paymentOption === 'paid' ? '2px solid #059669' : '1px solid var(--color-border, #e2e8f0)',
                  background: paymentOption === 'paid' ? 'rgba(5, 150, 105, 0.06)' : '#ffffff',
                  textAlign: 'center',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: paymentOption === 'paid' ? '#047857' : 'var(--color-navy, #0f172a)',
                  transition: 'all 0.2s'
                }}
              >
                Cobro Inmediato en Caja
              </div>
            </div>

            {paymentOption === 'paid' ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Transferencia'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: paymentMethod === method ? '1.5px solid #059669' : '1px solid var(--color-border, #e2e8f0)',
                      background: paymentMethod === method ? 'rgba(5, 150, 105, 0.12)' : '#ffffff',
                      color: paymentMethod === method ? '#047857' : 'var(--color-muted, #64748b)',
                      transition: 'all 0.15s'
                    }}
                    onClick={() => setPaymentMethod(method)}
                  >
                    {method}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Registrando...' : 'Confirmar e Ingresar'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
