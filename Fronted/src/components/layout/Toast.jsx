import { CheckCircle2, AlertTriangle, Info, X, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function Toast({ toasts = [], removeToast }) {
  if (!toasts || toasts.length === 0) return null;

  return createPortal(
    <div className="toast-container" role="region" aria-label="Notificaciones de la aplicación">
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';
        const isInfo = toast.type === 'info';
        return (
          <div
            key={toast.id}
            className={`toast-card toast-${toast.type || 'success'}`}
            role={isError ? 'alert' : 'status'}
            aria-atomic="true"
          >
            <div className="toast-status-bar" aria-hidden="true"></div>

            <div className="toast-icon-wrapper" aria-hidden="true">
              {isError ? (
                <AlertTriangle size={18} className="toast-icon" />
              ) : isWarning ? (
                <AlertTriangle size={18} className="toast-icon" />
              ) : isInfo ? (
                <Info size={18} className="toast-icon" />
              ) : (
                <CheckCircle2 size={18} className="toast-icon" />
              )}
            </div>

            <div className="toast-body">
              <div className="toast-header-row">
                <span className="toast-badge-tag">
                  <Sparkles size={10} /> PARK PLAZA 5★
                </span>
                <span className="toast-time">Ahora</span>
              </div>
              <div className="toast-title">{toast.title}</div>
              {toast.message && (
                <div className="toast-message">{toast.message}</div>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="toast-close-btn"
              title="Cerrar notificación"
              aria-label={`Cerrar notificación: ${toast.title}`}
            >
              <X size={15} />
            </button>

            <div className="toast-progress-bar" aria-hidden="true">
              <div className="toast-progress-fill"></div>
            </div>
          </div>
        );
      })}
    </div>, document.body
  );
}
