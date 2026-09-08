import React, { useState } from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { formatMoney, formatDateTime } from '../domain/hotelModel.js';

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
          className="span-2 card parking-exit-summary"
        >
          <div className="parking-exit-header">
            <div>
              <span className="parking-exit-kicker">
                Vehículo & Espacio
              </span>
              <div className="parking-exit-vehicle-title">
                {vehicle.plate} · <span className="parking-exit-model">{vehicle.brandModel || vehicle.type}</span>
              </div>
            </div>
            <span
              className="parking-exit-space"
            >
              Espacio {vehicle.space}
            </span>
          </div>

          <div
            className="parking-exit-metrics"
          >
            <div>
              <div className="parking-exit-label">Ingreso</div>
              <strong className="parking-exit-value">{formatDateTime(vehicle.entryAt)}</strong>
            </div>
            <div>
              <div className="parking-exit-label">Permanencia</div>
              <strong className="parking-exit-value parking-exit-duration">⏱️ {duration}</strong>
            </div>
            <div>
              <div className="parking-exit-label">Tarifa / Folio</div>
              <strong className="parking-exit-value parking-exit-fee">{formatMoney(vehicle.fee)}</strong>
            </div>
          </div>
          {vehicle.driverName || vehicle.driverPhone ? (
            <div className="parking-exit-driver">
              👤 Conductor: <strong>{vehicle.driverName || 'Huésped'}</strong>
              {vehicle.driverPhone ? ` · 📞 ${vehicle.driverPhone}` : ''}
            </div>
          ) : null}
          {vehicle.keysLeft ? (
            <div className="parking-exit-keys-warning">
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
        <div className="span-2 parking-exit-inspection">
          <input
            type="checkbox"
            id="inspection-check"
            checked={inspectionOk}
            onChange={(e) => setInspectionOk(e.target.checked)}
            className="parking-exit-inspection-checkbox"
          />
          <label htmlFor="inspection-check" className="parking-exit-inspection-label">
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
