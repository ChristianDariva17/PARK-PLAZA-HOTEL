import { useState } from 'react';
import { BiometricPanel } from './BiometricPanel.jsx';
import { staffClient } from '../../staff/staffClient.js';

export function BiometricAttendanceAdapter({ staffId, movement, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleVerify = async (result) => {
    if (!result.matched) {
      return; // Handled by BiometricPanel internally as "no coincide"
    }

    try {
      setLoading(true);
      setError(null);
      
      const payload = {
        staffId,
        deviceId: result.deviceId || 'local-bridge-1', // Provided by bridge or fallback
        bridgeOperationId: result.operationId || crypto.randomUUID(),
        templateReference: result.templateReference,
        movement, // 'Ingreso' or 'Salida'
        occurredAt: new Date().toISOString(),
      };

      await staffClient.reportBiometricAttendance(payload);
      onComplete?.(payload);
    } catch (err) {
      console.error('Error reporting biometric attendance:', err);
      setError('Fallo al registrar asistencia en el servidor. Reintentá.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="biometric-attendance-adapter">
      {error && <div className="alert alert-danger mb-3">{error}</div>}
      <BiometricPanel
        subjectType="employee"
        subjectId={staffId}
        onVerified={handleVerify}
      />
      {loading && <p className="text-muted mt-2">Registrando asistencia en el servidor...</p>}
    </div>
  );
}
