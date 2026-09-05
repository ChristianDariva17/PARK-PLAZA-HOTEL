import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Check,
  Clock,
  Info,
  Sparkles,
  X,
} from 'lucide-react';
import { Dialog } from '../../components/ui/Overlay.jsx';
import { staffClient } from '../../staff/staffClient.js';

export function StaffScheduleModal({ staffId, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [schedules, setSchedules] = useState([]);

  const [formData, setFormData] = useState({
    workScheduleId: '',
    validFrom: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    setFetching(true);
    setError(null);
    staffClient.listWorkSchedules()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setSchedules(list);
        if (list.length > 0 && !formData.workScheduleId) {
          setFormData((prev) => ({ ...prev, workScheduleId: list[0].id }));
        }
      })
      .catch((err) => setError(err.message || 'Error al cargar los esquemas de horarios'))
      .finally(() => setFetching(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.workScheduleId) return setError('Seleccioná un esquema de horario.');

    setLoading(true);
    setError(null);
    try {
      const standardPattern = {
        '1': [{ start: '08:00', end: '17:00' }],
        '2': [{ start: '08:00', end: '17:00' }],
        '3': [{ start: '08:00', end: '17:00' }],
        '4': [{ start: '08:00', end: '17:00' }],
        '5': [{ start: '08:00', end: '17:00' }],
        '6': [{ start: '08:00', end: '13:00' }],
      };

      await staffClient.assignWorkSchedule(
        staffId,
        formData.workScheduleId,
        new Date(formData.validFrom).toISOString(),
        standardPattern
      );
      onSaved();
    } catch (err) {
      setError(err.message || 'Error al asignar el horario de trabajo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title="Asignación de Horario y Turnos"
      description="Configurá la jornada laboral semanal y la fecha de vigencia para el colaborador."
      wide
    >
      {fetching ? (
        <div className="card route-loading" role="status" style={{ padding: '36px', textAlign: 'center' }}>
          Cargando esquemas de horario disponibles…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="form-grid" style={{ gap: '18px' }}>
          {/* Top Banner */}
          <div className="schedule-hero-banner span-2">
            <div className="schedule-hero-icon">
              <CalendarDays size={26} />
            </div>
            <div className="schedule-hero-content">
              <span className="schedule-hero-kicker">
                <Sparkles size={13} /> Esquema Laboral Hotel Park Plaza
              </span>
              <h4>Jornada Operativa Estándar</h4>
              <p>El sistema proyectará los turnos y la tolerancia de asistencia de forma automática por los próximos 30 días.</p>
            </div>
          </div>

          {error && (
            <div className="alert-banner alert-banner-danger span-2" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <label>
            <span>Esquema de Horario <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
            <div className="field-icon-wrap">
              <Clock size={16} />
              <select
                name="workScheduleId"
                value={formData.workScheduleId}
                onChange={handleChange}
                required
                disabled={loading}
              >
                {schedules.length === 0 ? (
                  <option value="">No hay horarios configurados</option>
                ) : (
                  schedules.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.ianaTimezone || 'America/Lima'})
                    </option>
                  ))
                )}
              </select>
            </div>
          </label>

          <label>
            <span>Válido Desde <strong style={{ color: 'var(--color-danger)' }}>*</strong></span>
            <div className="field-icon-wrap">
              <Calendar size={16} />
              <input
                type="date"
                name="validFrom"
                value={formData.validFrom}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
          </label>

          {/* Shift pattern card */}
          <div className="span-2 schedule-pattern-card">
            <div className="schedule-pattern-header">
              <Clock size={15} />
              <span>Detalle del Patrón Semanal de Turnos</span>
            </div>
            <div className="schedule-pattern-grid">
              <div className="schedule-day-item">
                <span className="day-name">Lunes a Viernes</span>
                <strong className="day-hours">08:00 — 17:00</strong>
                <small className="day-type">Jornada completa (9 hrs)</small>
              </div>
              <div className="schedule-day-item">
                <span className="day-name">Sábados</span>
                <strong className="day-hours">08:00 — 13:00</strong>
                <small className="day-type">Media jornada (5 hrs)</small>
              </div>
              <div className="schedule-day-item rest">
                <span className="day-name">Domingos</span>
                <strong className="day-hours" style={{ color: 'var(--color-muted)' }}>Descanso</strong>
                <small className="day-type">Sin turno asignado</small>
              </div>
            </div>
          </div>

          <div className="alert-banner alert-banner-info span-2">
            <Info size={16} />
            <span>Al confirmar, las asistencias marcadas se compararán contra este horario para auditar ingresos y salidas.</span>
          </div>

          {/* Form Actions */}
          <div className="form-actions span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={loading}
            >
              <X size={16} /> Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || schedules.length === 0}
            >
              {loading ? (
                <>Asignando horario…</>
              ) : (
                <>
                  <Check size={16} /> Asignar y Proyectar Turnos
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
