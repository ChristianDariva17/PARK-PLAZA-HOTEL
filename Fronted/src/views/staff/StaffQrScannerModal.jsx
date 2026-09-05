import { useState, useEffect, useRef } from 'react';
import { Dialog } from '../../components/ui/Overlay.jsx';
import { Camera, MapPin, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, UserCheck, Smartphone } from 'lucide-react';
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
  const [cameraActive, setCameraActive] = useState(false);
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
        setCameraActive(true);
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
            if (!isMounted || scanning) return;
            handleQrScanned(decodedText);
          },
          () => {
            // Ignore scan parse frame misses
          }
        );
      } catch (err) {
        if (isMounted) {
          console.warn('Camera initiation failed:', err);
          setCameraActive(false);
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

  const handleQrScanned = async (qrToken) => {
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
  };

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Selector opcional de Colaborador */}
        {staffList.length > 0 && !successResult ? (
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Colaborador que marca:
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="select"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: '10px',
          backgroundColor: gpsLoading ? '#f1f5f9' : gpsError ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${gpsLoading ? '#cbd5e1' : gpsError ? '#fecaca' : '#bbf7d0'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
            <MapPin size={18} style={{ color: gpsLoading ? '#64748b' : gpsError ? '#ef4444' : '#16a34a' }} />
            {gpsLoading ? (
              <span style={{ color: '#64748b' }}>Sintonizando GPS del teléfono...</span>
            ) : gpsError ? (
              <span style={{ color: '#dc2626', fontWeight: 500 }}>{gpsError}</span>
            ) : (
              <span style={{ color: '#15803d', fontWeight: 600 }}>
                Ubicación detectada (Precisión ±{gpsLocation?.accuracy}m)
              </span>
            )}
          </div>
          {!gpsLoading && !gpsError ? (
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: 600 }}>
              Geocerca OK
            </span>
          ) : null}
        </div>

        {/* Mensaje de Error si la llamada falló */}
        {submitError ? (
          <div className="alert-banner alert-banner-danger" role="alert">
            <AlertCircle size={18} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <strong>No se pudo validar la asistencia</strong>
              <span>{submitError}</span>
              <button
                onClick={handleManualRetry}
                className="btn btn-outline btn-sm"
                style={{ alignSelf: 'flex-start', marginTop: '6px' }}
              >
                <RefreshCw size={14} /> Volver a intentar
              </button>
            </div>
          </div>
        ) : null}

        {/* Pantalla de Éxito al validar */}
        {successResult ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '14px',
            padding: '24px',
            backgroundColor: '#f0fdf4',
            borderRadius: '16px',
            border: '2px solid #86efac'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(34, 197, 94, 0.35)'
            }}>
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px', color: '#14532d', fontSize: '1.35rem' }}>
                ¡{successResult.detectedMovement || successResult.movement} Registrado!
              </h3>
              <p style={{ margin: 0, color: '#166534', fontSize: '0.9rem' }}>
                Validado presencialmente a <strong>{successResult.distanceMeters || 0} metros</strong> del Hotel Park Plaza.
              </p>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              fontSize: '0.85rem',
              fontWeight: 600
            }}>
              <ShieldCheck size={16} /> Método QR + GPS Verificado
            </div>
            <button
              onClick={onClose}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '10px' }}
            >
              Listo
            </button>
          </div>
        ) : (
          /* Cuadro del Escáner de Cámara */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              id={scannerContainerId}
              style={{
                width: '100%',
                maxWidth: '340px',
                minHeight: '280px',
                backgroundColor: '#0f172a',
                borderRadius: '14px',
                overflow: 'hidden',
                position: 'relative'
              }}
            />
            {scanning ? (
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontWeight: 600 }}>
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
