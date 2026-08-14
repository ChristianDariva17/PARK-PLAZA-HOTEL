import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus } from 'lucide-react';
import { useAuth, usePermissions } from '../../auth/authContext';
import { PERMISSIONS } from '../../auth/permissions';
import { createAccount, getAccounts, resetAccountPassword, updateAccount } from '../../auth/accountsClient';
import { Dialog } from '../ui/Overlay';
import { DataTable, PageHeader, StatusBadge } from './SharedViewParts';

const EMPTY_DATA = { accounts: [], roles: [], personnel: [] };
const formatDate = (value) => value ? new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Sin fecha';
const personnelName = (person) => person ? `${person.firstName} ${person.lastName}` : 'Sin vínculo';

function AccountForm({ account, data, onClose, onSave }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSaving(true);
    const form = new FormData(event.currentTarget);
    const body = { email: form.get('email'), roleKey: form.get('roleKey'), personnelId: form.get('personnelId') || null };
    if (account) body.status = form.get('status'); else { body.temporaryPassword = form.get('temporaryPassword'); if (!body.personnelId) delete body.personnelId; }
    try { await onSave(body); } catch (requestError) { setError(requestError.message); setSaving(false); }
  };
  const currentPersonnelId = account?.personnel?.id || '';
  const availablePersonnel = data.personnel.filter((item) => !item.accountId || item.id === currentPersonnelId);
  return <form className="form-grid" onSubmit={submit}><label className="span-2">Correo electrónico<input name="email" type="email" defaultValue={account?.email || ''} required disabled={saving} /></label><label>Rol<select name="roleKey" defaultValue={account?.role.key || data.roles[0]?.key || ''} required disabled={saving}>{data.roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select></label>{account ? <label>Estado<select name="status" defaultValue={account.status} disabled={saving}><option value="active">Activa</option><option value="disabled">Deshabilitada</option></select></label> : <label>Contraseña temporal<input name="temporaryPassword" type="password" minLength="12" autoComplete="new-password" required disabled={saving} /></label>}<label className="span-2">Personal vinculado<select name="personnelId" defaultValue={currentPersonnelId} disabled={saving}><option value="">Sin vínculo</option>{availablePersonnel.map((item) => <option key={item.id} value={item.id}>{personnelName(item)}</option>)}</select><small>{data.personnel.length ? 'Sólo se muestran registros reales del backend disponibles para esta propiedad.' : 'No hay personal del backend disponible para vincular.'}</small></label>{error ? <div className="alert-banner alert-banner-danger span-2" role="alert">{error}</div> : null}<div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cuenta'}</button></div></form>;
}

function ResetPasswordForm({ onClose, onReset }) {
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const submit = async (event) => { event.preventDefault(); setSaving(true); setError(''); try { await onReset(new FormData(event.currentTarget).get('temporaryPassword')); } catch (requestError) { setError(requestError.message); setSaving(false); } };
  return <form className="form-grid" onSubmit={submit}><div className="alert-banner alert-banner-warning span-2">La cuenta deberá cambiar esta contraseña en el próximo inicio de sesión y sus sesiones actuales se cerrarán.</div><label className="span-2">Nueva contraseña temporal<input name="temporaryPassword" type="password" minLength="12" autoComplete="new-password" required disabled={saving} /></label>{error ? <div className="alert-banner alert-banner-danger span-2" role="alert">{error}</div> : null}<div className="form-actions span-2"><button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancelar</button><button className="btn btn-danger" disabled={saving}>{saving ? 'Restableciendo…' : 'Restablecer contraseña'}</button></div></form>;
}

export default function AccessAccountsView() {
  const { account: currentAccount } = useAuth(); const { can } = usePermissions(); const canManage = can(PERMISSIONS.accountsManage);
  const [data, setData] = useState(EMPTY_DATA); const [status, setStatus] = useState('loading'); const [error, setError] = useState(''); const [dialog, setDialog] = useState(null);
  const load = async () => { setStatus('loading'); setError(''); try { setData(await getAccounts()); setStatus('ready'); } catch (requestError) { setError(requestError.message); setStatus('error'); } };
  useEffect(() => { let active = true; getAccounts().then((result) => { if (active) { setData(result); setStatus('ready'); } }).catch((requestError) => { if (active) { setError(requestError.message); setStatus('error'); } }); return () => { active = false; }; }, []);
  const save = async (body) => { if (dialog?.account) await updateAccount(dialog.account.id, body); else await createAccount(body); setDialog(null); await load(); };
  const reset = async (password) => { await resetAccountPassword(dialog.account.id, password); setDialog(null); await load(); };
  return <div className="view-container"><PageHeader metadata="Autorización y datos desde backend" title="Cuentas de acceso" description="Credenciales separadas del personal, con rol único y vínculo laboral opcional." actionType="ACCOUNT_CREATE" action={canManage ? <button className="btn btn-primary" onClick={() => setDialog({ type: 'form' })}><Plus size={17} />Crear cuenta</button> : null} />{status === 'loading' ? <section className="card route-loading" role="status">Cargando cuentas…</section> : null}{status === 'error' ? <section className="card"><div className="alert-banner alert-banner-danger" role="alert">{error}</div><button className="btn btn-outline" onClick={load}>Intentar nuevamente</button></section> : null}{status === 'ready' ? <DataTable caption="Cuentas de acceso de la propiedad" columns={['Correo', 'Rol', 'Personal vinculado', 'Estado', 'Contraseña', 'Actualizada', 'Acciones']} emptyTitle="Sin cuentas disponibles" emptyDescription="No hay cuentas de acceso visibles para esta propiedad.">{data.accounts.length ? data.accounts.map((item) => <tr key={item.id}><td>{item.email}</td><td>{item.role.name}</td><td>{personnelName(item.personnel)}</td><td><StatusBadge>{item.status === 'active' ? 'Activa' : 'Deshabilitada'}</StatusBadge></td><td><StatusBadge>{item.passwordChangeRequired ? 'Cambio pendiente' : 'Vigente'}</StatusBadge></td><td>{formatDate(item.updatedAt)}</td><td><div className="account-actions">{canManage ? <><button className="btn btn-sm btn-outline" onClick={() => setDialog({ type: 'form', account: item })}><Pencil size={14} />Editar</button>{item.id !== currentAccount.id ? <button className="btn btn-sm btn-outline" onClick={() => setDialog({ type: 'reset', account: item })}><KeyRound size={14} />Restablecer</button> : null}</> : <span>Sólo lectura</span>}</div></td></tr>) : null}</DataTable> : null}<Dialog open={dialog?.type === 'form'} onClose={() => setDialog(null)} title={dialog?.account ? 'Editar cuenta de acceso' : 'Crear cuenta de acceso'} description="La contraseña temporal nunca se mostrará ni se almacenará en la interfaz." wide>{dialog?.type === 'form' ? <AccountForm account={dialog.account} data={data} onClose={() => setDialog(null)} onSave={save} /> : null}</Dialog><Dialog open={dialog?.type === 'reset'} onClose={() => setDialog(null)} title="Restablecer contraseña" description={dialog?.account?.email}>{dialog?.type === 'reset' ? <ResetPasswordForm onClose={() => setDialog(null)} onReset={reset} /> : null}</Dialog></div>;
}
