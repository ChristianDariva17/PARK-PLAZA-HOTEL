import { useState } from 'react';
import { usePermissions } from '../../../auth/authContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { formatReservationInstant, reservationStatusToLabel } from '../../../reservations/reservationModel';
import { useHotel } from '../../../state/hotelContext';
import FolioPanel from '../../../folios/FolioPanel';
import { canOverrideCheckout, checkoutDebtMessage } from '../../../folios/folioModel';
import { Dialog, TabPanel, Tabs } from '../../ui/Overlay';
import { DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';
import { SignatureCanvas } from '../../common/SignatureCanvas.jsx';
import { StayConditionsDocument, DEFAULT_CHECKLIST, HOTEL_INFO } from '../../../documents/StayConditionsDocument.jsx';
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
    <div className="detail-stack" style={{ gap: 16 }}>
      {/* Step Tabs Header */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
        <button
          type="button"
          onClick={() => setStep('validation')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            background: step === 'validation' ? '#0F172A' : '#F1F5F9',
            color: step === 'validation' ? '#F8FAFC' : '#64748B',
            cursor: 'pointer',
          }}
        >
          <ShieldCheck size={16} /> 1. Validación y Entrega
        </button>
        <button
          type="button"
          onClick={() => setStep('document')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            border: 'none',
            background: step === 'document' ? '#0F172A' : '#F1F5F9',
            color: step === 'document' ? '#F8FAFC' : '#64748B',
            cursor: 'pointer',
          }}
        >
          <FileCheck size={16} color={guestSignature ? '#16A34A' : '#D4AF37'} /> 2. Documento y Firma Digital
        </button>
      </div>

      {step === 'validation' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DetailGrid items={[
            { label: 'Huésped Principal', value: guest?.name || 'Huésped no disponible' },
            { label: 'Habitación Asignada', value: room ? `Habitación ${room.number} (${room.category || ''})` : 'Habitación no disponible' },
            { label: 'Fecha / Hora de Ingreso', value: formatReservationInstant(reservation.checkInAt) },
            { label: 'Salida Prevista', value: formatReservationInstant(reservation.checkOutAt) },
            { label: 'Estado de Reserva', node: <StatusBadge>{reservationStatusToLabel(reservation.status)}</StatusBadge> },
          ]} />

          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 14, borderRadius: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={16} color="#D4AF37" /> Checklist de Estado Inicial y Entrega de Habitación
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
              {checklist.map((item) => (
                <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => {
                      setChecklist(checklist.map(c => c.id === item.id ? { ...c, checked: e.target.checked } : c));
                    }}
                    style={{ accentColor: '#D4AF37' }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="alert-banner alert-banner-info">
            ℹ️ Al continuar, se presentará el <strong>Documento Oficial de Condiciones de Estadía y Reconocimiento de Gastos</strong> para ser revisado y firmado digitalmente por el huésped.
          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" disabled={busy} onClick={onClose}>Cancelar</button>
            <button
              className="btn btn-primary"
              disabled={!guest || !room}
              onClick={() => setStep('document')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              Continuar a Firma de Documento <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Document Preview */}
          <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: 8, padding: 10, background: '#F8FAFC' }}>
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
          <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                <PenTool size={16} color="#D4AF37" /> Firma Digital del Huésped ({guest?.name || 'Titular'})
              </div>
              {guestSignature && (
                <span style={{ color: '#16A34A', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
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

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-outline" disabled={busy} onClick={() => setStep('validation')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={16} /> Volver a validación
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || state.stayCommandRequest.retryBlocked || !guest || !room || !guestSignature}
              onClick={submit}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
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
    <div className="detail-stack" style={{ gap: 16 }}>
      {/* Top Details Card */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        background: '#F8FAFC',
        padding: '12px 16px',
        borderRadius: 8,
        border: '1px solid #E2E8F0',
        fontSize: 12.5,
      }}>
        <div>
          <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600, display: 'block' }}>Huésped:</span>
          <strong style={{ color: '#0F172A', fontSize: 14 }}>{guestName}</strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600, display: 'block' }}>Habitación:</span>
          <strong style={{ color: '#0F172A', fontSize: 14 }}>
            {room ? `Hab. ${room.number} (${room.category || 'Estándar'})` : 'No asignada'}
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600, display: 'block' }}>Ingreso:</span>
          <span style={{ color: '#334155' }}>{formatReservationInstant(stay.checkInAt)}</span>
        </div>
        <div>
          <span style={{ color: '#64748B', fontSize: 11, fontWeight: 600, display: 'block' }}>N.º Estadía / Reserva:</span>
          <span style={{ fontFamily: 'monospace', color: '#64748B', fontSize: 12 }}>
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
        <div style={{
          background: 'rgba(217, 119, 6, 0.05)',
          border: '1.5px solid #FCD34D',
          borderRadius: 8,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, color: '#B45309' }}>
            <span>⚠️ Saldo pendiente por liquidar: S/ {balanceNumber.toFixed(2)}</span>
          </div>
          <div style={{ fontSize: 12, color: '#475569' }}>
            Puedes registrar el pago arriba en el panel de folio, o si el huésped se retira con crédito/pago corporativo diferido, autorizar la salida como <strong>Cuenta por Cobrar (Finanzas)</strong>.
          </div>

          {canOverride && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0F172A' }}>
                Motivo de Cuenta por Cobrar (Requerido para autorizar salida con saldo):
              </span>
              <input
                type="text"
                required
                maxLength={300}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Ej. Facturación a crédito empresa 15 días, transferencia pendiente de verificación..."
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12.5 }}
              />
            </label>
          )}
        </div>
      ) : (
        <div style={{
          background: 'rgba(22, 163, 74, 0.06)',
          border: '1px solid #86EFAC',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
          color: '#15803D',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 700,
        }}>
          <span>✓ Cuenta liquidada en su totalidad. La habitación pasará a estado <strong>En Limpieza</strong> al finalizar.</span>
        </div>
      )}

      {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}
      {state.stayCommandRequest.retryBlocked ? <div className="alert-banner alert-banner-danger" role="alert">{state.stayCommandRequest.error}</div> : null}

      <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <button type="button" className="btn btn-outline" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || state.stayCommandRequest.retryBlocked || !room || (hasDebt && !overrideReason.trim())}
          onClick={submit}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 20px',
            fontWeight: 800,
            background: hasDebt ? '#D97706' : '#0F172A',
          }}
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
            <article className="card operation-card" key={entry.id} style={{ padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.8)', background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.8))', backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="row-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--color-navy)', color: 'var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '15px' }}>
                    {(guest?.name || 'H')[0]}
                  </div>
                  <div>
                    <span className="eyebrow" style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Reserva {entry.id.slice(0, 8)}</span>
                    <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-text)' }}>{guest?.name || 'Huésped no disponible'}</h3>
                  </div>
                </div>
                <StatusBadge>{reservationStatusToLabel(entry.status)}</StatusBadge>
              </div>
              <div style={{ margin: '14px 0', fontSize: '13px', color: 'var(--color-body)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>🛏️ <strong>Habitación:</strong> {room ? `Hab. ${room.number} (${room.category || 'Estándar'})` : 'No asignada'}</div>
                <div>📅 <strong>Fecha Check-in:</strong> {formatReservationInstant(entry.checkInAt)}</div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={!guest || !room || state.stayCommandRequest.status === 'saving'} onClick={() => setReservationId(entry.id)}>
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
            <article className="card operation-card" key={entry.id} style={{ padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(255,255,255,0.8)', background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.8))', backdropFilter: 'blur(20px)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="row-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--color-navy)', color: 'var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '15px', border: '1px solid var(--color-gold-soft)' }}>
                    {room ? room.number : 'Hab'}
                  </div>
                  <div>
                    <span className="eyebrow" style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Estadía Activa</span>
                    <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--color-text)' }}>Habitación {room ? room.number : 'N/A'}</h3>
                  </div>
                </div>
                <StatusBadge>Activa</StatusBadge>
              </div>
              <div style={{ margin: '14px 0', fontSize: '13px', color: 'var(--color-body)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>⏱️ <strong>Ingresó:</strong> {formatReservationInstant(entry.checkInAt)}</div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} disabled={!room || state.stayCommandRequest.status === 'saving'} onClick={() => setStayId(entry.id)}>
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
