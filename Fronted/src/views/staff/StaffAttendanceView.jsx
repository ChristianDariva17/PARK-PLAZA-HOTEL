import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Fingerprint, LogIn, LogOut, RefreshCw, ShieldCheck, Users, QrCode, Smartphone, MapPin } from 'lucide-react';
import { useStaffResource } from '../../hooks/useStaffResource.js';
import { BiometricAttendanceAdapter } from '../../components/biometrics/BiometricAttendanceAdapter.jsx';
import { AttendanceKioskModal } from './AttendanceKioskModal.jsx';
import { StaffQrScannerModal } from './StaffQrScannerModal.jsx';
import { DataTable, EmptyState, MetricStrip, PageHeader, SectionHeader, StatusBadge } from '../../components/views/SharedViewParts.jsx';
import { PermissionButton } from '../../components/auth/PermissionButton.jsx';
import { staffClient } from '../../staff/staffClient.js';

const dateTimeFormatter = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
const createIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
  const random = Math.floor(Math.random() * 16);
  const value = character === 'x' ? random : (random & 0x3) | 0x8;
  return value.toString(16);
});

const formatDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateTimeFormatter.format(date);
};

const getStaffName = (member) => member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Personal sin nombre' : 'Personal no encontrado';

export function StaffAttendanceView() {
  const { data, status, error, reload } = useStaffResource();
  const { staff, attendance } = data;
  const [selectedStaff, setSelectedStaff] = useState('');
  const [movement, setMovement] = useState('Ingreso');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMessage, setManualMessage] = useState(null);
  const [kioskOpen, setKioskOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const activeStaff = useMemo(() => staff.filter((member) => member.status !== 'Archivado'), [staff]);
  const staffById = useMemo(() => new Map(staff.map((member) => [member.id, member])), [staff]);
  const recentAttendance = useMemo(() => [...attendance].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, 10), [attendance]);
  const todayAttendance = useMemo(() => {
    const today = new Date().toDateString();
    return attendance.filter((event) => new Date(event.occurredAt).toDateString() === today);
  }, [attendance]);

  const handleManualAttendance = async (nextMovement = movement) => {
    if (!selectedStaff) return;
    try {
      setManualLoading(true);
      setManualMessage(null);
      await staffClient.reportManualAttendance({
        staffId: selectedStaff,
        movement: nextMovement,
        occurredAt: new Date().toISOString(),
        reason: 'Marcación manual',
        idempotencyKey: createIdempotencyKey(),
      });
      setManualMessage({ type: 'success', text: `${nextMovement} registrado correctamente.` });
      await reload();
    } catch (requestError) {
      setManualMessage({ type: 'error', text: requestError?.message || 'No se pudo registrar la marcación manual.' });
    } finally {
      setManualLoading(false);
    }
  };

  if (status === 'forbidden') return <div className="view-container"><div className="alert-banner alert-banner-danger">No tenés permiso para consultar o registrar asistencia.</div></div>;
  if (status === 'loading' || status === 'idle') return <div className="view-container"><div className="route-loading" role="status">Cargando asistencia...</div></div>;
  if (status === 'failed') return <div className="view-container"><div className="alert-banner alert-banner-danger"><strong>No se pudo cargar asistencia</strong><span>{error?.message || 'Verificá la conexión con el backend.'}</span><button className="btn btn-outline" onClick={reload}><RefreshCw size={15} /> Reintentar</button></div></div>;

  return (
    <div className="view-container attendance-view">
      <PageHeader metadata="Control operativo · registro auditable" title="Asistencia y turnos" description="Marcaciones biométricas y manuales vinculadas al personal de esta propiedad." />

      {/* Barra de Acciones Principales QR & GPS */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid rgba(15, 23, 42, 0.08)',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <strong style={{ fontSize: '1rem', color: '#0f172a' }}>Auto-registro con Geocerca & QR Rotativo</strong>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Los colaboradores pueden escanear el QR desde su celular validando su presencia física en el hotel.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setScannerOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Smartphone size={16} /> Marcar mi asistencia (QR + GPS)
          </button>
          <button className="btn btn-outline" onClick={() => setKioskOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <QrCode size={16} /> Pantalla de Kiosco QR
          </button>
        </div>
      </div>

      <MetricStrip label="Resumen de asistencia" items={[
        { label: 'Personal activo', value: activeStaff.length, detail: 'Disponible para marcar' },
        { label: 'Registros de hoy', value: todayAttendance.length, detail: 'Ingreso y salida' },
        { label: 'Ingresos hoy', value: todayAttendance.filter((event) => event.movement === 'Ingreso').length },
        { label: 'Salidas hoy', value: todayAttendance.filter((event) => event.movement === 'Salida').length },
      ]} />

      <div className="attendance-layout">
        <div className="attendance-workspace">
          <section className="card attendance-action-card">
            <SectionHeader eyebrow="Paso 1 · Identificación" title="Seleccioná el personal" description="Elegí a la persona y el tipo de movimiento antes de iniciar la validación." />
            <div className="attendance-fields">
              <label>Empleado<select value={selectedStaff} onChange={(event) => { setSelectedStaff(event.target.value); setManualMessage(null); }}><option value="">Seleccionar empleado...</option>{activeStaff.map((member) => <option key={member.id} value={member.id}>{getStaffName(member)} · {member.role || 'Sin cargo'}</option>)}</select></label>
              <label>Movimiento<select value={movement} onChange={(event) => setMovement(event.target.value)}><option value="Ingreso">Ingreso</option><option value="Salida">Salida</option></select></label>
            </div>
            <div className={`attendance-selected ${selectedStaff ? '' : 'attendance-selected-empty'}`}>
              {selectedStaff ? <><span className="attendance-avatar"><Users size={19} /></span><div><strong>{getStaffName(staffById.get(selectedStaff))}</strong><small>{staffById.get(selectedStaff)?.role || 'Personal operativo'} · Listo para registrar</small></div><StatusBadge>Activo</StatusBadge></> : <><span className="attendance-avatar muted"><Users size={19} /></span><div><strong>Ningún empleado seleccionado</strong><small>La selección es necesaria para continuar.</small></div></>}
            </div>
          </section>

          <section className="card attendance-manual-card">
            <div className="attendance-method-heading"><span className="attendance-method-icon manual"><CheckCircle2 size={21} /></span><div><span className="section-kicker">Paso 2 · Método principal</span><h3>Marcación manual</h3></div><span className="method-label">Operativo</span></div>
            <p className="attendance-method-copy">Registrá el ingreso o la salida directamente. La operación queda auditada con motivo y clave de idempotencia.</p>
            <div className="attendance-manual-actions">
              <PermissionButton actionType="STAFF_ATTENDANCE_MANUAL" className="btn btn-primary" onClick={() => handleManualAttendance('Ingreso')} disabled={!selectedStaff || manualLoading}>{manualLoading ? 'Registrando...' : 'Registrar ingreso'}</PermissionButton>
              <PermissionButton actionType="STAFF_ATTENDANCE_MANUAL" className="btn btn-outline" onClick={() => handleManualAttendance('Salida')} disabled={!selectedStaff || manualLoading}>{manualLoading ? 'Registrando...' : 'Registrar salida'}</PermissionButton>
            </div>
            {manualMessage ? <div className={`attendance-feedback ${manualMessage.type}`} role="status">{manualMessage.text}</div> : null}
          </section>

          <section className="card attendance-method-card">
            <div className="attendance-method-heading"><span className="attendance-method-icon biometric"><Fingerprint size={21} /></span><div><span className="section-kicker">Método alternativo</span><h3>Validación biométrica</h3></div><span className="method-label"><ShieldCheck size={14} /> Auditado</span></div>
            <p className="attendance-method-copy">Usá el lector enrolado cuando esté disponible. El backend valida dispositivo, huella, propiedad y vinculación del empleado.</p>
            {selectedStaff ? <BiometricAttendanceAdapter staffId={selectedStaff} movement={movement} onComplete={async () => { setManualMessage({ type: 'success', text: `${movement} biométrico registrado correctamente.` }); await reload(); }} /> : <div className="attendance-empty-prompt"><Fingerprint size={22} /><span>Seleccioná un empleado para habilitar el lector biométrico.</span></div>}
          </section>
        </div>

        <section className="card attendance-history-card">
          <SectionHeader eyebrow="Trazabilidad" title="Últimos registros" description="Los eventos provienen de `/api/attendance/events`." action={<button className="icon-button" title="Actualizar registros" onClick={reload}><RefreshCw size={16} /></button>} />
          {recentAttendance.length ? <DataTable caption="Últimas marcaciones de asistencia" columns={['Personal', 'Fecha y hora', 'Movimiento', 'Método', 'Estado']}>
            {recentAttendance.map((event) => <tr key={event.id}><td><strong>{getStaffName(staffById.get(event.staffId))}</strong><small>{event.staffId.slice(0, 8)}...</small></td><td>{formatDateTime(event.occurredAt)}</td><td><span className={`attendance-movement ${event.movement === 'Ingreso' ? 'entry' : 'exit'}`}>{event.movement === 'Ingreso' ? <LogIn size={14} /> : <LogOut size={14} />}{event.movement}</span></td><td>{event.method === 'QR_GPS' ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#0369a1' }}><MapPin size={13} style={{ color: '#0284c7' }} /> QR + GPS {event.metadata?.distanceMeters != null ? <small style={{ color: '#64748b', fontWeight: 'normal' }}>({event.metadata.distanceMeters}m)</small> : null}</span> : event.method}</td><td><StatusBadge>{event.status}</StatusBadge></td></tr>)}
          </DataTable> : <EmptyState title="Sin marcaciones recientes" description="Las nuevas asistencias aparecerán aquí después de ser confirmadas por el backend." />}
        </section>
      </div>

      <AttendanceKioskModal open={kioskOpen} onClose={() => setKioskOpen(false)} />
      <StaffQrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        staffList={activeStaff}
        onAttendanceSuccess={reload}
      />
    </div>
  );
}
