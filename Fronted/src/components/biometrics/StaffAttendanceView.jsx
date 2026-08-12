import { useRef, useState } from 'react';
import { formatMoney } from '../../domain/hotelModel.js';
import { useHotel } from '../../state/hotelContext.js';
import { Dialog, PrototypeNotice, Tabs, TabPanel } from '../ui/Overlay.jsx';
import { DataTable, DetailGrid, MetricStrip, PageHeader, SectionHeader, StatusBadge } from '../views/SharedViewParts.jsx';
import { BiometricPanel } from './BiometricPanel.jsx';

const today = (value = new Date()) => {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};
const createRequestId = () => `ATT-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
const run = (execute, action, notify, title, message) => {
  const result = execute(action);
  notify(result.ok ? title : 'Operación rechazada', result.ok ? message : (result.error || result.message || 'No se pudo completar la operación.'), result.ok ? 'success' : 'error');
  return result.ok;
};

function StaffEditor({ person, onClose, notify }) {
  const { execute } = useHotel();
  const [form, setForm] = useState(person ? { ...person } : { documentNumber: '', name: '', role: '', area: '', phone: '', email: '', salary: 0, shift: '', attendance: 'Pendiente', overtimeHours: 0 });
  const submit = (event) => { event.preventDefault(); const action = person ? { type: 'STAFF_UPDATE', staffId: person.id, payload: form } : { type: 'STAFF_CREATE', payload: form }; if (run(execute, action, notify, person ? 'Personal actualizado' : 'Personal registrado', 'El DNI fue validado entre registros no archivados.')) onClose(); };
  return <form className="form-grid" onSubmit={submit}><label>DNI<input required value={form.documentNumber} onChange={(event) => setForm({ ...form, documentNumber: event.target.value })} /></label><label>Nombre completo<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Cargo<input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} /></label><label>Área<input value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} /></label><label>Teléfono<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Correo<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Sueldo referencial<input type="number" min="0" value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} /></label><label>Turno descriptivo<input value={form.shift} onChange={(event) => setForm({ ...form, shift: event.target.value })} /></label><div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button className="btn btn-primary">Guardar personal</button></div></form>;
}

function ShiftEditor({ shift, onClose, notify }) {
  const { state, execute } = useHotel();
  const activeStaff = state.staff.filter((item) => item.status !== 'Archivado');
  const [form, setForm] = useState(shift ? { ...shift } : { staffId: activeStaff[0]?.id || '', date: today(), startTime: '08:00', endTime: '16:00' });
  const submit = (event) => { event.preventDefault(); const action = shift ? { type: 'SHIFT_UPDATE', shiftId: shift.id, payload: form } : { type: 'SHIFT_CREATE', payload: form }; if (run(execute, action, notify, shift ? 'Turno actualizado' : 'Turno creado', 'El horario fue validado sin solapamientos para la persona.')) onClose(); };
  return <form className="form-grid" onSubmit={submit}><label className="span-2">Persona<select value={form.staffId} onChange={(event) => setForm({ ...form, staffId: event.target.value })}>{activeStaff.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.area}</option>)}</select></label><label>Fecha<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label>Inicio<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label>Fin<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label><button className="btn btn-primary span-2">Guardar turno</button></form>;
}

function ManualAttendance({ person, onClose, notify }) {
  const { state, execute } = useHotel();
  const calendarDate = today();
  const latest = state.attendanceLog.filter((item) => item.staffId === person.id && (item.calendarDate || today(new Date(item.createdAt))) === calendarDate).toSorted((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  const [form, setForm] = useState({ movement: latest?.movement === 'Entrada' ? 'Salida' : 'Entrada', responsible: '', reason: '', observation: '' });
  const [requestId] = useState(createRequestId);
  const submit = (event) => { event.preventDefault(); if (run(execute, { type: 'STAFF_ATTENDANCE_MANUAL', staffId: person.id, requestId, ...form }, notify, 'Asistencia manual registrada', 'La vía manual quedó diferenciada y auditada con responsable y motivo.')) onClose(); };
  return <form className="form-grid" onSubmit={submit}><label>Movimiento<select value={form.movement} onChange={(event) => setForm({ ...form, movement: event.target.value })}><option>Entrada</option><option>Salida</option></select></label><label>Responsable<input required value={form.responsible} onChange={(event) => setForm({ ...form, responsible: event.target.value })} /></label><label className="span-2">Motivo<textarea required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label><label className="span-2">Observación<textarea value={form.observation} onChange={(event) => setForm({ ...form, observation: event.target.value })} /></label><button className="btn btn-primary span-2">Registrar asistencia manual</button></form>;
}

export function StaffAttendanceView({ notify }) {
  const { state, execute } = useHotel();
  const [tab, setTab] = useState('directory');
  const [editor, setEditor] = useState(undefined);
  const [shiftEditor, setShiftEditor] = useState(undefined);
  const [manualId, setManualId] = useState(null);
  const [operation, setOperation] = useState(null);
  const [reason, setReason] = useState('');
  const biometricResults = useRef(new Map());
  const manualPerson = state.staff.find((item) => item.id === manualId);
  const applyOperation = () => {
    if (operation.kind === 'staff') {
      const type = operation.record.status === 'Archivado' ? 'STAFF_REACTIVATE' : 'STAFF_ARCHIVE';
      if (run(execute, { type, staffId: operation.record.id, reason }, notify, type === 'STAFF_ARCHIVE' ? 'Personal archivado' : 'Personal reactivado', 'Turnos y asistencias históricas permanecen intactos.')) setOperation(null);
    } else if (run(execute, { type: 'SHIFT_CANCEL', shiftId: operation.record.id, reason }, notify, 'Turno cancelado', 'El turno permanece visible para auditoría.')) setOperation(null);
  };

  return <div className="view-container">
    <PageHeader metadata="Biometría ZK9500 preservada · vía manual adicional" title="Personal y asistencia" description="Directorio, turnos y asistencia manual auditada sin reemplazar ni debilitar la validación biométrica." action={<button className="btn btn-primary" onClick={() => setEditor(null)}>Registrar personal</button>} />
    <MetricStrip items={[{ label: 'Personal activo', value: state.staff.filter((item) => item.status === 'Activo').length }, { label: 'Archivado', value: state.staff.filter((item) => item.status === 'Archivado').length }, { label: 'Turnos vigentes', value: state.staffShifts.filter((item) => item.status !== 'Cancelado').length }, { label: 'Asistencias manuales', value: state.attendanceLog.filter((item) => item.method === 'Manual').length }, { label: 'Asistencias biométricas', value: state.attendanceLog.filter((item) => item.method === 'Biométrica').length }, { label: 'Nómina referencial', value: formatMoney(state.staff.reduce((sum, item) => sum + item.salary, 0)) }]} />
    <Tabs label="Personal, turnos y asistencias" activeTab={tab} onChange={setTab} tabs={[{ id: 'directory', label: 'Directorio y biometría' }, { id: 'shifts', label: 'Turnos' }, { id: 'attendance', label: 'Historial de asistencia' }]} />
    <TabPanel active={tab === 'directory'} label="Directorio y biometría"><div className="staff-card-grid">{state.staff.map((person) => <article className="card staff-card" key={person.id}><div className="row-between"><div><span className="eyebrow">{person.id} · DNI {person.documentNumber}</span><h3>{person.name}</h3><p>{person.role} · {person.area}</p></div><StatusBadge>{person.status}</StatusBadge></div><DetailGrid compact items={[{ label: 'Turno', value: person.shift }, { label: 'Asistencia', value: person.attendance }, { label: 'Horas extra', value: `${person.overtimeHours} h` }, { label: 'Correo', value: person.email }]} />{person.status !== 'Archivado' ? <BiometricPanel subjectType="employee" subjectId={person.id} subjectName={person.name} reference={person.biometric?.templateReference} onEnrolled={(result) => execute({ type: 'BIOMETRIC_ENROLLED', subjectType: 'employee', subjectId: person.id, ...result })} onVerified={(result) => biometricResults.current.set(person.id, result)} onAttempt={(attempt) => { execute({ type: 'BIOMETRIC_ATTEMPT', subjectId: person.id, ...attempt }); const result = biometricResults.current.get(person.id); if (attempt.kind === 'verify' && attempt.matched && result?.matched) execute({ type: 'STAFF_ATTENDANCE_VERIFIED', staffId: person.id, matched: true, score: result.score, templateReference: result.templateReference, requestId: attempt.operationId }); biometricResults.current.delete(person.id); }} /> : null}<div className="inline-actions">{person.status !== 'Archivado' ? <><button className="btn btn-outline" onClick={() => setEditor(person)}>Editar</button><button className="btn btn-outline" onClick={() => setManualId(person.id)}>Asistencia manual</button></> : null}<button className={person.status === 'Archivado' ? 'btn btn-primary' : 'btn btn-danger'} onClick={() => { setReason(''); setOperation({ kind: 'staff', record: person }); }}>{person.status === 'Archivado' ? 'Reactivar' : 'Archivar'}</button></div></article>)}</div></TabPanel>
    <TabPanel active={tab === 'shifts'} label="Turnos"><SectionHeader title="Turnos programados" action={<button className="btn btn-primary" onClick={() => setShiftEditor(null)}>Crear turno</button>} /><DataTable caption="Turnos con validación de solapamiento" columns={['Turno', 'Persona', 'Fecha', 'Horario', 'Estado', 'Acciones']}>{state.staffShifts.map((shift) => <tr key={shift.id}><td>{shift.id}</td><td>{state.staff.find((item) => item.id === shift.staffId)?.name}</td><td>{shift.date}</td><td>{shift.startTime}-{shift.endTime}</td><td><StatusBadge>{shift.status}</StatusBadge></td><td><div className="inline-actions">{shift.status !== 'Cancelado' ? <><button className="btn btn-outline" onClick={() => setShiftEditor(shift)}>Editar</button><button className="btn btn-danger" onClick={() => { setReason(''); setOperation({ kind: 'shift', record: shift }); }}>Cancelar</button></> : null}</div></td></tr>)}</DataTable></TabPanel>
    <TabPanel active={tab === 'attendance'} label="Historial de asistencia"><DataTable caption="Asistencias biométricas y manuales diferenciadas" columns={['Registro', 'Fecha', 'Persona', 'Movimiento', 'Método', 'Responsable', 'Motivo / observación']}>{state.attendanceLog.map((entry) => <tr key={entry.id}><td>{entry.id}</td><td>{new Date(entry.createdAt).toLocaleString('es-PE')}</td><td>{state.staff.find((item) => item.id === entry.staffId)?.name}</td><td>{entry.movement}</td><td><StatusBadge>{entry.method}</StatusBadge></td><td>{entry.responsible}</td><td>{entry.reason}<br /><small>{entry.observation}</small></td></tr>)}</DataTable></TabPanel>
    <PrototypeNotice>el bridge, el panel biométrico y sus acciones continúan operativos. El frontend conserva el identificador y la referencia opaca reportados por el bridge, pero no constituye una frontera criptográfica; una cancelación, error o huella no coincidente no registra asistencia.</PrototypeNotice>
    <Dialog open={editor !== undefined} onClose={() => setEditor(undefined)} title={editor ? `Editar ${editor.name}` : 'Registrar personal'}><StaffEditor person={editor || null} onClose={() => setEditor(undefined)} notify={notify} /></Dialog>
    <Dialog open={shiftEditor !== undefined} onClose={() => setShiftEditor(undefined)} title={shiftEditor ? `Editar ${shiftEditor.id}` : 'Crear turno'}><ShiftEditor shift={shiftEditor || null} onClose={() => setShiftEditor(undefined)} notify={notify} /></Dialog>
    <Dialog open={Boolean(manualPerson)} onClose={() => setManualId(null)} title={manualPerson ? `Asistencia manual de ${manualPerson.name}` : 'Asistencia manual'}>{manualPerson ? <ManualAttendance person={manualPerson} onClose={() => setManualId(null)} notify={notify} /> : null}</Dialog>
    <Dialog open={Boolean(operation)} onClose={() => setOperation(null)} title={operation?.kind === 'shift' ? 'Cancelar turno' : operation?.record.status === 'Archivado' ? 'Reactivar personal' : 'Archivar personal'} description="El registro histórico no se elimina."><div className="form-grid"><label className="span-2">Motivo<textarea required value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="form-actions span-2"><button className="btn btn-outline" onClick={() => setOperation(null)}>Volver</button><button className="btn btn-danger" disabled={!reason.trim()} onClick={applyOperation}>Confirmar</button></div></div></Dialog>
  </div>;
}
