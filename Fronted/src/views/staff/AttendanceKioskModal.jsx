import { useState, useEffect, useRef } from 'react';
import { Dialog } from '../../components/ui/Overlay.jsx';
import { QrCode, Clock, ShieldCheck, RefreshCw, Maximize2, Minimize2, MapPin, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { staffClient } from '../../staff/staffClient.js';

export function AttendanceKioskModal({ open, onClose }) {
  const [tokenData, setTokenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const canvasRef = useRef(null);
  const modalContainerRef = useRef(null);

  // Digital clock update every second
  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Fetch rotating QR token
  const fetchToken = async () => {
    try {
      setError(null);
      const data = await staffClient.getKioskQr();
      setTokenData(data);
      setTimeLeft(20);
    } catch (err) {
      setError(err?.message || 'No se pudo generar el código QR');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchToken();
    const interval = setInterval(fetchToken, 20000);
    return () => clearInterval(interval);
  }, [open]);

  // Countdown timer for next rotation
  useEffect(() => {
    if (!open || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 1 ? prev - 1 : 20));
    }, 1000);
    return () => clearInterval(timer);
  }, [open, tokenData]);

  // Render QR on canvas
  useEffect(() => {
    if (tokenData?.token && canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        tokenData.token,
        {
          width: 280,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error('Error rendering QR code:', err);
        }
      );
    }
  }, [tokenData]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Kiosco de Asistencia · Hotel Park Plaza"
      description="Código QR rotativo para auto-registro presencial del personal con geocerca GPS."
    >
      <div ref={modalContainerRef} className="attendance-kiosk">
        {/* Encabezado del Reloj y Estado */}
        <div className="attendance-kiosk-header">
          <div className="attendance-kiosk-clock">
            <Clock className="attendance-kiosk-clock-icon" size={20} />
            <strong>
              {currentTime.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </strong>
          </div>
          <div className="attendance-kiosk-header-actions">
            <span className="attendance-kiosk-geofence">
              <ShieldCheck size={14} /> Geocerca 80m Activa
            </span>
            <button
              onClick={toggleFullscreen}
              className="icon-button"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

        {/* Contenedor Central del Código QR */}
        <div className="attendance-kiosk-qr-card">
          {loading ? (
            <div className="attendance-kiosk-qr-state">
              <RefreshCw className="animate-spin attendance-kiosk-muted-icon" size={36} />
            </div>
          ) : error ? (
            <div className="attendance-kiosk-qr-state attendance-kiosk-error-state">
              <span>{error}</span>
              <button className="btn btn-outline" onClick={fetchToken}>
                <RefreshCw size={14} /> Reintentar
              </button>
            </div>
          ) : (
            <canvas ref={canvasRef} className="attendance-kiosk-canvas" />
          )}

          {/* Barra de Progreso de Rotación */}
          <div className="attendance-kiosk-progress">
            <div className="attendance-kiosk-progress-label">
              <span>Rotación de seguridad</span>
              <strong>{timeLeft}s</strong>
            </div>
            <div className="attendance-kiosk-progress-track">
              <div className={`attendance-kiosk-progress-fill attendance-kiosk-progress-${timeLeft} ${timeLeft <= 5 ? 'is-warning' : ''}`} />
            </div>
          </div>
        </div>

        {/* Instrucciones Claras para el Colaborador */}
        <div className="attendance-kiosk-instructions">
          <div className="attendance-kiosk-instruction-title">
            <Sparkles className="attendance-kiosk-sparkle" size={16} />
            <span>Escaneá con tu teléfono en la app</span>
          </div>
          <p>
            El sistema registrará automáticamente tu <strong>Ingreso o Salida</strong> validando que estés físicamente en el hotel. El código cambia cada 20s para máxima seguridad.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
