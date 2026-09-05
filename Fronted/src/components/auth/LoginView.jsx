import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import GoogleSignInButton from './GoogleSignInButton.jsx';

export default function LoginView({ onLogin, onGoogleLogin }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    try {
      await onLogin({ email: form.get('email'), password: form.get('password') });
    } catch (requestError) {
      setError(requestError.message || 'No se pudo iniciar sesión. Intentá nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setError('');
    setSubmitting(true);
    try {
      const result = await onGoogleLogin(credential);
      if (result?.status === 'pending') setError(result.message);
    } catch (requestError) {
      setError(requestError.message || 'No se pudo iniciar sesión con Google. Intentá nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-card" aria-labelledby="login-title">
      <div className="auth-brand" aria-hidden="true"><span>P</span></div>
      <p className="auth-eyebrow">Hotel Park Plaza</p>
      <h1 id="login-title">Iniciar sesión</h1>
      <p className="auth-intro">Ingresá con tu cuenta para acceder al sistema de gestión.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="login-email">Correo electrónico</label>
        <input id="login-email" name="email" type="email" autoComplete="username" required disabled={submitting} />
        <label htmlFor="login-password">Contraseña</label>
        <input id="login-password" name="password" type="password" autoComplete="current-password" required disabled={submitting} />
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <button className="btn btn-primary auth-submit" type="submit" disabled={submitting}>
          <KeyRound size={17} aria-hidden="true" />
          {submitting ? 'Verificando…' : 'Ingresar'}
        </button>
      </form>
      <div className="auth-divider" aria-hidden="true">o</div>
      <GoogleSignInButton disabled={submitting} onCredential={handleGoogleCredential} onError={(requestError) => setError(requestError.message)} />
      <p className="auth-intro">Si todavía no tenés acceso, tu cuenta Google quedará pendiente de aprobación administrativa.</p>
    </section>
  </main>;
}

export function SessionCheckingView() {
  return <main className="auth-page"><div className="auth-status" role="status" aria-live="polite"><span className="auth-spinner" />Verificando sesión…</div></main>;
}

export function SessionErrorView({ message, onRetry }) {
  return <main className="auth-page"><section className="auth-card auth-status-card" aria-labelledby="session-error-title"><h1 id="session-error-title">No se pudo verificar la sesión</h1><p role="alert">{message || 'No se pudo conectar con el servidor.'}</p><button className="btn btn-primary" type="button" onClick={onRetry}>Intentar nuevamente</button></section></main>;
}
