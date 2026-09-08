import { useState, useEffect } from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { Waves, Mountain, Settings2, Save, AlertCircle, Clock, Users, DollarSign, CheckCircle2 } from 'lucide-react';
import { updateAmenityConfig } from './amenitiesClient.js';

export function AmenityConfigModal({ open, onClose, configs = [], onSuccess, notify }) {
  const [activeTab, setActiveTab] = useState('piscina'); // 'piscina' | 'mirador'
  const [formValues, setFormValues] = useState(() => {
    const map = {};
    (configs || []).forEach((c) => {
      map[c.amenityKey.toLowerCase()] = { ...c };
    });
    return {
      piscina: map.piscina || {
        amenityKey: 'piscina',
        name: 'Piscina',
        priceExternal: 25,
        priceGuest: 0,
        durationMinutes: 120,
        maxPax: 6,
        capacity: 24,
        openingHour: '08:00',
        closingHour: '20:00',
        isActive: true,
      },
      mirador: map.mirador || {
        amenityKey: 'mirador',
        name: 'Mirador',
        priceExternal: 10,
        priceGuest: 0,
        durationMinutes: 90,
        maxPax: 4,
        capacity: 12,
        openingHour: '09:00',
        closingHour: '22:00',
        isActive: true,
      },
    };
  });

  // Sync state whenever configs change from backend
  useEffect(() => {
    if (configs && configs.length > 0) {
      const map = {};
      configs.forEach((c) => {
        map[c.amenityKey.toLowerCase()] = { ...c };
      });
      setFormValues((prev) => ({
        piscina: map.piscina ? { ...map.piscina } : prev.piscina,
        mirador: map.mirador ? { ...map.mirador } : prev.mirador,
      }));
    }
  }, [configs]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const current = formValues[activeTab] || formValues.piscina;

  const handleChange = (field, value) => {
    setFormValues((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: value,
      },
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      await updateAmenityConfig({
        amenityKey: activeTab,
        name: current.name,
        priceExternal: Number(current.priceExternal),
        priceGuest: Number(current.priceGuest),
        durationMinutes: Number(current.durationMinutes),
        maxPax: Number(current.maxPax),
        capacity: Number(current.capacity),
        openingHour: current.openingHour,
        closingHour: current.closingHour,
        isActive: Boolean(current.isActive),
      });

      notify?.('Configuración guardada', `Tarifas y aforos de ${current.name} actualizados exitosamente.`, 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Configuración de Tarifas & Aforos"
      description="Ajuste los precios para visitantes externos, tarifas de huéspedes, aforo máximo y horarios operativos."
    >
      <div className="amenity-modal-stack">
        {error ? (
          <div className="alert-banner alert-banner-danger" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Pestañas de Selección de Zona */}
        <div className="amenity-zone-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('piscina')}
            className={`amenity-zone-tab ${activeTab === 'piscina' ? 'is-selected tone-cyan' : ''}`}
          >
            <Waves size={18} />
            <span>Piscina Principal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mirador')}
            className={`amenity-zone-tab ${activeTab === 'mirador' ? 'is-selected tone-purple' : ''}`}
          >
            <Mountain size={18} />
            <span>Mirador Terraza</span>
          </button>
        </div>

        <form onSubmit={handleSave} className="amenity-form-stack">
          {/* Tarifas Diferenciadas */}
          <div className="amenity-grid amenity-grid-wide">
            <div>
              <label className="amenity-field-label">
                Tarifa Visitante Externo (S/)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                className="form-control amenity-number-input"
                value={current.priceExternal}
                onChange={(e) => handleChange('priceExternal', e.target.value)}
                required
              />
              <span className="amenity-helper">
                Day Pass general por persona
              </span>
            </div>

            <div>
              <label className="amenity-field-label">
                Tarifa Huésped del Hotel (S/)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                className="form-control amenity-number-input"
                value={current.priceGuest}
                onChange={(e) => handleChange('priceGuest', e.target.value)}
                required
              />
              <span className="amenity-helper">
                0.00 = Acceso incluido en estadía
              </span>
            </div>
          </div>

          {/* Aforo, Pax y Duración */}
          <div className="amenity-grid amenity-grid-compact">
            <div>
              <label className="amenity-field-label">
                Aforo Máximo Total
              </label>
              <input
                type="number"
                min="1"
                max="200"
                className="form-control amenity-number-input"
                value={current.capacity}
                onChange={(e) => handleChange('capacity', e.target.value)}
                required
              />
              <span className="amenity-helper">
                Capacidad simultánea
              </span>
            </div>

            <div>
              <label className="amenity-field-label">
                Máx. Pax por Grupo
              </label>
              <input
                type="number"
                min="1"
                max="50"
                className="form-control amenity-number-input"
                value={current.maxPax}
                onChange={(e) => handleChange('maxPax', e.target.value)}
                required
              />
              <span className="amenity-helper">
                Límite por reserva
              </span>
            </div>

            <div>
              <label className="amenity-field-label">
                Duración de Turno
              </label>
              <input
                type="number"
                min="15"
                step="15"
                className="form-control amenity-number-input"
                value={current.durationMinutes}
                onChange={(e) => handleChange('durationMinutes', e.target.value)}
                required
              />
              <span className="amenity-helper">
                En minutos (ej. 120 = 2h)
              </span>
            </div>
          </div>

          {/* Horarios Operativos */}
          <div className="amenity-grid amenity-grid-hours">
            <div>
              <label className="amenity-field-label">
                Hora de Apertura
              </label>
              <input
                type="time"
                className="form-control amenity-time-input"
                value={current.openingHour || '08:00'}
                onChange={(e) => handleChange('openingHour', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="amenity-field-label">
                Hora de Cierre
              </label>
              <input
                type="time"
                className="form-control amenity-time-input"
                value={current.closingHour || '20:00'}
                onChange={(e) => handleChange('closingHour', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Estado de la Zona */}
          <div className="amenity-active-row">
            <div>
              <div className="amenity-title">
                Zona Activa para Reservas
              </div>
              <div className="amenity-description">
                Si se desactiva, los huéspedes no podrán generar nuevas reservas
              </div>
            </div>
            <label className="amenity-checkbox-label">
              <input
                type="checkbox"
                className="amenity-checkbox"
                checked={current.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
              />
            </label>
          </div>

          {/* Footer Actions */}
          <div className="amenity-form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary amenity-inline-button" disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
