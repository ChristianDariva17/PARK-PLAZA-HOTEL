import { useState, useEffect, useRef, useEffectEvent } from 'react';
import { Dialog } from '../../components/ui/Overlay.jsx';
import { MapPin, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import { staffClient } from '../../staff/staffClient.js';

const createIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.floor(Math.random() * 16);
  return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});

export function StaffQrScannerModal({ open, onClose, staffList = [], onAttendanceSuccess, notify }) {
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);
  const scannerRef = useRef(null);
  const scannerContainerId = 'qr-reader-container';

  // Request GPS location on open
  useEffect(() => {
    if (!open) {
      setSuccessResult(null);
      setSubmitError(null);
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    if (!('geolocation' in navigator)) {
      setGpsError('Tu dispositivo no soporta geolocalización.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? 'Debes permitir el acceso a tu ubicación GPS para verificar tu presencia en el hotel.'
            : 'No se pudo obtener la señal GPS. Intentá nuevamente al aire libre o cerca de una ventana.'
        );
        setGpsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }, [open]);

  // Initialize camera scanner
  useEffect(() => {
    if (!open || successResult || gpsLoading || gpsError) return;

    let html5QrCode = null;
    let isMounted = true;

    const startCamera = async () => {
      try {
        html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          async (decodedText) => {
            if (!isMounted) return;
            handleQrScanned(decodedText);
          },
          () => {
            // Ignore scan parse frame misses
          }
        );
      } catch (err) {
        if (isMounted) {
          console.warn('Camera initiation failed:', err);
        }
      }
    };

    const timer = setTimeout(startCamera, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).then(() => {
          scannerRef.current?.clear();
        });
      }
    };
  }, [open, successResult, gpsLoading, gpsError]);

  const handleQrScanned = useEffectEvent(async (qrToken) => {
    if (scanning) return;
    setScanning(true);
    setSubmitError(null);

    // Stop scanner camera immediately to avoid multiple scans
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
    }

    try {
      if (!gpsLocation) {
        throw new Error('Se requiere ubicación GPS antes de enviar la marcación.');
      }

      const result = await staffClient.reportQrAttendance({
        qrToken,
        staffId: selectedStaffId || undefined,
        latitude: gpsLocation.latitude,
        longitude: gpsLocation.longitude,
        accuracy: gpsLocation.accuracy,
        idempotencyKey: createIdempotencyKey(),
      });

      // Feedback háptico
      try {
        navigator.vibrate?.([100, 50, 100]);
      } catch {}

      // Feedback visual con confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}

      setSuccessResult(result);
      notify?.('Asistencia confirmada', `${result.detectedMovement || 'Marcación'} registrado a ${result.distanceMeters || 0}m del hotel.`, 'success');
      onAttendanceSuccess?.();
    } catch (err) {
      setSubmitError(err?.message || 'Error al procesar la asistencia con el código QR.');
      // Restart camera on error after 2 seconds
      setTimeout(() => {
        setScanning(false);
      }, 1500);
    } finally {
      setScanning(false);
    }
  });

  const handleManualRetry = () => {
    setSuccessResult(null);
    setSubmitError(null);
    setScanning(false);
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Escanear Asistencia · QR + GPS"
      description="Enfocá el código QR proyectado en la pantalla del hotel con tu cámara."
    >
      <div className="staff-qr-modal-stack">
        {/* Selector opcional de Colaborador */}
        {staffList.length > 0 && !successResult ? (
          <div>
            <label className="staff-qr-staff-label">
              Colaborador que marca:
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="select staff-qr-staff-select"
            >
              <option value="">Mi cuenta activa (Autodetectar)</option>
              {staffList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName} {m.role ? `· ${m.role}` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Barra de Estado GPS */}
          <div className={`staff-qr-gps-status ${gpsLoading ? 'is-loading' : gpsError ? 'is-error' : 'is-ok'}`}>
          <div className="staff-qr-gps-content">
            <MapPin size={18} className="staff-qr-gps-icon" />
            {gpsLoading ? (
              <span className="staff-qr-gps-message">Sintonizando GPS del teléfono...</span>
            ) : gpsError ? (
              <span className="staff-qr-gps-message">{gpsError}</span>
            ) : (
              <span className="staff-qr-gps-message">
                Ubicación detectada (Precisión ±{gpsLocation?.accuracy}m)
              </span>
            )}
          </div>
          {!gpsLoading && !gpsError ? (
            <span className="staff-qr-geofence-badge">
              Geocerca OK
            </span>
          ) : null}
        </div>

        {/* Mensaje de Error si la llamada falló */}
        {submitError ? (
          <div className="alert-banner alert-banner-danger" role="alert">
            <AlertCircle size={18} />
            <div className="staff-qr-submit-error-content">
              <strong>No se pudo validar la asistencia</strong>
              <span>{submitError}</span>
              <button
                onClick={handleManualRetry}
                className="btn btn-outline btn-sm staff-qr-retry-button"
              >
                <RefreshCw size={14} /> Volver a intentar
              </button>
            </div>
          </div>
        ) : null}

        {/* Pantalla de Éxito al validar */}
        {successResult ? (
          <div className="staff-qr-success-state is-success">
            <div className="staff-qr-success-icon">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h3 className="staff-qr-success-title">
                ¡{successResult.detectedMovement || successResult.movement} Registrado!
              </h3>
              <p className="staff-qr-success-description">
                Validado presencialmente a <strong>{successResult.distanceMeters || 0} metros</strong> del Hotel Park Plaza.
              </p>
            </div>
            <div className="staff-qr-success-method">
              <ShieldCheck size={16} /> Método QR + GPS Verificado
            </div>
            <button
              onClick={onClose}
              className="btn btn-primary staff-qr-success-button"
            >
              Listo
            </button>
          </div>
        ) : (
          /* Cuadro del Escáner de Cámara */
          <div className="staff-qr-scanner-section">
            <div
              id={scannerContainerId}
              className="staff-qr-scanner-container"
            />
            {scanning ? (
              <div className="staff-qr-scanning-status">
                <RefreshCw className="animate-spin" size={18} />
                <span>Verificando ubicación y token con el servidor...</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Dialog>
  );
}
