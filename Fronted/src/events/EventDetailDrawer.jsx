import React, { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  MapPin, 
  Users, 
  UserCheck, 
  ShieldCheck, 
  AlertTriangle, 
  Edit3, 
  CheckCircle2, 
  PlayCircle, 
  Flag, 
  Archive, 
  XCircle,
  UtensilsCrossed,
  Printer
} from 'lucide-react';
import { P1Badge } from '../components/ui/P1Atoms';
import { eventsClient } from './eventsClient';
import { formatMoney } from '../domain/hotelModel.js';
import { EventBeoModal } from './EventBeoModal';
import { Drawer } from '../components/ui/Overlay';

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

  const fetchEvent = useCallback(async (signal) => {
    try {
      setLoading(true);
      const ev = await eventsClient.getEventDetail(eventId, signal);
      if (signal?.aborted) return;
      setEvent(ev);
      setConfirmDeposit(ev.depositAmount ? Number(ev.depositAmount) : 0);
    } catch (e) {
      if (signal?.aborted) return;
      setError(e.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    const controller = new AbortController();
    setEvent(null);
    setError(null);
    setLoading(Boolean(eventId));
    if (eventId) fetchEvent(controller.signal);
    return () => controller.abort();
  }, [eventId, fetchEvent]);

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
    <Drawer open={Boolean(eventId)} onClose={onClose} title="Detalle del Salón & Banquetería" description="Ficha Operativa de Evento">

        {/* Drawer Body */}
        <div className="event-detail-body">
          {loading ? (
            <div className="event-detail-loading">
              Cargando detalles del evento...
            </div>
          ) : error ? (
            <div className="event-detail-error">
              {error}
            </div>
          ) : event ? (
            <>
              {/* Quarantine Notice */}
              {isQuarantine && (
                <div className="event-quarantine-notice">
                  <AlertTriangle size={18} color="#B45309" />
                  <div>
                    <strong className="event-quarantine-title">Identidad en Cuarentena</strong>
                    <span className="event-quarantine-copy">Debe resolver la identidad del titular antes de confirmar o editar.</span>
                  </div>
                </div>
              )}

              {/* Status Pill & Title Card */}
              <div className="event-detail-card event-detail-card-soft">
                <div className="event-detail-card-heading">
                  <P1Badge variant={statusInfo.variant}>
                    {statusInfo.label}
                  </P1Badge>
                  <span className="event-detail-id">ID: {event.id?.slice(0, 8)}</span>
                </div>
                <h3 className="event-detail-title">
                  {event.title}
                </h3>
                {event.description && (
                  <p className="event-detail-description">
                    {event.description}
                  </p>
                )}
              </div>

              {/* Identity & Host */}
              <div className="event-detail-card">
                <div className="event-detail-section-heading">
                  <UserCheck size={16} color="#D97706" />
                  <span className="event-detail-section-label">
                    Anfitrión / Titular
                  </span>
                </div>
                {event.guestId ? (
                  <div>
                    <div className="event-detail-host">
                      👤 {event.guest?.firstName ? `${event.guest.firstName} ${event.guest.lastName}` : (event.guest?.name || 'Huésped del Hotel')}
                    </div>
                    {event.guest?.documentNumber && (
                      <span className="event-detail-host-document">
                        Doc: {event.guest.documentNumber}
                      </span>
                    )}
                  </div>
                ) : event.customerAccountId ? (
                  <div>
                    <div className="event-detail-host">
                      🏢 Cuenta Comercial: {event.customerAccountId}
                    </div>
                  </div>
                ) : (
                  <span className="event-detail-unassigned">Sin titular asignado</span>
                )}
              </div>

              {/* Times & Location Grid */}
              <div className="event-detail-info-grid">
                <div className="event-detail-info-card">
                  <span className="event-detail-info-label">
                    <MapPin size={12} color="#D97706" /> Salón / Espacio
                  </span>
                  <strong className="event-detail-info-value">
                    {event.space?.name || 'Por asignar'}
                  </strong>
                </div>

                <div className="event-detail-info-card">
                  <span className="event-detail-info-label">
                    <Users size={12} color="#D97706" /> Asistentes
                  </span>
                  <strong className="event-detail-info-value">
                    {event.attendees} personas
                  </strong>
                </div>

                <div className="event-detail-info-card">
                  <span className="event-detail-info-label">
                    <Clock size={12} color="#D97706" /> Inicio
                  </span>
                  <strong className="event-detail-info-value event-detail-info-value-small">
                    {new Date(event.startsAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>

                <div className="event-detail-info-card">
                  <span className="event-detail-info-label">
                    <Clock size={12} color="#D97706" /> Fin
                  </span>
                  <strong className="event-detail-info-value event-detail-info-value-small">
                    {new Date(event.endsAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </strong>
                </div>
              </div>

              {/* Catering Services List */}
              {event.services && event.services.length > 0 && (
                <div className="event-detail-card">
                  <div className="event-detail-section-heading">
                    <UtensilsCrossed size={16} color="#D97706" />
                    <span className="event-detail-section-label">
                      Servicios & Banquetería Contratados ({event.services.length})
                    </span>
                  </div>
                  <div className="event-detail-services">
                    {event.services.map((s, idx) => (
                      <div key={idx} className="event-detail-service-row">
                        <span><strong>{s.quantity}x</strong> {s.serviceCode}</span>
                        <strong className="event-detail-service-total">{s.totalAmount ? formatMoney(Number(s.totalAmount)) : '—'}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Financial Summary Card */}
              <div className="event-detail-financial-card">
                <div>
                  <span className="event-detail-financial-label">Presupuesto Total</span>
                  <div className="event-detail-financial-total">
                    {formatMoney(Number(event.estimatedAmount || 0))}
                  </div>
                </div>
                {event.depositReceivedAmount && Number(event.depositReceivedAmount) > 0 ? (
                  <div className="event-detail-deposit event-detail-deposit-paid">
                    <span>Adelanto Cobrado ✓</span>
                    <strong>{formatMoney(Number(event.depositReceivedAmount))}</strong>
                  </div>
                ) : event.depositAmount && Number(event.depositAmount) > 0 ? (
                  <div className="event-detail-deposit event-detail-deposit-minimum">
                    <span>Adelanto Mínimo</span>
                    <strong>{formatMoney(Number(event.depositAmount))}</strong>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        {/* Drawer Actions Footer */}
        {event && (
          <div className="event-detail-actions">
            {/* Botón Ver Orden BEO / Imprimir */}
            <button 
              type="button" 
              className="btn btn-outline event-detail-action event-detail-action-beo"
              onClick={() => setShowBeoModal(true)}
            >
              <Printer size={16} /> Ver Orden BEO / Imprimir
            </button>

            {!isLocked && !isQuarantine && event.status !== 'cancelled' && event.status !== 'completed' && (
              <button 
                type="button" 
                className="btn btn-outline event-detail-action"
                onClick={() => onEdit(event.id)}
                disabled={actionLoading}
              >
                <Edit3 size={15} /> Modificar Datos del Evento
              </button>
            )}
            
            {(event.status === 'draft' || event.status === 'tentative') && !isQuarantine && (
              <button 
                type="button"
                className="btn btn-primary event-detail-action"
                onClick={() => setShowConfirmModal(true)}
                disabled={actionLoading}
              >
                <ShieldCheck size={16} /> Confirmar & Cobrar Adelanto
              </button>
            )}

            {event.status === 'confirmed' && (
              <button 
                type="button" 
                className="btn btn-primary event-detail-action"
                onClick={() => handleAction(eventsClient.advanceEvent, 'preparing')} 
                disabled={actionLoading}
              >
                ▶ Iniciar Montaje y Preparación
              </button>
            )}
            {event.status === 'preparing' && (
              <button 
                type="button" 
                className="btn btn-primary event-detail-action"
                onClick={() => handleAction(eventsClient.advanceEvent, 'start')} 
                disabled={actionLoading}
              >
                ▶ Iniciar Evento en Salón
              </button>
            )}
            {event.status === 'in_progress' && (
              <button 
                type="button" 
                className="btn btn-primary event-detail-action"
                onClick={() => handleAction(eventsClient.advanceEvent, 'complete')} 
                disabled={actionLoading}
              >
                ✓ Finalizar Evento
              </button>
            )}

            {(event.status === 'draft' || event.status === 'tentative' || event.status === 'confirmed') && (
              <button 
                type="button" 
                className="btn btn-danger event-detail-action"
                onClick={() => setShowCancelModal(true)}
                disabled={actionLoading}
              >
                Cancelar Evento
              </button>
            )}

            {(event.status === 'cancelled' || event.status === 'completed') && (
              <button 
                type="button" 
                className="btn btn-outline event-detail-action"
                onClick={() => handleAction(eventsClient.archiveEvent)}
                disabled={actionLoading}
              >
                Archivar Registro
              </button>
            )}
          </div>
        )}
      {/* MODAL: Confirmar Evento & Registrar Pago de Adelanto (Recomendación 2) */}
      {showConfirmModal && (
        <div className="event-confirm-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="event-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="event-modal-heading">
              <div className="event-modal-title-group">
                <ShieldCheck size={22} color="#15803D" />
                <h3 className="event-modal-title">Confirmar Reserva & Adelanto</h3>
              </div>
              <button type="button" onClick={() => setShowConfirmModal(false)} className="event-modal-close">✕</button>
            </div>

            <form onSubmit={handleExecuteConfirm} className="event-modal-form">
              <div>
                <label className="event-form-label">
                  Monto de Adelanto / Garantía Recibido (S/)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={confirmDeposit}
                  onChange={(e) => setConfirmDeposit(e.target.value)}
                  className="event-form-control event-form-control-amount"
                  required
                />
              </div>

              <div>
                <label className="event-form-label">
                  Método de Pago
                </label>
                <select
                  value={confirmPaymentMethod}
                  onChange={(e) => setConfirmPaymentMethod(e.target.value)}
                  className="event-form-control"
                >
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="event-form-label">
                  Notas / N° Operación Bancaria
                </label>
                <input
                  type="text"
                  placeholder="Ej: Transf. BCP Op. #982341"
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  className="event-form-control"
                />
              </div>

              <div className="event-modal-actions event-modal-actions-confirm">
                <button type="button" onClick={() => setShowConfirmModal(false)} className="btn btn-outline event-modal-button">
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary event-modal-button event-modal-button-primary">
                  {actionLoading ? 'Procesando...' : 'Confirmar & Bloquear Salón'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Cancelar Evento */}
      {showCancelModal && (
        <div className="event-cancel-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="event-cancel-modal" onClick={e => e.stopPropagation()}>
            <div className="event-modal-heading event-modal-heading-cancel">
              <div className="event-modal-title-group">
                <XCircle size={22} color="#DC2626" />
                <h3 className="event-modal-title">Cancelar Evento</h3>
              </div>
              <button type="button" onClick={() => setShowCancelModal(false)} className="event-modal-close">✕</button>
            </div>

            <form onSubmit={handleExecuteCancel} className="event-modal-form">
              <div>
                <label className="event-form-label">
                  Motivo de Cancelación *
                </label>
                <textarea
                  rows={3}
                  placeholder="Indique la razón por la cual se cancela este evento..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="event-form-control"
                  required
                />
              </div>

              <div className="event-modal-actions event-modal-actions-cancel">
                <button type="button" onClick={() => setShowCancelModal(false)} className="btn btn-outline event-modal-button">
                  Atrás
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-danger event-modal-button event-modal-button-danger">
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
    </Drawer>
  );
}
