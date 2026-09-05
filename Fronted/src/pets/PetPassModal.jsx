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
      <div className="pet-pass-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          id="pet-printable-pass"
          style={{
            border: '2px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            backgroundColor: '#ffffff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative luxury header bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '6px',
              background: 'linear-gradient(90deg, #d97706, #f59e0b, #b45309)',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px', marginBottom: '14px' }}>
            <div>
              <span style={{ fontSize: '11px', letterSpacing: '1px', textTransform: 'uppercase', color: '#92400e', fontWeight: 700 }}>
                Hotel Park Plaza · Pet-Friendly
              </span>
              <h2 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{petIcon}</span> {pet.name}
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                ID: <strong>{pet.id}</strong> · {pet.type} {pet.breed ? `(${pet.breed})` : ''} · {pet.size}
              </span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  backgroundColor: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 600,
                  color: '#475569',
                }}
              >
                <div style={{ fontSize: '24px', lineHeight: 1 }}>📱</div>
                <span>QR Check</span>
              </div>
            </div>
          </div>

          {/* Badges Strip */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {pet.vaccinationVerified ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                <ShieldCheck size={13} /> Vacunas al Día
              </span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                <AlertTriangle size={13} /> Vacuna Pendiente
              </span>
            )}

            {pet.welcomeKitDelivered ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#f3e8ff',
                  color: '#6b21a8',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                <HeartHandshake size={13} /> Kit Entregado
              </span>
            ) : null}

            {pet.temperament ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '6px',
                }}
              >
                Carácter: {pet.temperament}
              </span>
            ) : null}

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: isStay ? '#f8fafc' : '#ffedd5',
                color: isStay ? '#334155' : '#c2410c',
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '6px',
              }}
            >
              {isStay ? `Hab. ${pet.roomId || 'Estadía'}` : 'Visita / Restaurante'}
            </span>
          </div>

          {/* Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px',
              backgroundColor: '#f8fafc',
              padding: '12px',
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '14px',
            }}
          >
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Propietario / Responsable:</span>
              <strong>{owner}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Teléfono de contacto:</span>
              <strong>{phone}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Ubicación permitida:</span>
              <span>{pet.lodgingPlace || 'Habitación / Zonas autorizadas'}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Tarifa aplicada:</span>
              <strong>{formatMoney(pet.charge || 0)}</strong>
            </div>
            {pet.emergencyContact ? (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Veterinaria de emergencia:</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#0f172a', fontWeight: 500 }}>
                  <PhoneCall size={12} /> {pet.emergencyContact}
                </span>
              </div>
            ) : null}
            {pet.notes ? (
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Notas de recepción / comportamiento:</span>
                <span style={{ fontStyle: 'italic', color: '#334155' }}>"{pet.notes}"</span>
              </div>
            ) : null}
          </div>

          {/* Rules / Policy */}
          <div style={{ fontSize: '11px', color: '#64748b', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
            <strong style={{ color: '#334155', display: 'block', marginBottom: '4px' }}>Normas de Convivencia Pet-Friendly:</strong>
            <ul style={{ margin: 0, paddingLeft: '16px', lineHeight: 1.4 }}>
              <li>Mantener con correa en pasillos, elevadores y áreas comunes en todo momento.</li>
              <li>No dejar a la mascota sola en la habitación por periodos prolongados.</li>
              <li>El huésped/dueño asume la responsabilidad de aseo y cuidado de las instalaciones.</li>
            </ul>
          </div>
        </div>

        <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Printer size={15} /> Imprimir Pase (80mm / A4)
          </button>
        </div>
      </div>
    </Dialog>
  );
}
