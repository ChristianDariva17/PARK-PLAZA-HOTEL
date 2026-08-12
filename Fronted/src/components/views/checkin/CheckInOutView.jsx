import { useState } from 'react';
import { formatMoney, PAYMENT_METHODS, selectAccountBalance, selectClientName } from '../../../domain/hotelModel';
import { useHotel } from '../../../state/hotelContext';
import { BiometricPanel } from '../../biometrics/BiometricPanel';
import { executeWithFeedback } from '../../ui/actionFeedback';
import { FormWizard } from '../../ui/FormWizard';
import { Dialog, Tabs, TabPanel } from '../../ui/Overlay';
import { DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';

const nowIso = () => new Date().toISOString();

function CheckInFlow({ reservation, onClose, notify }) {
  const { state, execute } = useHotel();
  const client = state.clients.find((item) => item.id === reservation.clientId);
  const contract = state.contracts.find((item) => item.id === reservation.contractId);
  const [method, setMethod] = useState('biometric');
  const [verified, setVerified] = useState(false);
  const [documentary, setDocumentary] = useState({ documentType: client?.documentType || 'DNI', documentNumber: client?.documentNumber || '', result: 'Documento vigente y datos coincidentes', responsible: '', verifiedAt: nowIso() });
  const identityValid = () => method === 'biometric' ? (!verified ? 'Completá una verificación biométrica coincidente.' : '') : (!documentary.responsible.trim() || documentary.documentNumber !== client?.documentNumber ? 'Registrá responsable y documento coincidente.' : '');
  const submit = () => {
    const identityValidation = method === 'biometric' ? { method: 'biometric', matched: verified, verifiedAt: nowIso(), responsible: 'Bridge ZK9500' } : { method: 'documentary', ...documentary, verifiedAt: nowIso() };
    if (executeWithFeedback(execute, { type: 'CHECK_IN', reservationId: reservation.id, identityValidation }, notify, { title: 'Check-in completado', message: `La validación ${method === 'biometric' ? 'biométrica' : 'documental'} y la apertura de estadía se aplicaron atómicamente.` })) onClose();
  };
  const summary = <DetailGrid compact items={[{ label: 'Huésped', value: client?.name }, { label: 'Documento', value: `${client?.documentType} ${client?.documentNumber}` }, { label: 'Reserva', value: reservation.id }, { label: 'Habitación', value: reservation.roomId }, { label: 'Contrato', value: contract?.id, detail: contract?.status }, { label: 'Saldo inicial', value: formatMoney(reservation.balance) }]} />;
  const steps = [
    { label: 'Identidad', title: 'Validación de identidad', validate: identityValid, content: <div className="detail-stack"><label>Vía de validación<select value={method} onChange={(event) => { setMethod(event.target.value); setVerified(false); }}><option value="biometric">Biometría ZK9500</option><option value="documentary">Control documental manual</option></select></label>{method === 'biometric' ? <BiometricPanel subjectType="client" subjectId={client?.id} subjectName={client?.name} reference={client?.biometric?.templateReference} onEnrolled={(result) => execute({ type: 'BIOMETRIC_ENROLLED', subjectType: 'client', subjectId: client.id, ...result })} onVerified={(result) => setVerified(Boolean(result.matched))} onAttempt={(attempt) => execute({ type: 'BIOMETRIC_ATTEMPT', subjectId: client?.id, ...attempt })} /> : <div className="form-grid"><label>Tipo<select value={documentary.documentType} onChange={(event) => setDocumentary({ ...documentary, documentType: event.target.value })}><option>DNI</option><option>Pasaporte</option><option>Carnet de extranjería</option></select></label><label>Número<input value={documentary.documentNumber} onChange={(event) => setDocumentary({ ...documentary, documentNumber: event.target.value })} /></label><label className="span-2">Responsable<input value={documentary.responsible} onChange={(event) => setDocumentary({ ...documentary, responsible: event.target.value })} /></label></div>}</div> },
    { label: 'Reserva', title: 'Reserva y contratación', content: <DetailGrid items={[{ label: 'Fechas', value: `${reservation.checkIn} a ${reservation.checkOut}` }, { label: 'Huéspedes', value: reservation.guests }, { label: 'Servicios', value: reservation.services.join(', ') || 'Sin adicionales' }, { label: 'Contrato', value: contract?.id, detail: contract?.status }]} /> },
    { label: 'Confirmación', title: 'Consecuencias operativas', content: <div className="alert-banner alert-banner-warning">Al confirmar se abrirán estadía y cuenta, y la habitación pasará a ocupada. La operación se anuncia sólo después de ser aceptada.</div> },
  ];
  return <FormWizard steps={steps} summary={summary} onCancel={onClose} onSubmit={submit} submitLabel="Confirmar check-in" />;
}

function CheckOutFlow({ stay, onClose, notify }) {
  const { state, execute } = useHotel();
  const [method, setMethod] = useState('Tarjeta');
  const [operationNumber, setOperationNumber] = useState('');
  const account = state.accounts.find((item) => item.id === stay.accountId);
  const balance = selectAccountBalance(account);
  const submit = () => { if (executeWithFeedback(execute, { type: 'CHECK_OUT', stayId: stay.id, paymentMethod: method, operationNumber }, notify, { title: 'Check-out completado', message: 'Cuenta, accesos, estadía y limpieza se actualizaron atómicamente.' })) onClose(); };
  const summary = <DetailGrid compact items={[{ label: 'Huésped', value: selectClientName(state, stay.clientId) }, { label: 'Estadía', value: stay.id }, { label: 'Habitación', value: stay.roomId }, { label: 'Cuenta', value: account?.id }, { label: 'Saldo', value: formatMoney(balance) }, { label: 'Método', value: method }]} />;
  const steps = [
    { label: 'Cuenta', title: 'Revisión de la cuenta', content: <div className="account-lines">{account?.charges.map((charge) => <span key={charge.id}>{charge.concept}<strong>{formatMoney(charge.amount)}</strong></span>)}<div className="operation-total"><span>Saldo final</span><strong>{formatMoney(balance)}</strong></div></div> },
    { label: 'Liquidación', title: 'Método de liquidación', validate: () => balance > 0 && !operationNumber.trim() ? 'Ingresá la referencia de la liquidación.' : '', content: <div className="form-grid"><label>Método<select value={method} onChange={(event) => setMethod(event.target.value)}>{PAYMENT_METHODS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Referencia<input value={operationNumber} onChange={(event) => setOperationNumber(event.target.value)} /></label></div> },
    { label: 'Confirmación', title: 'Consecuencias operativas', content: <div className="alert-banner alert-banner-warning">Se cerrarán cuenta y estadía, finalizarán los accesos y la habitación pasará a limpieza.</div> },
  ];
  return <FormWizard steps={steps} summary={summary} onCancel={onClose} onSubmit={submit} submitLabel="Confirmar check-out" />;
}

export default function CheckInOutView({ notify }) {
  const { state } = useHotel();
  const [tab, setTab] = useState('checkin');
  const [reservationId, setReservationId] = useState(null);
  const [stayId, setStayId] = useState(null);
  const arrivals = state.reservations.filter((item) => item.status === 'Confirmada');
  const stays = state.stays.filter((item) => item.status === 'Activa');
  const reservation = state.reservations.find((item) => item.id === reservationId);
  const stay = state.stays.find((item) => item.id === stayId);
  return <div className="view-container"><PageHeader metadata="Biometría preservada · alternativa documental" title="Check-in y check-out" description="Flujos guiados con revisión persistente antes de cada operación atómica." /><MetricStrip items={[{ label: 'Llegadas listas', value: arrivals.length }, { label: 'Estadías activas', value: stays.length }, { label: 'Saldos a liquidar', value: formatMoney(stays.reduce((sum, item) => sum + selectAccountBalance(state.accounts.find((account) => account.id === item.accountId)), 0)) }]} /><Tabs label="Operación de recepción" tabs={[{ id: 'checkin', label: `Llegadas (${arrivals.length})` }, { id: 'checkout', label: `Salidas (${stays.length})` }]} activeTab={tab} onChange={setTab} /><TabPanel id="checkin" active={tab === 'checkin'} label="Llegadas confirmadas"><div className="operation-cards">{arrivals.length ? arrivals.map((item) => <article className="card operation-card" key={item.id}><div className="row-between"><div><span className="eyebrow">{item.id}</span><h3>{selectClientName(state, item.clientId)}</h3></div><StatusBadge>{item.status}</StatusBadge></div><p>Habitación {item.roomId} · saldo {formatMoney(item.balance)}</p><button className="btn btn-primary" onClick={() => setReservationId(item.id)}>Iniciar check-in guiado</button></article>) : <EmptyState title="Sin llegadas confirmadas" />}</div></TabPanel><TabPanel id="checkout" active={tab === 'checkout'} label="Estadías activas"><div className="operation-cards">{stays.length ? stays.map((item) => <article className="card operation-card" key={item.id}><div className="row-between"><div><span className="eyebrow">{item.id} · Hab. {item.roomId}</span><h3>{selectClientName(state, item.clientId)}</h3></div><StatusBadge>{item.status}</StatusBadge></div><p>Saldo {formatMoney(selectAccountBalance(state.accounts.find((account) => account.id === item.accountId)))}</p><button className="btn btn-primary" onClick={() => setStayId(item.id)}>Iniciar check-out guiado</button></article>) : <EmptyState title="Sin estadías activas" />}</div></TabPanel><Dialog open={Boolean(reservation)} onClose={() => setReservationId(null)} title="Check-in guiado" description="El borrador se limpia al cerrar el flujo." wide>{reservation ? <CheckInFlow reservation={reservation} onClose={() => setReservationId(null)} notify={notify} /> : null}</Dialog><Dialog open={Boolean(stay)} onClose={() => setStayId(null)} title="Check-out guiado" description="Revisá la cuenta antes de confirmar." wide>{stay ? <CheckOutFlow stay={stay} onClose={() => setStayId(null)} notify={notify} /> : null}</Dialog></div>;
}
