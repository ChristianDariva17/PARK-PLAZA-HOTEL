import { lazy, Suspense } from 'react';
import { useAuth } from './auth/authContext.js';
import LoginView, { SessionCheckingView, SessionErrorView } from './components/auth/LoginView.jsx';
import ChangePasswordView from './components/auth/ChangePasswordView.jsx';

const AuthenticatedHotelShell = lazy(() => import('./app/AuthenticatedHotelShell.jsx'));

export default function App() {
  const auth = useAuth();
  if (auth.status === 'checking') return <SessionCheckingView />;
  if (auth.status === 'error') return <SessionErrorView message={auth.error} onRetry={auth.retryBootstrap} />;
  if (auth.status === 'anonymous') return <LoginView onLogin={auth.login} onGoogleLogin={auth.loginWithGoogle} />;
  if (auth.passwordChangeRequired) return <ChangePasswordView account={auth.account} onChangePassword={auth.changePassword} onLogout={auth.logout} loggingOut={auth.loggingOut} />;
  return <Suspense fallback={<div className="state-panel state-loading" role="status">Cargando panel administrativo...</div>}><AuthenticatedHotelShell /></Suspense>;
}
