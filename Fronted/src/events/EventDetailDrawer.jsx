import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  MapPin, 
  Users, 
  DollarSign, 
  UserCheck, 
  ShieldCheck, 
  AlertTriangle, 
  Edit3, 
  CheckCircle2, 
  PlayCircle, 
  Flag, 
  Archive, 
  XCircle,
  Building,
  UtensilsCrossed,
  CreditCard,
  Receipt,
  Printer
} from 'lucide-react';
import { P1Button, P1Badge } from '../components/ui/P1Atoms';
import { eventsClient } from './eventsClient';
import { formatMoney } from '../domain/hotelModel.js';
import { EventBeoModal } from './EventBeoModal';

const STATUS_CONFIG = {
  draft: { label: 'Borrador', variant: 'neutral', icon: Clock },
  tentative: { label: 'Tentativo (Sin Pago)', variant: 'warning', icon: Clock },
  confirmed: { label: 'Confirmado & Reservado', variant: 'success', icon: CheckCircle2 },
  preparing: { label: 'En Preparación / Montaje', variant: 'primary', icon: PlayCircle },
  in_progress: { label: 'En Curso', variant: 'primary', icon: PlayCircle },
  completed: { label: 'Finalizado con Éxito', variant: 'success', icon: Flag },
  cancelled: { label: 'Cancelado', variant: 'danger', icon: XCircle },
  archived: { label: 'Archivado', variant: 'neutral', icon: Archive },
};

const PAYMENT_METHODS = [
  'Efectivo',
  'Tarjeta de Crédito / Débito',
  'Transferencia Bancaria',
  'Yape / Plin',
  'Cargar a la Habitación (Folio)'
];

export function EventDetailDrawer({ eventId, onClose, onEdit, onRefresh }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showBeoModal, setShowBeoModal] = useState(false);

  // Modal State for Confirm Payment
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmDeposit, setConfirmDeposit] = useState(0);
  const [confirmPaymentMethod, setConfirmPaymentMethod] = useState('Efectivo');
  const [confirmNotes, setConfirmNotes] = useState('');

  // Modal State for Cancel Reason
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const ev = await eventsClient.getEventDetail(eventId);
      setEvent(ev);
      setConfirmDeposit(ev.depositAmount ? Number(ev.depositAmount) : 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) fetchEvent();
  }, [eventId]);

  const handleAction = async (actionFn, ...args) => {
    try {
      setActionLoading(true);
      await actionFn(eventId, event.version, ...args);
      await fetchEvent();
      onRefresh();
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteConfirm = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await eventsClient.confirmEvent(
        eventId, 
        event.version, 
        Number(confirmDeposit || 0), 
        confirmPaymentMethod, 
        confirmNotes
      );
      setShowConfirmModal(false);
      await fetchEvent();
      onRefresh();
    } catch (err) {
      alert(`Error al confirmar evento: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteCancel = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    try {
      setActionLoading(true);
      await eventsClient.cancelEvent(eventId, event.version, cancelReason.trim());
      setShowCancelModal(false);
      await fetchEvent();
      onRefresh();
    } catch (err) {
      alert(`Error al cancelar evento: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!eventId) return null;

  const isLocked = event && (event.status === 'confirmed' || event.status === 'archived');
  const isQuarantine = event && event.quarantineStatus === 'pending';
  const statusInfo = event ? STATUS_CONFIG[event.status] || { label: event.status, variant: 'neutral', icon: Clock } : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end', background: 'rgba(2, 6, 23, 0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div 
        style={{
          width: '100%',
          maxWidth: 500,
          background: '#FFFFFF',
          height: '100%',
          boxShadow: '-10px 0 25px -5px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box'
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div style={{ padding: '22px 26px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9FAFB' }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.06em' }}>
              Ficha Operativa de Evento
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1E3A8A', margin: '2px 0 0' }}>
              Detalle del Salón & Banquetería
            </h2>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 6, borderRadius: 8 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ padding: '24px 26px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7280', fontSize: 14 }}>
              Cargando detalles del evento...
            </div>
          ) : error ? (
            <div style={{ padding: 14, background: '#FEE2E2', color: '#B91C1C', borderRadius: 10, fontSize: 13.5 }}>
              {error}
            </div>
          ) : event ? (
            <>
              {/* Quarantine Notice */}
              {isQuarantine && (
                <div style={{ padding: 14, background: '#FEF3C7', border: '1px solid #FDE047', borderRadius: 10, display: 'flex', gap: 10 }}>
                  <AlertTriangle size={18} color="#B45309" />
                  <div>
                    <strong style={{ fontSize: 12.5, color: '#92400E', display: 'block' }}>Identidad en Cuarentena</strong>
                    <span style={{ fontSize: 12, color: '#B45309' }}>Debe resolver la identidad del titular antes de confirmar o editar.</span>
                  </div>
                </div>
              )}

              {/* Status Pill & Title Card */}
              <div style={{ padding: '16px 20px', background: '#F9FAFB', borderRadius: 14, border: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <P1Badge variant={statusInfo.variant}>
                    {statusInfo.label}
                  </P1Badge>
                  <span style={{ fontSize: 11.5, color: '#6B7280', fontWeight: 600 }}>ID: {event.id?.slice(0, 8)}</span>
                </div>
                <h3 style={{ fontSize: 19, fontWeight: 900, color: '#111827', margin: '0 0 6px', lineHeight: 1.3 }}>
                  {event.title}
                </h3>
                {event.description && (
                  <p style={{ fontSize: 13, color: '#4B5563', margin: 0, lineHeight: 1.4 }}>
                    {event.description}
                  </p>
                )}
              </div>

              {/* Identity & Host */}
              <div style={{ padding: '16px 20px', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <UserCheck size={16} color="#D97706" />
                  <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#1E3A8A' }}>
                    Anfitrión / Titular
                  </span>
                </div>
                {event.guestId ? (
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
                      👤 {event.guest?.firstName ? `${event.guest.firstName} ${event.guest.lastName}` : (event.guest?.name || 'Huésped del Hotel')}
                    </div>
                    {event.guest?.documentNumber && (
                      <span style={{ fontSize: 12, color: '#6B7280', display: 'block', marginTop: 2 }}>
                        Doc: {event.guest.documentNumber}
                      </span>
                    )}
                  </div>
                ) : event.customerAccountId ? (
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
                      🏢 Cuenta Comercial: {event.customerAccountId}
                    </div>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Sin titular asignado</span>
                )}
              </div>

              {/* Times & Location Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: '14px', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                  <span style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                    <MapPin size={12} color="#D97706" /> Salón / Espacio
                  </span>
                  <strong style={{ fontSize: 14, color: '#111827', display: 'block', marginTop: 4 }}>
                    {event.space?.name || 'Por asignar'}
                  </strong>
                </div>

                <div style={{ padding: '14px', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                  <span style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                    <Users size={12} color="#D97706" /> Asistentes
                  </span>
                  <strong style={{ fontSize: 14, color: '#111827', display: 'block', marginTop: 4 }}>
                    {event.attendees} personas
                  </strong>
                </div>

                <div style={{ padding: '14px', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                  <span style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                    <Clock size={12} color="#D97706" /> Inicio
                  </span>
                  <strong style={{ fontSize: 13, color: '#111827', display: 'block', marginTop: 4 }}>
                    {new Date(event.startsAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>

                <div style={{ padding: '14px', background: '#F9FAFB', borderRadius: 12, border: '1px solid #E5E7EB' }}>
                  <span style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                    <Clock size={12} color="#D97706" /> Fin
                  </span>
                  <strong style={{ fontSize: 13, color: '#111827', display: 'block', marginTop: 4 }}>
                    {new Date(event.endsAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>
              </div>

              {/* Catering Services List */}
              {event.services && event.services.length > 0 && (
                <div style={{ padding: '16px 20px', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <UtensilsCrossed size={16} color="#D97706" />
                    <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#1E3A8A' }}>
                      Servicios & Banquetería Contratados ({event.services.length})
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {event.services.map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#F9FAFB', borderRadius: 8, fontSize: 12.5 }}>
                        <span><strong>{s.quantity}x</strong> {s.serviceCode}</span>
                        <strong style={{ color: '#D97706' }}>{s.totalAmount ? formatMoney(Number(s.totalAmount)) : '—'}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Summary Card */}
              <div style={{ padding: '16px 20px', background: '#FEF3C7', borderRadius: 14, border: '1px solid #FDE047', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#92400E', textTransform: 'uppercase' }}>Presupuesto Total</span>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#B45309' }}>
                    {formatMoney(Number(event.estimatedAmount || 0))}
                  </div>
                </div>
                {event.depositReceivedAmount && Number(event.depositReceivedAmount) > 0 ? (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#15803D' }}>Adelanto Cobrado ✓</span>
                    <strong style={{ fontSize: 16, color: '#15803D', display: 'block' }}>{formatMoney(Number(event.depositReceivedAmount))}</strong>
                  </div>
                ) : event.depositAmount && Number(event.depositAmount) > 0 ? (
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>Adelanto Mínimo</span>
                    <strong style={{ fontSize: 15, color: '#B45309', display: 'block' }}>{formatMoney(Number(event.depositAmount))}</strong>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {/* Drawer Actions Footer */}
        {event && (
          <div style={{ padding: '18px 26px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Botón Ver Orden BEO / Imprimir */}
            <button 
              type="button" 
              className="btn btn-outline"
              style={{ width: '100%', justifyContent: 'center', padding: '11px 0', fontSize: 13.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 8, borderColor: '#C59D5F', color: '#B45309', background: '#FFFBEB' }}
              onClick={() => setShowBeoModal(true)}
            >
              <Printer size={16} /> Ver Orden BEO / Imprimir
            </button>

            {!isLocked && !isQuarantine && event.status !== 'cancelled' && event.status !== 'completed' && (
              <button 
                type="button" 
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center', padding: '10px 0', fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => onEdit(event.id)}
                disabled={actionLoading}
              >
                <Edit3 size={15} /> Modificar Datos del Evento
              </button>
            )}
            
            {(event.status === 'draft' || event.status === 'tentative') && !isQuarantine && (
              <button 
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: 14, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => setShowConfirmModal(true)}
                disabled={actionLoading}
              >
                <ShieldCheck size={16} /> Confirmar & Cobrar Adelanto
              </button>
            )}

            {event.status === 'confirmed' && (
              <button 
                type="button" 
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px 0', fontSize: 14, fontWeight: 800 }}
                onClick={() => handleAction(eventsClient.advanceEvent, 'preparing')} 
                disabled={actionLoading}
              >
                ▶ Iniciar Montaje y Preparación
              </button>
            )}
            {event.status === 'preparing' && (
              <button 
                type="button" 
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px 0', fontSize: 14, fontWeight: 800 }}
                onClick={() => handleAction(eventsClient.advanceEvent, 'start')} 
                disabled={actionLoading}
              >
                ▶ Iniciar Evento en Salón
              </button>
            )}
            {event.status === 'in_progress' && (
              <button 
                type="button" 
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px 0', fontSize: 14, fontWeight: 800 }}
                onClick={() => handleAction(eventsClient.advanceEvent, 'complete')} 
                disabled={actionLoading}
              >
                ✓ Finalizar Evento
              </button>
            )}

            {(event.status === 'draft' || event.status === 'tentative' || event.status === 'confirmed') && (
              <button 
                type="button" 
                className="btn btn-danger"
                style={{ width: '100%', justifyContent: 'center', padding: '9px 0', fontSize: 13, fontWeight: 700 }}
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading}
              >
                Cancelar Evento
              </button>
            )}

            {(event.status === 'cancelled' || event.status === 'completed') && (
              <button 
                type="button" 
                className="btn btn-outline"
                style={{ width: '100%', justifyContent: 'center', padding: '9px 0', fontSize: 13, fontWeight: 700 }}
                onClick={() => handleAction(eventsClient.archiveEvent)}
                disabled={actionLoading}
              >
                Archivar Registro
              </button>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Confirmar Evento & Registrar Pago de Adelanto (Recomendación 2) */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(2,6,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowConfirmModal(false)}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 26, width: '100%', maxWidth: 460, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={22} color="#15803D" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111827' }}>Confirmar Reserva & Adelanto</h3>
              </div>
              <button type="button" onClick={() => setShowConfirmModal(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <form onSubmit={handleExecuteConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                  Monto de Adelanto / Garantía Recibido (S/)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={confirmDeposit}
                  onChange={(e) => setConfirmDeposit(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 15, fontWeight: 700, color: '#111827', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                  Método de Pago
                </label>
                <select
                  value={confirmPaymentMethod}
                  onChange={(e) => setConfirmPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13.5, color: '#111827', boxSizing: 'border-box' }}
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                  Notas / N° Operación Bancaria
                </label>
                <input
                  type="text"
                  placeholder="Ej: Transf. BCP Op. #982341"
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10 }}>
                <button type="button" onClick={() => setShowConfirmModal(false)} className="btn btn-outline" style={{ padding: '10px 18px' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: 800 }}>
                  {actionLoading ? 'Procesando...' : 'Confirmar & Bloquear Salón'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cancelar Evento */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(2,6,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowCancelModal(false)}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 26, width: '100%', maxWidth: 440, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <XCircle size={22} color="#DC2626" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111827' }}>Cancelar Evento</h3>
              </div>
              <button type="button" onClick={() => setShowCancelModal(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <form onSubmit={handleExecuteCancel} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                  Motivo de Cancelación *
                </label>
                <textarea
                  rows={3}
                  placeholder="Indique la razón por la cual se cancela este evento..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 6 }}>
                <button type="button" onClick={() => setShowCancelModal(false)} className="btn btn-outline" style={{ padding: '10px 18px' }}>
                  Atrás
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-danger" style={{ padding: '10px 22px', fontWeight: 700 }}>
                  {actionLoading ? 'Cancelando...' : 'Confirmar Cancelación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BEO Banquet Event Order */}
      {showBeoModal && (
        <EventBeoModal event={event} onClose={() => setShowBeoModal(false)} />
      )}
    </div>
  );
}
