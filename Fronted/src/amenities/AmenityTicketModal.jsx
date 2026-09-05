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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Card visual del Ticket estilo Luxury */}
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: '#ffffff',
          border: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.08)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Header de la Zona */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '1px dashed var(--color-border, #e2e8f0)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className={`kpi-icon-circle ${isMirador ? 'tone-purple' : 'tone-blue'}`} style={{ width: '38px', height: '38px', borderRadius: '10px' }}>
                {isMirador ? <Mountain size={20} /> : <Waves size={20} />}
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-muted, #64748b)', textTransform: 'uppercase' }}>
                  Pase de Acceso
                </div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--color-navy, #0f172a)', fontFamily: 'var(--font-serif)' }}>
                  {reservation.amenityType}
                </h4>
              </div>
            </div>
            <span style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '11.5px',
              fontWeight: '700',
              background: isCheckedIn ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              color: isCheckedIn ? '#059669' : '#d97706',
              border: `1px solid ${isCheckedIn ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`
            }}>
              {isCheckedIn ? 'Ingreso Validado' : 'Pase Confirmado'}
            </span>
          </div>

          {/* QR Code Simulado / Renderizado */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'var(--color-surface-soft, #f8fafc)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #e2e8f0)',
            marginBottom: '18px'
          }}>
            <QrCode size={130} style={{ color: 'var(--color-navy, #0f172a)' }} />
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', fontWeight: '700', marginTop: '10px', letterSpacing: '0.1em', color: 'var(--color-navy, #0f172a)' }}>
              #{reservation.id.slice(0, 8).toUpperCase()}
            </span>
          </div>

          {/* Desglose de Datos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border-soft, #f1f5f9)' }}>
              <span style={{ color: 'var(--color-muted, #64748b)' }}>Titular</span>
              <strong style={{ color: 'var(--color-navy, #0f172a)' }}>{reservation.customerName || 'Visitante General'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border-soft, #f1f5f9)' }}>
              <span style={{ color: 'var(--color-muted, #64748b)' }}>DNI / Documento</span>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: '600', color: 'var(--color-navy, #0f172a)' }}>
                {reservation.documentNumber || 'No registrado'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border-soft, #f1f5f9)' }}>
              <span style={{ color: 'var(--color-muted, #64748b)' }}>Horario / Turno</span>
              <span style={{ fontWeight: '600', color: 'var(--color-navy, #0f172a)' }}>
                {new Date(reservation.startTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} —{' '}
                {new Date(reservation.endTime).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--color-border-soft, #f1f5f9)' }}>
              <span style={{ color: 'var(--color-muted, #64748b)' }}>Acompañantes (Pax)</span>
              <strong style={{ color: 'var(--color-navy, #0f172a)' }}>{reservation.pax} {reservation.pax === 1 ? 'persona' : 'personas'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
              <span style={{ color: 'var(--color-muted, #64748b)' }}>Estado de Cuenta</span>
              <strong style={{ color: isPaid ? '#059669' : '#d97706' }}>
                {isPaid ? 'Total Pagado' : `Cuenta Abierta (${formatMoney(reservation.totalAmount || reservation.price)})`}
              </strong>
            </div>
          </div>
        </div>

        {/* Acciones del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
          <button type="button" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={handlePrint}>
            <Printer size={16} />
            <span>Imprimir Ticket</span>
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cerrar
            </button>
            {!isCheckedIn ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#059669', borderColor: '#059669' }}
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
