import { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';

export default function ChangePasswordView({ account, onChangePassword, onLogout, loggingOut }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const newPassword = form.get('newPassword');
    if (newPassword !== form.get('confirmation')) { setError('La confirmación no coincide con la nueva contraseña.'); return; }
    setSubmitting(true);
    try { await onChangePassword({ currentPassword: form.get('currentPassword'), newPassword }); }
    catch (requestError) { setError(requestError.message || 'No se pudo cambiar la contraseña. Intentá nuevamente.'); }
    finally { setSubmitting(false); }
  };
  return <main className="auth-page"><section className="auth-card" aria-labelledby="change-password-title">
    <div className="auth-brand" aria-hidden="true"><span>P</span></div><p className="auth-eyebrow">Seguridad de la cuenta</p>
    <h1 id="change-password-title">Cambiar contraseña</h1><p className="auth-intro">{account.email} debe establecer una contraseña nueva antes de acceder al sistema. Usá al menos 12 caracteres.</p>
    <form className="auth-form" onSubmit={submit}><label htmlFor="current-password">Contraseña temporal o actual</label><input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required disabled={submitting} />
      <label htmlFor="new-password">Nueva contraseña</label><input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength="12" required disabled={submitting} />
      <label htmlFor="password-confirmation">Confirmar nueva contraseña</label><input id="password-confirmation" name="confirmation" type="password" autoComplete="new-password" minLength="12" required disabled={submitting} />
      {error ? <p className="auth-error" role="alert">{error}</p> : null}<button className="btn btn-primary auth-submit" type="submit" disabled={submitting}><KeyRound size={17} />{submitting ? 'Actualizando…' : 'Cambiar contraseña'}</button>
      <button className="btn btn-outline auth-submit" type="button" onClick={onLogout} disabled={loggingOut || submitting}><LogOut size={17} />{loggingOut ? 'Cerrando…' : 'Cerrar sesión'}</button>
    </form></section></main>;
}
