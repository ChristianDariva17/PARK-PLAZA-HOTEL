import { useEffect, useState } from 'react';
import { changePasswordRequest, getInitialSession, getSession, loginRequest, logoutRequest, resetInitialSession, subscribeUnauthorized } from './authClient.js';
import { AuthStateContext } from './authContext.js';

const INITIAL_STATE = { status: 'checking', account: null, permissions: [], error: null };

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(INITIAL_STATE);
  const [loggingOut, setLoggingOut] = useState(false);

  const applySession = (session) => {
    setAuth(session
      ? { status: 'authenticated', account: session.account, permissions: session.permissions ?? [], passwordChangeRequired: Boolean(session.passwordChangeRequired), error: null }
      : { status: 'anonymous', account: null, permissions: [], passwordChangeRequired: false, error: null });
  };

  const bootstrap = async () => {
    setAuth(INITIAL_STATE);
    try {
      applySession(await getInitialSession());
    } catch (error) {
      setAuth({ status: 'error', account: null, permissions: [], error: error.message });
    }
  };

  useEffect(() => {
    let active = true;
    getInitialSession()
      .then((session) => { if (active) applySession(session); })
      .catch((error) => {
        if (active) setAuth({ status: 'error', account: null, permissions: [], error: error.message });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => subscribeUnauthorized(() => {
    resetInitialSession();
    applySession(null);
  }), []);

  const login = async ({ email, password }) => {
    await loginRequest(email, password);
    const session = await getSession();
    if (!session) throw new Error('No se pudo confirmar la sesión iniciada. Intentá nuevamente.');
    resetInitialSession();
    applySession(session);
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await logoutRequest();
      resetInitialSession();
      applySession(null);
    } finally {
      setLoggingOut(false);
    }
  };

  const retryBootstrap = () => {
    resetInitialSession();
    return bootstrap();
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    await changePasswordRequest(currentPassword, newPassword);
    resetInitialSession();
    applySession(null);
  };

  return <AuthStateContext.Provider value={{ ...auth, loggingOut, login, logout, changePassword, retryBootstrap }}>{children}</AuthStateContext.Provider>;
}
