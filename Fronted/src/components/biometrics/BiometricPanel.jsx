import { useEffect, useRef, useState } from 'react';
import { Fingerprint, RefreshCw, X } from 'lucide-react';
import { getBridgeHealth, runBiometricOperation } from '../../integrations/biometrics/zkBridgeClient.js';

const errorMessages = {
  bridge_not_configured: 'La integración local no está configurada en este navegador.',
  bridge_unavailable: 'El bridge local no está disponible. Iniciá el servicio y volvé a consultar.',
  bridge_timeout: 'El bridge no respondió dentro del tiempo esperado.',
  unauthorized: 'El token local no coincide con la configuración del bridge.',
  origin_forbidden: 'Este origen de desarrollo no está autorizado por el bridge.',
  reader_absent: 'No se detectó el lector configurado.',
  reader_unavailable: 'El lector fue desconectado o no está disponible.',
  reader_busy: 'El lector está ocupado con otra operación.',
  sdk_unavailable: 'El SDK x86 de ZKTeco no está disponible para el bridge.',
  template_not_found: 'La persona todavía no tiene una huella enrolada.',
  capture_timeout: 'No se capturó la huella dentro del tiempo permitido.',
  operation_cancelled: 'La operación fue cancelada.',
};

const describeError = (error) => errorMessages[error.code] || 'La operación biométrica no pudo completarse.';

export function BiometricPanel({ subjectType, subjectId, subjectName, reference, onEnrolled, onVerified, onAttempt }) {
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [operation, setOperation] = useState(null);
  const [message, setMessage] = useState('Consultando bridge local...');
  const controllerRef = useRef(null);
  const busy = Boolean(controllerRef.current);

  const checkHealth = async (force = false) => {
    setHealthError(null);
    try {
      const result = await getBridgeHealth({ force });
      setHealth(result);
      setMessage(result.device.connected ? 'Lector disponible para operar.' : 'Bridge activo; lector no disponible.');
    } catch (error) {
      setHealth(null);
      setHealthError(error);
      setMessage(describeError(error));
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    getBridgeHealth({ signal: controller.signal })
      .then((result) => {
        setHealth(result);
        setMessage(result.device.connected ? 'Lector disponible para operar.' : 'Bridge activo; lector no disponible.');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setHealthError(error);
          setMessage(describeError(error));
        }
      });
    return () => {
      controller.abort();
      controllerRef.current?.abort();
    };
  }, []);

  const execute = async (kind) => {
    const controller = new AbortController();
    controllerRef.current = controller;
    setOperation({ kind, status: 'queued', samplesCaptured: 0, samplesRequired: kind === 'enroll' ? 3 : 1 });
    setMessage(kind === 'enroll' ? 'Colocá el mismo dedo tres veces.' : 'Colocá el dedo enrolado en el lector.');
    try {
      const completed = await runBiometricOperation(kind, { subjectType, subjectId }, {
        signal: controller.signal,
        onProgress: (current) => {
          setOperation(current);
          if (kind === 'enroll' && current.status === 'running') setMessage(`Muestras capturadas: ${current.samplesCaptured} de 3.`);
        },
      });
      if (kind === 'enroll') {
        setMessage('Huella enrolada y almacenada localmente por el bridge.');
        onEnrolled?.(completed.result);
        onAttempt?.({ kind, operationId: completed.operationId, result: 'Enrolada', templateReference: completed.result.templateReference });
      } else {
        const matched = Boolean(completed.result.matched);
        setMessage(matched ? 'Identidad biométrica verificada.' : 'La huella no coincide con el registro enrolado.');
        onVerified?.(completed.result);
        onAttempt?.({ kind, operationId: completed.operationId, result: matched ? 'Coincidencia' : 'Sin coincidencia', matched, score: completed.result.score, templateReference: completed.result.templateReference });
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        setMessage(describeError(error));
        onAttempt?.({ kind, result: 'Error', errorCode: error.code });
      }
    } finally {
      controllerRef.current = null;
      setOperation((current) => current ? { ...current, status: 'finished' } : null);
    }
  };

  const connected = Boolean(health?.device.connected);
  return <section className="biometric-panel" aria-label={`Biometría de ${subjectName || subjectId}`}>
    <div className="biometric-panel-heading">
      <span className="biometric-icon"><Fingerprint size={20} aria-hidden="true" /></span>
      <div><strong>Huella digital</strong><small>{reference ? `Referencia local ${reference.slice(0, 8)}...` : 'Sin referencia en esta sesión'}</small></div>
      <span className={`biometric-state ${connected ? 'connected' : 'disconnected'}`}>{connected ? 'Lector listo' : healthError ? 'Bridge no disponible' : 'Lector no disponible'}</span>
    </div>
    <p className="biometric-message" aria-live="polite">{message}</p>
    {operation && operation.kind === 'enroll' && operation.status !== 'finished' ? <progress max="3" value={operation.samplesCaptured || 0}>Muestras {operation.samplesCaptured || 0} de 3</progress> : null}
    <div className="inline-actions">
      <button className="btn btn-sm btn-outline" disabled={busy || !connected || !subjectId} onClick={() => execute('enroll')}>Enrolar huella</button>
      <button className="btn btn-sm btn-primary" disabled={busy || !connected || !subjectId} onClick={() => execute('verify')}>Verificar huella</button>
      {busy ? <button className="btn btn-sm btn-danger" onClick={() => controllerRef.current?.abort()}><X size={15} />Cancelar</button> : <button className="btn btn-sm btn-outline" onClick={() => checkHealth(true)}><RefreshCw size={15} />Consultar lector</button>}
    </div>
    <small>El navegador recibe sólo referencias opacas, metadatos y resultados; nunca imágenes ni templates.</small>
  </section>;
}
