/* eslint-disable react/only-export-components, react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, reload, sendEmailVerification, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { ApiError, endCustomerSession, exchangeFirebaseToken, getCustomerSession } from './api';
import { auth, googleProvider } from './firebase';
import { disconnectCustomerSocket } from './realtime/customerSocketClient.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const synchronizedUid = useRef(null);
  const pendingSynchronization = useRef(null);
  const loggingOut = useRef(false);

  const synchronize = useCallback((firebaseUser) => {
    const key = firebaseUser?.uid ?? 'backend-session';
    if (synchronizedUid.current === key) return Promise.resolve();
    if (pendingSynchronization.current?.key === key) return pendingSynchronization.current.promise;
    if (synchronizedUid.current && synchronizedUid.current !== key) disconnectCustomerSocket();
    setStatus('loading');
    setError('');
    const promise = (async () => {
      await Promise.resolve();
      try {
        if (firebaseUser && !firebaseUser.emailVerified) {
          setCurrentUser(firebaseUser);
          setCustomer(null);
          synchronizedUid.current = null;
          setStatus('verification-required');
          return;
        }
        const session = firebaseUser
          ? await exchangeFirebaseToken(await firebaseUser.getIdToken())
          : await getCustomerSession();
        setCurrentUser(firebaseUser);
        setCustomer(session.customer);
        synchronizedUid.current = key;
        setStatus('authenticated');
      } catch (requestError) {
        setCurrentUser(null);
        setCustomer(null);
        synchronizedUid.current = null;
        if (!firebaseUser && requestError instanceof ApiError && requestError.status === 401) {
          disconnectCustomerSocket();
          setStatus('anonymous');
          return;
        }
        setError(requestError instanceof Error ? requestError.message : 'Customer session could not be established.');
        setStatus('error');
        throw requestError;
      } finally {
        if (pendingSynchronization.current?.key === key) pendingSynchronization.current = null;
      }
    })();
    pendingSynchronization.current = { key, promise };
    return promise;
  }, []);

  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    if (loggingOut.current) return;
    void synchronize(firebaseUser).catch(() => undefined);
  }), [synchronize]);

  const completeSignIn = async (operation) => {
    disconnectCustomerSocket();
    const credential = await operation;
    await synchronize(credential.user);
    return credential;
  };

  const signup = async (email, password) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    await synchronize(credential.user);
    return credential;
  };
  const login = (email, password) => completeSignIn(signInWithEmailAndPassword(auth, email, password));
  const loginWithGoogle = () => completeSignIn(signInWithPopup(auth, googleProvider));

  const logout = async () => {
    loggingOut.current = true;
    setStatus('loading');
    disconnectCustomerSocket();
    const results = await Promise.allSettled([endCustomerSession(), signOut(auth)]);
    loggingOut.current = false;
    synchronizedUid.current = null;
    pendingSynchronization.current = null;
    setCurrentUser(null);
    setCustomer(null);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) {
      setError('The customer session could not be fully closed.');
      setStatus('error');
      throw failed.reason;
    }
    setError('');
    setStatus('anonymous');
  };

  const retry = async () => {
    if (auth.currentUser) await reload(auth.currentUser);
    synchronizedUid.current = null;
    return synchronize(auth.currentUser);
  };

  return (
    <AuthContext.Provider value={{ currentUser, customer, status, error, signup, login, loginWithGoogle, logout, retry }}>
      {children}
    </AuthContext.Provider>
  );
};
