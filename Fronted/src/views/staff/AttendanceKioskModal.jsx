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
      <div ref={modalContainerRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '10px 0' }}>
        {/* Encabezado del Reloj y Estado */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          padding: '12px 18px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.05) 0%, rgba(30, 41, 59, 0.08) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(15, 23, 42, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} style={{ color: 'var(--color-primary, #1e3a8a)' }} />
            <strong style={{ fontSize: '1.25rem', letterSpacing: '0.5px' }}>
              {currentTime.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              backgroundColor: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0'
            }}>
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
        <div style={{
          position: 'relative',
          padding: '20px',
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
          border: '2px solid rgba(15, 23, 42, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {loading ? (
            <div style={{ width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw className="animate-spin" size={36} style={{ color: '#64748b' }} />
            </div>
          ) : error ? (
            <div style={{ width: 280, height: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', textAlign: 'center', padding: '16px' }}>
              <span style={{ color: '#ef4444', fontWeight: 600 }}>{error}</span>
              <button className="btn btn-outline" onClick={fetchToken}>
                <RefreshCw size={14} /> Reintentar
              </button>
            </div>
          ) : (
            <canvas ref={canvasRef} style={{ borderRadius: '12px' }} />
          )}

          {/* Barra de Progreso de Rotación */}
          <div style={{ width: '100%', marginTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '6px' }}>
              <span>Rotación de seguridad</span>
              <strong>{timeLeft}s</strong>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(timeLeft / 20) * 100}%`,
                backgroundColor: timeLeft <= 5 ? '#f59e0b' : '#3b82f6',
                transition: 'width 1s linear, background-color 0.3s ease'
              }} />
            </div>
          </div>
        </div>

        {/* Instrucciones Claras para el Colaborador */}
        <div style={{
          textAlign: 'center',
          maxWidth: '380px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#1e293b', fontWeight: 600 }}>
            <Sparkles size={16} style={{ color: '#eab308' }} />
            <span>Escaneá con tu teléfono en la app</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
            El sistema registrará automáticamente tu <strong>Ingreso o Salida</strong> validando que estés físicamente en el hotel. El código cambia cada 20s para máxima seguridad.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
