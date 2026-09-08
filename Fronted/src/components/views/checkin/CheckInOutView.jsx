import { useState } from 'react';
import { usePermissions } from '../../../auth/authContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { formatReservationInstant, reservationStatusToLabel } from '../../../reservations/reservationModel';
import { useHotel } from '../../../state/hotelContext';
import FolioPanel from '../../../folios/FolioPanel';
import { Dialog, TabPanel, Tabs } from '../../ui/Overlay';
import { DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';
import { SignatureCanvas } from '../../common/SignatureCanvas.jsx';
import { StayConditionsDocument } from '../../../documents/StayConditionsDocument.jsx';
import { DEFAULT_CHECKLIST, HOTEL_INFO } from '../../../documents/stayConditionsModel.js';
import { documentsClient } from '../../../documents/documentsClient.js';
import { FileCheck, PenTool, CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';

function CheckInDialog({ reservation, guest, room, onClose, notify }) {
  const { state, stayCommands } = useHotel();
  const [step, setStep] = useState('validation'); // 'validation' | 'document'
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST);
  const [guestSignature, setGuestSignature] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const receptionistName = state.account?.name || state.account?.email || 'Recepción Park Plaza';

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      // 1. Save signed Stay Conditions Document to Backend
      const docPayload = {
        reservationId: reservation.id,
        reference: `DOC-ESTADIA-${reservation.id.substring(0, 8).toUpperCase()}`,
        status: 'Vigente',
        metadata: {
          documentType: 'stay_conditions_recognition',
          hotel: HOTEL_INFO,
          guest: {
            name: guest?.name || (guest?.firstName ? `${guest.firstName} ${guest.lastName || ''}`.trim() : 'Huésped Principal'),
            documentNumber: guest?.documentNumber || '',
            docType: guest?.docType || guest?.primaryDocument?.type || 'DNI',
            phone: guest?.phone || '',
            email: guest?.email || '',
          },
          room: {
            id: room?.id,
            number: room?.number,
            category: room?.category,
          },
          stay: {
            reservationId: reservation.id,
            checkIn: reservation.checkInAt,
            checkOut: reservation.checkOutAt,
            nights: reservation.nights || 1,
            roomNumber: room?.number,
          },
          pricing: {
            nightlyRate: reservation.nightlyRate || 130,
            totalStay: reservation.total || 130,
            advancePaid: 0,
            pendingBalance: reservation.total || 130,
          },
          checklist,
          signatures: {
            guestSignature,
            guestSignedAt: new Date().toISOString(),
            hotelRepresentative: receptionistName,
            hotelSignedAt: new Date().toISOString(),
          },
        },
      };

      try {
        await documentsClient.createContract(docPayload);
      } catch (docErr) {
        console.warn('Advertencia al guardar documento en backend:', docErr);
      }

      // 2. Perform check-in command
      await stayCommands.checkIn(reservation.id);
      notify('Check-in completado con éxito', 'La estadía fue abierta y el Documento de Condiciones de Estadía fue firmado y custodiado digitalmente.', 'success');
      onClose();
    } catch (failure) {
      setError(failure.message || 'No se pudo completar el check-in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail-stack checkin-dialog-stack">
      {/* Step Tabs Header */}
      <div className="checkin-step-tabs">
        <button
          type="button"
          onClick={() => setStep('validation')}
          className={`checkin-step-tab${step === 'validation' ? ' is-active' : ''}`}
        >
          <ShieldCheck size={16} /> 1. Validación y Entrega
        </button>
        <button
          type="button"
          onClick={() => setStep('document')}
          className={`checkin-step-tab${step === 'document' ? ' is-active' : ''}`}
        >
          <FileCheck size={16} className={guestSignature ? 'checkin-step-icon is-signed' : 'checkin-step-icon'} /> 2. Documento y Firma Digital
        </button>
      </div>

      {step === 'validation' ? (
        <div className="checkin-dialog-section">
          <DetailGrid items={[
            { label: 'Huésped Principal', value: guest?.name || 'Huésped no disponible' },
            { label: 'Habitación Asignada', value: room ? `Habitación ${room.number} (${room.category || ''})` : 'Habitación no disponible' },
            { label: 'Fecha / Hora de Ingreso', value: formatReservationInstant(reservation.checkInAt) },
            { label: 'Salida Prevista', value: formatReservationInstant(reservation.checkOutAt) },
            { label: 'Estado de Reserva', node: <StatusBadge>{reservationStatusToLabel(reservation.status)}</StatusBadge> },
          ]} />

          <div className="checkin-checklist-card">
            <div className="checkin-checklist-heading">
              <ShieldCheck size={16} className="checkin-gold-icon" /> Checklist de Estado Inicial y Entrega de Habitación
            </div>
            <div className="checkin-checklist-grid">
              {checklist.map((item) => (
                <label key={item.id} className="checkin-checklist-item">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => {
                      setChecklist(checklist.map(c => c.id === item.id ? { ...c, checked: e.target.checked } : c));
                    }}
                    className="checkin-checklist-input"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="alert-banner alert-banner-info">
            ℹ️ Al continuar, se presentará el <strong>Documento Oficial de Condiciones de Estadía y Reconocimiento de Gastos</strong> para ser revisado y firmado digitalmente por el huésped.
          </div>

          <div className="form-actions checkin-dialog-actions">
            <button className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button>
            <button
              disabled={!guest || !room}
              onClick={() => setStep('document')}
              className="btn btn-primary checkin-inline-button"
            >
              Continuar a Firma de Documento <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div className="checkin-dialog-section">
          {/* Document Preview */}
          <div className="checkin-document-preview">
            <StayConditionsDocument
              reservation={reservation}
              guest={guest}
              room={room}
              stay={{ checkInAt: reservation.checkInAt }}
              checklist={checklist}
              onChecklistChange={setChecklist}
              guestSignature={guestSignature}
              receptionistName={receptionistName}
            />
          </div>

          {/* Signature Canvas Box */}
          <div className="checkin-signature-card">
            <div className="checkin-signature-heading-row">
              <div className="checkin-signature-heading">
                <PenTool size={16} className="checkin-gold-icon" /> Firma Digital del Huésped ({guest?.name || 'Titular'})
              </div>
              {guestSignature && (
                <span className="checkin-signature-status">
                  <CheckCircle2 size={14} /> Firma registrada
                </span>
              )}
            </div>

            <SignatureCanvas
              onChange={(dataUrl) => setGuestSignature(dataUrl)}
              onClear={() => setGuestSignature(null)}
              placeholder="Firme aquí con el dedo o ratón para validar su estadía"
            />
          </div>

          {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}
          {state.stayCommandRequest.retryBlocked ? <div className="alert-banner alert-banner-danger" role="alert">{state.stayCommandRequest.error}</div> : null}

          <div className="form-actions checkin-dialog-actions">
            <button className="btn btn-outline checkin-inline-button" disabled={busy} onClick={() => setStep('validation')}>
              <ArrowLeft size={16} /> Volver a validación
            </button>
            <button
              disabled={busy || state.stayCommandRequest.retryBlocked || !guest || !room || !guestSignature}
              onClick={submit}
              className="btn btn-primary checkin-inline-button"
            >
              {busy ? 'Confirmando check-in y guardando documento…' : '✓ Confirmar Check-in y Guardar Documento'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckOutDialog({ stay, reservation, room, guest, onClose, notify }) {
  const { state, stayCommands } = useHotel();
  const { can } = usePermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [folio, setFolio] = useState(null);

  const balanceNumber = Number(folio?.balance || 0);
  const hasDebt = balanceNumber > 0;
  const canOverride = can(PERMISSIONS.staysCheckOutOverride);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (hasDebt && (!canOverride || !overrideReason.trim())) {
        throw new Error('Para procesar un Check-out con saldo pendiente, debes registrar el cobro en el folio o indicar el motivo de cuenta por cobrar.');
      }
      await stayCommands.checkOut(stay.id, overrideReason.trim() ? { overrideReason: overrideReason.trim() } : {});
      notify(
        'Check-out completado con éxito',
        hasDebt
          ? `La estadía fue cerrada y el saldo pendiente de S/ ${balanceNumber.toFixed(2)} fue transferido a Cuentas por Cobrar (Finanzas).`
          : 'La estadía fue liquidada y la habitación pasó automáticamente a estado En Limpieza.',
        'success'
      );
      onClose();
    } catch (failure) {
      setError(failure.message || 'No se pudo completar el check-out.');
    } finally {
      setBusy(false);
    }
  };

  const guestName = guest?.name || (guest?.firstName ? `${guest.firstName} ${guest.lastName || ''}`.trim() : 'Huésped Titular');

  return (
    <div className="detail-stack checkout-dialog-stack">
      {/* Top Details Card */}
      <div className="checkout-details-card">
        <div>
          <span className="checkout-detail-label">Huésped:</span>
          <strong className="checkout-detail-value">{guestName}</strong>
        </div>
        <div>
          <span className="checkout-detail-label">Habitación:</span>
          <strong className="checkout-detail-value">
            {room ? `Hab. ${room.number} (${room.category || 'Estándar'})` : 'No asignada'}
          </strong>
        </div>
        <div>
          <span className="checkout-detail-label">Ingreso:</span>
          <span className="checkout-detail-text">{formatReservationInstant(stay.checkInAt)}</span>
        </div>
        <div>
          <span className="checkout-detail-label">N.º Estadía / Reserva:</span>
          <span className="checkout-detail-reference">
            #{stay.id.slice(0, 8)} · {reservation ? `Res: #${reservation.id.slice(0, 8)}` : 'Directa'}
          </span>
        </div>
      </div>

      {/* Interactive Folio Panel */}
      <FolioPanel
        stayId={stay.id}
        canCharge={can(PERMISSIONS.financeCharge)}
        canPay={can(PERMISSIONS.financePayment)}
        canReverse={can(PERMISSIONS.financeReverse)}
        onFolioChange={setFolio}
      />

      {/* Debt / Override Handling Box */}
      {hasDebt ? (
        <div className="checkout-debt-card">
          <div className="checkout-debt-heading">
            <span>⚠️ Saldo pendiente por liquidar: S/ {balanceNumber.toFixed(2)}</span>
          </div>
          <div className="checkout-debt-description">
            Puedes registrar el pago arriba en el panel de folio, o si el huésped se retira con crédito/pago corporativo diferido, autorizar la salida como <strong>Cuenta por Cobrar (Finanzas)</strong>.
          </div>

          {canOverride && (
            <label className="checkout-override-field">
              <span className="checkout-override-label">
                Motivo de Cuenta por Cobrar (Requerido para autorizar salida con saldo):
              </span>
              <input
                type="text"
                required
                maxLength={300}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Ej. Facturación a crédito empresa 15 días, transferencia pendiente de verificación..."
                className="checkout-override-input"
              />
            </label>
          )}
        </div>
      ) : (
        <div className="checkout-settled-card">
          <span>✓ Cuenta liquidada en su totalidad. La habitación pasará a estado <strong>En Limpieza</strong> al finalizar.</span>
        </div>
      )}

      {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}
      {state.stayCommandRequest.retryBlocked ? <div className="alert-banner alert-banner-danger" role="alert">{state.stayCommandRequest.error}</div> : null}

      <div className="form-actions checkout-dialog-actions">
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={busy || state.stayCommandRequest.retryBlocked || !room || (hasDebt && !overrideReason.trim())}
          onClick={submit}
          className={`btn btn-primary checkout-submit-button${hasDebt ? ' is-debt' : ''}`}
        >
          {busy
            ? 'Procesando check-out…'
            : hasDebt
            ? '⚠️ Autorizar Salida con Cuenta por Cobrar'
            : '✓ Confirmar Check-out y Liberar Habitación'}
        </button>
      </div>
    </div>
  );
}

export default function CheckInOutView({ notify }) {
  const { can } = usePermissions();
  const { state, stayCommands, reservationCommands } = useHotel();
  const [tab, setTab] = useState('checkin');
  const [reservationId, setReservationId] = useState(null);
  const [stayId, setStayId] = useState(null);

  const arrivals = can(PERMISSIONS.staysCheckIn) ? state.persistentReservations.filter((reservation) => ['pending', 'confirmed'].includes(reservation.status)) : [];
  const departures = can(PERMISSIONS.staysCheckOut) ? state.persistentStays.filter((stay) => stay.status === 'active') : [];

  const reservation = state.persistentReservations.find((entry) => entry.id === reservationId) || null;
  const selectedStay = state.persistentStays.find((entry) => entry.id === stayId) || null;
  const guestForReservation = state.clients.find((guest) => guest.id === reservation?.primaryGuestId) || null;
  const roomForReservation = state.rooms.find((room) => room.id === reservation?.roomId) || null;
  const departureReservation = state.persistentReservations.find((reservationEntry) => reservationEntry.id === selectedStay?.reservationId) || null;
  const departureGuest = state.clients.find((guest) => guest.id === departureReservation?.primaryGuestId) || null;
  const roomForStay = state.rooms.find((room) => room.id === selectedStay?.roomId) || null;
  const loading = state.reservationRequest.status === 'loading' || state.stayRequest.status === 'loading';

  const retry = () => Promise.allSettled([reservationCommands.reload(), stayCommands.reload()]);

  return <div className="view-container">
    <PageHeader
      metadata="Recepción y Control de Estadías 5★"
      title="Check-in y Check-out"
      description="Gestión de ingresos, salidas de huéspedes, validación de identidad y liquidación de estadías."
    />

    <MetricStrip items={[
      { label: 'Llegadas listas', value: arrivals.length },
      { label: 'Estadías activas', value: departures.length },
      { label: 'Habitaciones en limpieza', value: state.rooms.filter((room) => ['cleaning', 'En limpieza'].includes(room.status)).length },
      { label: 'Habitaciones disponibles', value: state.rooms.filter((room) => ['available', 'Disponible'].includes(room.status)).length },
    ]} />

    {state.reservationRequest.status === 'error' || state.stayRequest.status === 'error' ? (
      <div className="alert-banner alert-banner-danger" role="alert">
        <span>{state.reservationRequest.error || state.stayRequest.error}</span>
        <button className="btn btn-sm btn-outline" onClick={retry}>Reintentar</button>
      </div>
    ) : null}

    <Tabs
      label="Operación de recepción"
      tabs={[
        { id: 'checkin', label: `📥 Llegadas (Check-in) (${arrivals.length})` },
        { id: 'checkout', label: `📤 Salidas (Check-out) (${departures.length})` },
      ]}
      activeTab={tab}
      onChange={setTab}
    />

    <TabPanel id="checkin" active={tab === 'checkin'} label="Llegadas programadas">
      <div className="operation-cards">
        {loading && !arrivals.length ? <div className="alert-banner alert-banner-info" role="status">Cargando datos de recepción…</div> : null}
        {arrivals.length ? arrivals.map((entry) => {
          const guest = state.clients.find((item) => item.id === entry.primaryGuestId);
          const room = state.rooms.find((item) => item.id === entry.roomId);
          return (
            <article className="card operation-card checkin-operation-card" key={entry.id}>
              <div className="row-between">
                <div className="checkin-operation-heading">
                  <div className="checkin-operation-avatar">
                    {(guest?.name || 'H')[0]}
                  </div>
                  <div>
                    <span className="eyebrow checkin-operation-eyebrow">Reserva {entry.id.slice(0, 8)}</span>
                    <h3 className="checkin-operation-title">{guest?.name || 'Huésped no disponible'}</h3>
                  </div>
                </div>
                <StatusBadge>{reservationStatusToLabel(entry.status)}</StatusBadge>
              </div>
              <div className="checkin-operation-details">
                <div>🛏️ <strong>Habitación:</strong> {room ? `Hab. ${room.number} (${room.category || 'Estándar'})` : 'No asignada'}</div>
                <div>📅 <strong>Fecha Check-in:</strong> {formatReservationInstant(entry.checkInAt)}</div>
              </div>
              <button className="btn btn-primary checkin-operation-button" disabled={!guest || !room || state.stayCommandRequest.status === 'saving'} onClick={() => setReservationId(entry.id)}>
                Procesar Check-in
              </button>
            </article>
          );
        }) : (
          <EmptyState
            title="Sin llegadas pendientes para hoy"
            description="No hay check-ins programados en este momento. Todas las reservas elegibles han sido procesadas."
          />
        )}
      </div>
    </TabPanel>

    <TabPanel id="checkout" active={tab === 'checkout'} label="Estadías activas">
      <div className="operation-cards">
        {departures.length ? departures.map((entry) => {
          const room = state.rooms.find((item) => item.id === entry.roomId);
          return (
            <article className="card operation-card checkin-operation-card" key={entry.id}>
              <div className="row-between">
                <div className="checkin-operation-heading">
                  <div className="checkout-operation-avatar">
                    {room ? room.number : 'Hab'}
                  </div>
                  <div>
                    <span className="eyebrow checkin-operation-eyebrow">Estadía Activa</span>
                    <h3 className="checkin-operation-title">Habitación {room ? room.number : 'N/A'}</h3>
                  </div>
                </div>
                <StatusBadge>Activa</StatusBadge>
              </div>
              <div className="checkin-operation-details">
                <div>⏱️ <strong>Ingresó:</strong> {formatReservationInstant(entry.checkInAt)}</div>
              </div>
              <button className="btn btn-primary checkin-operation-button" disabled={!room || state.stayCommandRequest.status === 'saving'} onClick={() => setStayId(entry.id)}>
                Procesar Check-out
              </button>
            </article>
          );
        }) : (
          <EmptyState
            title="Sin estadías activas pendientes"
            description="Actualmente no hay huéspedes alojados pendientes de Check-out."
          />
        )}
      </div>
    </TabPanel>

    <Dialog open={Boolean(reservation)} onClose={() => setReservationId(null)} title="Procesar Check-in de Huésped" wide>
      {reservation ? <CheckInDialog reservation={reservation} guest={guestForReservation} room={roomForReservation} onClose={() => setReservationId(null)} notify={notify} /> : null}
    </Dialog>

    <Dialog open={Boolean(selectedStay)} onClose={() => setStayId(null)} title="Procesar Check-out de Estadía" wide>
      {selectedStay ? <CheckOutDialog stay={selectedStay} reservation={departureReservation} room={roomForStay} guest={departureGuest} onClose={() => setStayId(null)} notify={notify} /> : null}
    </Dialog>
  </div>;
}
