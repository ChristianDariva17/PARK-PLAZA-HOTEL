import React from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { Printer, ShieldCheck, HeartHandshake, PhoneCall, AlertTriangle } from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';

export function PetPassModal({ open, onClose, pet, clientName }) {
  if (!pet) return null;

  const handlePrint = () => {
    window.print();
  };

  const isDog = pet.type?.toLowerCase().includes('perro') || pet.type?.toLowerCase().includes('can');
  const isCat = pet.type?.toLowerCase().includes('gato') || pet.type?.toLowerCase().includes('fel');
  const petIcon = isDog ? '🐕' : isCat ? '🐈' : '🐾';

  const isStay = pet.originType === 'stay' || Boolean(pet.stayId);
  const owner = pet.ownerName || clientName || 'Huésped del Hotel';
  const phone = pet.ownerPhone || pet.emergencyContact || 'Recepción Hotel (+51 1 200-3000)';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Pase y Carnet Pet-Friendly"
      description="Credencial digital e impresa de estancia y control sanitario."
    >
      <div className="pet-pass-container">
        <div
          id="pet-printable-pass"
          className="pet-pass-card"
        >
          {/* Decorative luxury header bar */}
          <div
            className="pet-pass-accent"
          />

          <div className="pet-pass-header">
            <div>
              <span className="pet-pass-kicker">
                Hotel Park Plaza · Pet-Friendly
              </span>
              <h2 className="pet-pass-title">
                <span>{petIcon}</span> {pet.name}
              </h2>
              <span className="pet-pass-meta">
                ID: <strong>{pet.id}</strong> · {pet.type} {pet.breed ? `(${pet.breed})` : ''} · {pet.size}
              </span>
            </div>
            <div className="pet-pass-qr-column">
              <div
                className="pet-pass-qr"
              >
                <div className="pet-pass-qr-icon">📱</div>
                <span>QR Check</span>
              </div>
            </div>
          </div>

          {/* Badges Strip */}
          <div className="pet-pass-badges">
            {pet.vaccinationVerified ? (
              <span
                className="pet-pass-badge pet-pass-badge-success"
              >
                <ShieldCheck size={13} /> Vacunas al Día
              </span>
            ) : (
              <span
                className="pet-pass-badge pet-pass-badge-warning"
              >
                <AlertTriangle size={13} /> Vacuna Pendiente
              </span>
            )}

            {pet.welcomeKitDelivered ? (
              <span
                className="pet-pass-badge pet-pass-badge-purple"
              >
                <HeartHandshake size={13} /> Kit Entregado
              </span>
            ) : null}

            {pet.temperament ? (
              <span
                className="pet-pass-badge pet-pass-badge-info"
              >
                Carácter: {pet.temperament}
              </span>
            ) : null}

            <span
              className={`pet-pass-badge ${isStay ? 'pet-pass-badge-stay' : 'pet-pass-badge-visit'}`}
            >
              {isStay ? `Hab. ${pet.roomId || 'Estadía'}` : 'Visita / Restaurante'}
            </span>
          </div>

          {/* Details Grid */}
          <div className="pet-pass-details-grid">
            <div>
              <span className="pet-pass-detail-label">Propietario / Responsable:</span>
              <strong>{owner}</strong>
            </div>
            <div>
              <span className="pet-pass-detail-label">Teléfono de contacto:</span>
              <strong>{phone}</strong>
            </div>
            <div>
              <span className="pet-pass-detail-label">Ubicación permitida:</span>
              <span>{pet.lodgingPlace || 'Habitación / Zonas autorizadas'}</span>
            </div>
            <div>
              <span className="pet-pass-detail-label">Tarifa aplicada:</span>
              <strong>{formatMoney(pet.charge || 0)}</strong>
            </div>
            {pet.emergencyContact ? (
              <div className="pet-pass-detail-wide">
                <span className="pet-pass-detail-label">Veterinaria de emergencia:</span>
                <span className="pet-pass-contact">
                  <PhoneCall size={12} /> {pet.emergencyContact}
                </span>
              </div>
            ) : null}
            {pet.notes ? (
              <div className="pet-pass-detail-wide">
                <span className="pet-pass-detail-label">Notas de recepción / comportamiento:</span>
                <span className="pet-pass-notes">"{pet.notes}"</span>
              </div>
            ) : null}
          </div>

          {/* Rules / Policy */}
          <div className="pet-pass-rules">
            <strong className="pet-pass-rules-title">Normas de Convivencia Pet-Friendly:</strong>
            <ul>
              <li>Mantener con correa en pasillos, elevadores y áreas comunes en todo momento.</li>
              <li>No dejar a la mascota sola en la habitación por periodos prolongados.</li>
              <li>El huésped/dueño asume la responsabilidad de aseo y cuidado de las instalaciones.</li>
            </ul>
          </div>
        </div>

        <div className="form-actions pet-pass-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn btn-primary pet-pass-print-button"
            onClick={handlePrint}
          >
            <Printer size={15} /> Imprimir Pase (80mm / A4)
          </button>
        </div>
      </div>
    </Dialog>
  );
}
