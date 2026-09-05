import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { authRequest } from '../../auth/authClient.js';

let googleScript;

function loadGoogleScript() {
  if (globalThis.google?.accounts?.id) return Promise.resolve();
  if (!googleScript) {
    googleScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('No se pudo cargar el inicio de sesión de Google.'));
      document.head.append(script);
    });
  }
  return googleScript;
}

export default function GoogleSignInButton({ disabled, onCredential, onError }) {
  const button = useRef(null);
  const [state, setState] = useState('loading');
  const handleCredential = useEffectEvent(async (response) => {
    try {
      await onCredential(response.credential);
    } catch (error) {
      onError(error);
    }
  });

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setState('unavailable');
      return undefined;
    }
    let active = true;
    Promise.all([loadGoogleScript(), authRequest('/api/auth/google/challenge', { signalUnauthorized: false })]).then(([, challenge]) => {
      if (!active) return;
      globalThis.google.accounts.id.initialize({ client_id: clientId, callback: handleCredential, nonce: challenge.nonce, ux_mode: 'popup', auto_select: false });
      globalThis.google.accounts.id.renderButton(button.current, { theme: 'outline', size: 'large', text: 'continue_with', width: 320, locale: 'es' });
      setState('ready');
    }).catch((error) => {
      if (active) {
        setState('error');
        onError(error);
      }
    });
    return () => { active = false; };
  }, []);

  if (state === 'unavailable') return null;
  return <div className="auth-google" aria-busy={state === 'loading'} aria-disabled={disabled || undefined} style={disabled ? { pointerEvents: 'none', opacity: 0.6 } : undefined} ref={button} />;
}
