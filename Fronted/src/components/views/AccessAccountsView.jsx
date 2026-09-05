import { useEffect, useState } from 'react';
import { Check, KeyRound, Pencil, Plus, X } from 'lucide-react';
import { useAuth, usePermissions } from '../../auth/authContext';
import { approveGoogleRequest, createAccount, getAccounts, rejectGoogleRequest, resetAccountPassword, updateAccount } from '../../auth/accountsClient';
import { PERMISSIONS } from '../../auth/permissions';
import { Dialog } from '../ui/Overlay';
import { DataTable, PageHeader, StatusBadge } from './SharedViewParts';

const EMPTY_DATA = { accounts: [], googleRequests: [], roles: [], personnel: [] };
const formatDate = (value) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha';
const personnelName = (person) => person ? `${person.firstName} ${person.lastName}` : 'Sin vínculo';

function PersonnelSelect({ data, currentPersonnelId = '', saving }) {
  const available = data.personnel.filter((item) => !item.accountId || item.id === currentPersonnelId);
  return <label className="span-2">Personal vinculado
    <select name="personnelId" defaultValue={currentPersonnelId} disabled={saving}>
      <option value="">Sin vínculo</option>
      {available.map((item) => <option key={item.id} value={item.id}>{personnelName(item)}</option>)}
    </select>
    <small>{data.personnel.length ? 'Sólo se muestran registros disponibles para esta propiedad.' : 'No hay personal disponible para vincular.'}</small>
  </label>;
}

function AccountForm({ account, data, onClose, onSave }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const body = { email: form.get('email'), roleKey: form.get('roleKey'), personnelId: form.get('personnelId') || null };
    if (account) body.status = form.get('status');
    else {
      body.temporaryPassword = form.get('temporaryPassword');
      if (!body.personnelId) delete body.personnelId;
    }
    try { await onSave(body); } catch (requestError) { setError(requestError.message); setSaving(false); }
  };
  return <form className="form-grid" onSubmit={submit}>
    <label className="span-2">Correo electrónico<input name="email" type="email" defaultValue={account?.email || ''} required disabled={saving} /></label>
    <label>Rol<select name="roleKey" defaultValue={account?.role.key || data.roles[0]?.key || ''} required disabled={saving}>{data.roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select></label>
    {account ? <label>Estado<select name="status" defaultValue={account.status} disabled={saving}><option value="active">Activa</option><option value="disabled">Deshabilitada</option></select></label> : <label>Contraseña temporal<input name="temporaryPassword" type="password" minLength="12" autoComplete="new-password" required disabled={saving} /></label>}
    <PersonnelSelect data={data} currentPersonnelId={account?.personnel?.id || ''} saving={saving} />
    {error ? <div className="alert-banner alert-banner-danger span-2" role="alert">{error}</div> : null}
    <div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cuenta'}</button></div>
  </form>;
}

function ApproveGoogleRequestForm({ request, data, onClose, onApprove }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    const form = new FormData(event.currentTarget);
    try { await onApprove({ roleKey: form.get('roleKey'), personnelId: form.get('personnelId') || undefined }); }
    catch (requestError) { setError(requestError.message); setSaving(false); }
  };
  return <form className="form-grid" onSubmit={submit}>
    <div className="alert-banner alert-banner-warning span-2">Se creará una cuenta activa sin contraseña, vinculada exclusivamente a Google.</div>
    <label className="span-2">Cuenta Google<input value={request.email} readOnly /></label>
    <label>Rol<select name="roleKey" defaultValue={data.roles[0]?.key || ''} required disabled={saving}>{data.roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select></label>
    <div />
    <PersonnelSelect data={data} saving={saving} />
    {error ? <div className="alert-banner alert-banner-danger span-2" role="alert">{error}</div> : null}
    <div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Aprobando…' : 'Aprobar acceso'}</button></div>
  </form>;
}

function ResetPasswordForm({ onClose, onReset }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await onReset(new FormData(event.currentTarget).get('temporaryPassword')); }
    catch (requestError) { setError(requestError.message); setSaving(false); }
  };
  return <form className="form-grid" onSubmit={submit}>
    <div className="alert-banner alert-banner-warning span-2">La cuenta deberá cambiar esta contraseña en el próximo inicio de sesión y sus sesiones actuales se cerrarán.</div>
    <label className="span-2">Nueva contraseña temporal<input name="temporaryPassword" type="password" minLength="12" autoComplete="new-password" required disabled={saving} /></label>
    {error ? <div className="alert-banner alert-banner-danger span-2" role="alert">{error}</div> : null}
    <div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn-danger" disabled={saving}>{saving ? 'Restableciendo…' : 'Restablecer contraseña'}</button></div>
  </form>;
}

export default function AccessAccountsView() {
  const { account: currentAccount } = useAuth();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.accountsManage);
  const [data, setData] = useState(EMPTY_DATA);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const load = async () => {
    setStatus('loading'); setError('');
    try { setData(await getAccounts()); setStatus('ready'); }
    catch (requestError) { setError(requestError.message); setStatus('error'); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (body) => { if (dialog?.account) await updateAccount(dialog.account.id, body); else await createAccount(body); setDialog(null); await load(); };
  const reset = async (password) => { await resetAccountPassword(dialog.account.id, password); setDialog(null); await load(); };
  const approve = async (body) => { await approveGoogleRequest(dialog.request.id, body); setDialog(null); await load(); };
  const reject = async (request) => { await rejectGoogleRequest(request.id); await load(); };

  return <div className="view-container">
    <PageHeader metadata="Autorización y datos desde backend" title="Cuentas de acceso" description="Cuentas autorizadas, roles y solicitudes de ingreso con Google." actionType="ACCOUNT_CREATE" action={canManage ? <button className="btn btn-primary" onClick={() => setDialog({ type: 'form' })}><Plus size={17} />Crear cuenta</button> : null} />
    {status === 'loading' ? <section className="card route-loading" role="status">Cargando cuentas…</section> : null}
    {status === 'error' ? <section className="card"><div className="alert-banner alert-banner-danger" role="alert">{error}</div><button className="btn btn-outline" onClick={load}>Intentar nuevamente</button></section> : null}
    {status === 'ready' ? <>
      <DataTable caption="Cuentas de acceso de la propiedad" columns={['Correo', 'Acceso', 'Rol', 'Personal vinculado', 'Estado', 'Actualizada', 'Acciones']} emptyTitle="Sin cuentas disponibles" emptyDescription="No hay cuentas de acceso visibles para esta propiedad.">
        {data.accounts.map((item) => <tr key={item.id}><td>{item.email}</td><td><StatusBadge>{item.googleEmail ? item.hasPassword ? 'Google y contraseña' : 'Google' : 'Contraseña'}</StatusBadge></td><td>{item.role.name}</td><td>{personnelName(item.personnel)}</td><td><StatusBadge>{item.status === 'active' ? 'Activa' : 'Deshabilitada'}</StatusBadge></td><td>{formatDate(item.updatedAt)}</td><td><div className="account-actions">{canManage ? <><button className="btn btn-sm btn-outline" onClick={() => setDialog({ type: 'form', account: item })}><Pencil size={14} />Editar</button>{item.id !== currentAccount.id && item.hasPassword ? <button className="btn btn-sm btn-outline" onClick={() => setDialog({ type: 'reset', account: item })}><KeyRound size={14} />Restablecer</button> : null}</> : <span>Sólo lectura</span>}</div></td></tr>)}
      </DataTable>
      <DataTable caption="Solicitudes Google pendientes" columns={['Cuenta Google', 'Nombre', 'Solicitada', 'Acciones']} emptyTitle="Sin solicitudes pendientes" emptyDescription="Las cuentas Google que se registren aparecerán aquí para su configuración.">
        {data.googleRequests.map((request) => <tr key={request.id}><td>{request.email}</td><td>{request.displayName || 'Sin nombre'}</td><td>{formatDate(request.requestedAt)}</td><td><div className="account-actions">{canManage ? <><button className="btn btn-sm btn-primary" onClick={() => setDialog({ type: 'approve', request })}><Check size={14} />Configurar</button><button className="btn btn-sm btn-outline" onClick={() => void reject(request)}><X size={14} />Rechazar</button></> : <span>Sólo lectura</span>}</div></td></tr>)}
      </DataTable>
    </> : null}
    <Dialog open={dialog?.type === 'form'} onClose={() => setDialog(null)} title={dialog?.account ? 'Editar cuenta de acceso' : 'Crear cuenta de acceso'}><AccountForm account={dialog?.account} data={data} onClose={() => setDialog(null)} onSave={save} /></Dialog>
    <Dialog open={dialog?.type === 'approve'} onClose={() => setDialog(null)} title="Configurar acceso con Google"><ApproveGoogleRequestForm request={dialog?.request} data={data} onClose={() => setDialog(null)} onApprove={approve} /></Dialog>
    <Dialog open={dialog?.type === 'reset'} onClose={() => setDialog(null)} title="Restablecer contraseña"><ResetPasswordForm onClose={() => setDialog(null)} onReset={reset} /></Dialog>
  </div>;
}
