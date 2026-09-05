import React, { useState } from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { formatMoney, formatDateTime } from '../domain/hotelModel.js';
import { Car, Clock, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

function calculateDuration(entryAt) {
  if (!entryAt) return 'No registrado';
  const diffMs = Math.max(0, Date.now() - new Date(entryAt).getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days} d ${remHours} h`;
  }
  return `${hours} h ${minutes} min`;
}

export function ParkingExitModal({
  open,
  onClose,
  vehicle,
  onConfirm,
  currentUser = '',
}) {
  const [responsible, setResponsible] = useState(currentUser || 'Recepción');
  const [observation, setObservation] = useState('Salida confirmada sin novedades');
  const [inspectionOk, setInspectionOk] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!open || !vehicle) return null;

  const duration = calculateDuration(vehicle.entryAt);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fullObservation = inspectionOk
        ? observation
        : `[Inspección pendiente o con observaciones] ${observation}`;
      await onConfirm({
        responsible: responsible.trim() || 'Recepción',
        observation: fullObservation.trim(),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Registrar Salida: ${vehicle.plate}`}
      description="Verifique los datos de permanencia y registre la auditoría de salida."
    >
      <form onSubmit={handleSubmit} className="form-grid">
        {/* Resumen Operativo del Vehículo */}
        <div
          className="span-2 card"
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: 'var(--color-surface-subtle, #f8fafc)',
            border: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted, #64748b)', textTransform: 'uppercase' }}>
                Vehículo & Espacio
              </span>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                {vehicle.plate} · <span style={{ fontWeight: 600 }}>{vehicle.brandModel || vehicle.type}</span>
              </div>
            </div>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-border, #e2e8f0)',
                color: 'var(--color-text, #0f172a)',
              }}
            >
              Espacio {vehicle.space}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              paddingTop: '10px',
              borderTop: '1px dashed var(--color-border, #e2e8f0)',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted, #64748b)' }}>Ingreso</div>
              <strong style={{ fontSize: '12px' }}>{formatDateTime(vehicle.entryAt)}</strong>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted, #64748b)' }}>Permanencia</div>
              <strong style={{ fontSize: '12px', color: '#0284c7' }}>⏱️ {duration}</strong>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted, #64748b)' }}>Tarifa / Folio</div>
              <strong style={{ fontSize: '12px', color: '#16a34a' }}>{formatMoney(vehicle.fee)}</strong>
            </div>
          </div>
          {vehicle.driverName || vehicle.driverPhone ? (
            <div style={{ fontSize: '12px', color: 'var(--color-muted, #64748b)', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
              👤 Conductor: <strong style={{ color: 'var(--color-text, #0f172a)' }}>{vehicle.driverName || 'Huésped'}</strong>
              {vehicle.driverPhone ? ` · 📞 ${vehicle.driverPhone}` : ''}
            </div>
          ) : null}
          {vehicle.keysLeft ? (
            <div style={{ padding: '8px 12px', borderRadius: '6px', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '12px', fontWeight: 600 }}>
              🔑 Llaves en custodia: Entregar las llaves físicas al conductor antes de la salida.
            </div>
          ) : null}
        </div>

        {/* Input Responsable */}
        <label className="span-2">
          Personal responsable de la entrega
          <input
            required
            type="text"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            placeholder="Nombre o cargo de quien autoriza la salida"
          />
        </label>

        {/* Checkbox de Inspección */}
        <div className="span-2" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
          <input
            type="checkbox"
            id="inspection-check"
            checked={inspectionOk}
            onChange={(e) => setInspectionOk(e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          <label htmlFor="inspection-check" style={{ fontSize: '13px', cursor: 'pointer', margin: 0 }}>
            Revisión física conforme / Llaves entregadas al huésped
          </label>
        </div>

        {/* Observaciones de Salida */}
        <label className="span-2">
          Observaciones de salida
          <textarea
            rows={2}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Novedades, devolución de llaves o condiciones del retiro..."
          />
        </label>

        {/* Acciones */}
        <div className="form-actions span-2">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Registrando salida…' : 'Confirmar salida y liberar espacio'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
