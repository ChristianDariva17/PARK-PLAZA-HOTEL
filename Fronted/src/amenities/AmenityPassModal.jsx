import { useState, useMemo } from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { Waves, Mountain, User, Sparkles, AlertCircle } from 'lucide-react';
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
      <form onSubmit={handleSubmit} className="amenity-modal-stack">
        {error ? (
          <div className="alert-banner alert-banner-danger" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Tipo de Visitante */}
        <div>
          <label className="amenity-field-label amenity-field-label-spaced">
            Tipo de Visitante
          </label>
          <div className="amenity-choice-grid">
            <div
              onClick={() => {
                setVisitorType('external');
                setStayId('');
              }}
              className={`amenity-choice-card ${visitorType === 'external' ? 'is-selected tone-blue' : ''}`}
            >
              <div className="amenity-choice-icon">
                <User size={18} />
              </div>
              <div>
                <div className="amenity-title">Visitante Externo</div>
                <div className="amenity-description">Day Pass Estándar</div>
              </div>
            </div>

            <div
              onClick={() => setVisitorType('guest')}
              className={`amenity-choice-card ${visitorType === 'guest' ? 'is-selected tone-purple' : ''}`}
            >
              <div className="amenity-choice-icon">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="amenity-title">Huésped del Hotel</div>
                <div className="amenity-description">Tarifa Incluida / Preferencial</div>
              </div>
            </div>
          </div>
        </div>

        {/* Zona Recreativa */}
        <div>
          <label className="amenity-field-label amenity-field-label-spaced">
            Zona de Acceso
          </label>
          <div className="amenity-choice-grid">
            <div
              onClick={() => setAmenityType('Piscina')}
              className={`amenity-choice-card ${amenityType === 'Piscina' ? 'is-selected tone-cyan' : ''}`}
            >
              <div className="amenity-choice-icon">
                <Waves size={20} />
              </div>
              <div>
                <div className="amenity-title">Piscina</div>
                <div className="amenity-description">
                  S/ {visitorType === 'guest' ? piscinaConfig.priceGuest : piscinaConfig.priceExternal} por persona
                </div>
              </div>
            </div>

            <div
              onClick={() => setAmenityType('Mirador')}
              className={`amenity-choice-card ${amenityType === 'Mirador' ? 'is-selected tone-purple' : ''}`}
            >
              <div className="amenity-choice-icon">
                <Mountain size={20} />
              </div>
              <div>
                <div className="amenity-title">Mirador</div>
                <div className="amenity-description">
                  S/ {visitorType === 'guest' ? miradorConfig.priceGuest : miradorConfig.priceExternal} por persona
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Si es huésped, seleccionar estadía */}
        {visitorType === 'guest' ? (
          <div>
            <label className="amenity-field-label">
              Habitación / Estadía del Huésped *
            </label>
            <select
              className="form-control amenity-select"
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
        <div className="amenity-grid amenity-grid-wide">
          <div>
            <label className="amenity-field-label">
              DNI / Documento
            </label>
            <input
              type="text"
              className="form-control amenity-input"
              placeholder="Ej. 71234567"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
            />
          </div>

          <div>
            <label className="amenity-field-label">
              Nombre del Titular *
            </label>
            <input
              type="text"
              className="form-control amenity-input"
              placeholder="Nombre y Apellidos"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Cantidad de Pax y Total */}
         <div className="amenity-grid amenity-grid-total">
          <div>
            <label className="amenity-field-label">
              N° de Personas (Pax)
            </label>
            <input
              type="number"
              min="1"
              max={selectedConfig.maxPax || 10}
              className="form-control amenity-pax-input"
              value={pax}
              onChange={(e) => setPax(Math.max(1, parseInt(e.target.value) || 1))}
              required
            />
          </div>

          <div className="amenity-total-card">
            <span className="amenity-total-label">
              Total a Cobrar
            </span>
            <span className="amenity-total-value">
              {formatMoney(calculatedTotal)}
            </span>
          </div>
        </div>

        {/* Modalidad de Pago (si total > 0) */}
        {calculatedTotal > 0 ? (
          <div>
            <label className="amenity-field-label amenity-field-label-spaced">
              Modalidad de Pago
            </label>
            <div className="amenity-payment-grid">
              <div
                onClick={() => setPaymentOption('open_tab')}
                className={`amenity-payment-option ${paymentOption === 'open_tab' ? 'is-selected is-open' : ''}`}
              >
                Cuenta Abierta (Pagar al salir)
              </div>
              <div
                onClick={() => setPaymentOption('paid')}
                className={`amenity-payment-option ${paymentOption === 'paid' ? 'is-selected is-paid' : ''}`}
              >
                Cobro Inmediato en Caja
              </div>
            </div>

            {paymentOption === 'paid' ? (
              <div className="amenity-method-list">
                {['Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Transferencia'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    className={`amenity-method-button ${paymentMethod === method ? 'is-selected' : ''}`}
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
        <div className="amenity-form-actions">
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
