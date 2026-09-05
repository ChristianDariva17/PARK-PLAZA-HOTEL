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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {error ? (
          <div className="alert-banner alert-banner-danger" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {/* Pestañas de Selección de Zona */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '4px',
          background: 'var(--color-surface-soft, #f1f5f9)',
          borderRadius: '12px',
          border: '1px solid var(--color-border, #e2e8f0)'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('piscina')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '700',
              transition: 'all 0.2s ease',
              background: activeTab === 'piscina' ? '#ffffff' : 'transparent',
              color: activeTab === 'piscina' ? '#0891b2' : 'var(--color-muted, #64748b)',
              boxShadow: activeTab === 'piscina' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <Waves size={18} />
            <span>Piscina Principal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mirador')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: '700',
              transition: 'all 0.2s ease',
              background: activeTab === 'mirador' ? '#ffffff' : 'transparent',
              color: activeTab === 'mirador' ? '#9333ea' : 'var(--color-muted, #64748b)',
              boxShadow: activeTab === 'mirador' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <Mountain size={18} />
            <span>Mirador Terraza</span>
          </button>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Tarifas Diferenciadas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Tarifa Visitante Externo (S/)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  background: '#ffffff',
                  color: 'var(--color-navy, #0f172a)',
                  fontSize: '14px',
                  fontWeight: '700',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                value={current.priceExternal}
                onChange={(e) => handleChange('priceExternal', e.target.value)}
                required
              />
              <span style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)', marginTop: '4px', display: 'block' }}>
                Day Pass general por persona
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Tarifa Huésped del Hotel (S/)
              </label>
              <input
                type="number"
                step="0.50"
                min="0"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  background: '#ffffff',
                  color: 'var(--color-navy, #0f172a)',
                  fontSize: '14px',
                  fontWeight: '700',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                value={current.priceGuest}
                onChange={(e) => handleChange('priceGuest', e.target.value)}
                required
              />
              <span style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)', marginTop: '4px', display: 'block' }}>
                0.00 = Acceso incluido en estadía
              </span>
            </div>
          </div>

          {/* Aforo, Pax y Duración */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Aforo Máximo Total
              </label>
              <input
                type="number"
                min="1"
                max="200"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  background: '#ffffff',
                  color: 'var(--color-navy, #0f172a)',
                  fontSize: '14px',
                  fontWeight: '700',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                value={current.capacity}
                onChange={(e) => handleChange('capacity', e.target.value)}
                required
              />
              <span style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)', marginTop: '4px', display: 'block' }}>
                Capacidad simultánea
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Máx. Pax por Grupo
              </label>
              <input
                type="number"
                min="1"
                max="50"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  background: '#ffffff',
                  color: 'var(--color-navy, #0f172a)',
                  fontSize: '14px',
                  fontWeight: '700',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                value={current.maxPax}
                onChange={(e) => handleChange('maxPax', e.target.value)}
                required
              />
              <span style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)', marginTop: '4px', display: 'block' }}>
                Límite por reserva
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Duración de Turno
              </label>
              <input
                type="number"
                min="15"
                step="15"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  background: '#ffffff',
                  color: 'var(--color-navy, #0f172a)',
                  fontSize: '14px',
                  fontWeight: '700',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                value={current.durationMinutes}
                onChange={(e) => handleChange('durationMinutes', e.target.value)}
                required
              />
              <span style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)', marginTop: '4px', display: 'block' }}>
                En minutos (ej. 120 = 2h)
              </span>
            </div>
          </div>

          {/* Horarios Operativos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Hora de Apertura
              </label>
              <input
                type="time"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  background: '#ffffff',
                  color: 'var(--color-navy, #0f172a)',
                  fontSize: '14px',
                  fontWeight: '600',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                value={current.openingHour || '08:00'}
                onChange={(e) => handleChange('openingHour', e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Hora de Cierre
              </label>
              <input
                type="time"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  background: '#ffffff',
                  color: 'var(--color-navy, #0f172a)',
                  fontSize: '14px',
                  fontWeight: '600',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                value={current.closingHour || '20:00'}
                onChange={(e) => handleChange('closingHour', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Estado de la Zona */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderRadius: '12px',
            background: 'var(--color-surface-soft, #f8fafc)',
            border: '1px solid var(--color-border, #e2e8f0)'
          }}>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--color-navy, #0f172a)' }}>
                Zona Activa para Reservas
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-muted, #64748b)' }}>
                Si se desactiva, los huéspedes no podrán generar nuevas reservas
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary, #2563eb)' }}
                checked={current.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
              />
            </label>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--color-border, #e2e8f0)' }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
