import { useState } from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { QrCode, Printer, CheckCircle2, User, Clock, Waves, Mountain, ShieldCheck } from 'lucide-react';
import { checkInAmenityPass } from './amenitiesClient.js';
import { formatMoney } from '../domain/hotelModel.js';

export function AmenityTicketModal({ open, onClose, reservation, onCheckInSuccess, notify }) {
  const [checkingIn, setCheckingIn] = useState(false);

  if (!open || !reservation) return null;

  const isCheckedIn = reservation.status === 'checked_in' || Boolean(reservation.checkedInAt);
  const isPaid = reservation.paymentStatus === 'paid';

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await checkInAmenityPass(reservation.id);
      notify?.('Ingreso validado', `El visitante ${reservation.customerName || 'Titular'} ha ingresado a ${reservation.amenityType}.`, 'success');
      onCheckInSuccess?.();
      onClose();
    } catch (err) {
      notify?.('Error', err.message || 'No se pudo validar el ingreso.', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isMirador = (reservation.amenityType || '').toLowerCase().includes('mirador');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Ticket & Pase QR de Acceso"
      description="Pase de control de acceso para zonas recreativas del Hotel Park Plaza."
    >
      <div className="amenity-modal-stack">
        {/* Card visual del Ticket estilo Luxury */}
        <div className={`amenity-ticket-card ${isMirador ? 'is-mirador' : 'is-piscina'}`}>
          {/* Header de la Zona */}
          <div className="amenity-ticket-header">
            <div className="amenity-ticket-heading">
              <div className={`kpi-icon-circle ${isMirador ? 'tone-purple' : 'tone-blue'} amenity-ticket-icon`}>
                {isMirador ? <Mountain size={20} /> : <Waves size={20} />}
              </div>
              <div>
                <div className="amenity-ticket-eyebrow">
                  Pase de Acceso
                </div>
                <h4 className="amenity-ticket-title">
                  {reservation.amenityType}
                </h4>
              </div>
            </div>
            <span className={`amenity-ticket-status ${isCheckedIn ? 'is-checked-in' : 'is-confirmed'}`}>
              {isCheckedIn ? 'Ingreso Validado' : 'Pase Confirmado'}
            </span>
          </div>

          {/* QR Code Simulado / Renderizado */}
          <div className="amenity-ticket-qr">
            <QrCode size={130} className="amenity-ticket-qr-icon" />
            <span className="amenity-ticket-code">
              #{reservation.id.slice(0, 8).toUpperCase()}
            </span>
          </div>

          {/* Desglose de Datos */}
          <div className="amenity-ticket-details">
            <div className="amenity-ticket-detail-row">
              <span className="amenity-ticket-muted">Titular</span>
              <strong className="amenity-ticket-value">{reservation.customerName || 'Visitante General'}</strong>
            </div>

            <div className="amenity-ticket-detail-row">
              <span className="amenity-ticket-muted">DNI / Documento</span>
              <span className="amenity-ticket-value amenity-ticket-mono">
                {reservation.documentNumber || 'No registrado'}
              </span>
            </div>

            <div className="amenity-ticket-detail-row">
              <span className="amenity-ticket-muted">Horario / Turno</span>
              <span className="amenity-ticket-value">
                {new Date(reservation.startTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} —{' '}
                {new Date(reservation.endTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="amenity-ticket-detail-row">
              <span className="amenity-ticket-muted">Acompañantes (Pax)</span>
              <strong className="amenity-ticket-value">{reservation.pax} {reservation.pax === 1 ? 'persona' : 'personas'}</strong>
            </div>

            <div className="amenity-ticket-detail-row amenity-ticket-account">
              <span className="amenity-ticket-muted">Estado de Cuenta</span>
              <strong className={`amenity-ticket-value ${isPaid ? 'is-paid' : 'is-open'}`}>
                {isPaid ? 'Total Pagado' : `Cuenta Abierta (${formatMoney(reservation.totalAmount || reservation.price)})`}
              </strong>
            </div>
          </div>
        </div>

        {/* Acciones del Modal */}
        <div className="amenity-form-actions amenity-ticket-actions">
          <button type="button" className="btn btn-outline amenity-inline-button" onClick={handlePrint}>
            <Printer size={16} />
            <span>Imprimir Ticket</span>
          </button>

          <div className="amenity-action-group">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cerrar
            </button>
            {!isCheckedIn ? (
              <button
                type="button"
                className="btn btn-primary amenity-inline-button amenity-checkin-button"
                onClick={handleCheckIn}
                disabled={checkingIn}
              >
                <CheckCircle2 size={16} />
                <span>{checkingIn ? 'Validando...' : 'Marcar Ingreso'}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
