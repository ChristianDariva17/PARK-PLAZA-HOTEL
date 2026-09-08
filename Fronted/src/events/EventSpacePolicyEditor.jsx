import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  Building2, 
  Shield, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Layers,
  Music,
  UtensilsCrossed,
  ShieldCheck,
  Volume2,
  Cigarette,
  Plus,
  Trash2,
  Tag,
  DollarSign,
  Coffee,
  Tv,
  Check,
  X
} from 'lucide-react';
import { P1Button, P1Input, P1Select } from '../components/ui/P1Atoms';
import { eventsClient } from './eventsClient';

const numericFields = [
  { key: 'capacity', label: 'Capacidad Máxima (personas)' },
  { key: 'setupMinutes', label: 'Tiempo de Montaje (min)' },
  { key: 'teardownMinutes', label: 'Tiempo de Desmontaje (min)' },
  { key: 'minimumDurationMinutes', label: 'Duración Mínima (min)' },
  { key: 'baseRate', label: 'Tarifa Base (S/)' },
  { key: 'includedMinutes', label: 'Minutos Incluidos en Base' },
  { key: 'extraMinuteRate', label: 'Tarifa Minuto Extra (S/)' },
  { key: 'depositPercentage', label: 'Porcentaje de Adelanto (%)' },
  { key: 'guaranteeAmount', label: 'Monto de Garantía (S/)' },
  { key: 'cleaningFee', label: 'Tarifa de Limpieza (S/)' },
  { key: 'taxRate', label: 'Tasa de Impuesto / IGV (%)' },
];

const SERVICE_CATEGORIES = [
  'Gastronomía & Catering',
  'Bar & Coctelería',
  'Audio & Proyección',
  'Mobiliario & Decoración',
  'Personal de Sala & Seguridad'
];

export function EventSpacePolicyEditor({ onClose, onSaved }) {
  const [spaces, setSpaces] = useState([]);
  const [spaceId, setSpaceId] = useState('');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Structured state replacing JSON textareas
  const [rules, setRules] = useState({
    liveMusicAllowed: true,
    externalCateringAllowed: false,
    securityRequired: true,
    smokingAllowed: false,
    maxDecibels: 85,
    customRules: []
  });
  const [newCustomRule, setNewCustomRule] = useState('');

  const [cancellation, setCancellation] = useState({
    daysBeforeFullRefund: 15,
    penaltyPercentage: 50,
    guaranteeRefundable: true,
    notes: 'Cancelaciones dentro de las 48 horas previas conllevan retención del 100% del adelanto.'
  });

  const [services, setServices] = useState([]);
  const [showAddService, setShowAddService] = useState(false);
  const [newService, setNewService] = useState({
    code: '',
    name: '',
    category: 'Gastronomía & Catering',
    unitAmount: 50,
    perPerson: true
  });

  useEffect(() => {
    const controller = new AbortController();
    eventsClient.getSpaces(controller.signal).then(sp => {
      if (controller.signal.aborted) return;
      setSpaces(sp);
      if (sp.length > 0) setSpaceId((currentSpaceId) => currentSpaceId || sp[0].id);
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!spaceId) { setForm(null); return () => controller.abort(); }
    setError('');
    setSuccessMsg('');
    eventsClient.getSpacePolicy(spaceId, controller.signal).then((policy) => {
      if (controller.signal.aborted) return;
      setForm(policy);
      
      // Parse or load rules
      const r = policy.rules || {};
      setRules({
        liveMusicAllowed: r.liveMusicAllowed !== undefined ? Boolean(r.liveMusicAllowed) : true,
        externalCateringAllowed: r.externalCateringAllowed !== undefined ? Boolean(r.externalCateringAllowed) : false,
        securityRequired: r.securityRequired !== undefined ? Boolean(r.securityRequired) : true,
        smokingAllowed: r.smokingAllowed !== undefined ? Boolean(r.smokingAllowed) : false,
        maxDecibels: Number(r.maxDecibels || 85),
        customRules: Array.isArray(r.customRules) ? r.customRules : (Array.isArray(r.restrictions) ? r.restrictions : [])
      });

      // Parse or load cancellation policy
      const c = policy.cancellationPolicy || {};
      setCancellation({
        daysBeforeFullRefund: Number(c.daysBeforeFullRefund ?? 15),
        penaltyPercentage: Number(c.penaltyPercentage ?? 50),
        guaranteeRefundable: c.guaranteeRefundable !== undefined ? Boolean(c.guaranteeRefundable) : true,
        notes: c.notes || 'Cancelaciones con menos de 48 horas de anticipación no están sujetas a reembolso.'
      });

      // Parse or load services
      setServices(Array.isArray(policy.services) ? policy.services : []);
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, [spaceId]);

  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const addCustomRule = (e) => {
    e.preventDefault();
    if (!newCustomRule.trim()) return;
    setRules(prev => ({ ...prev, customRules: [...prev.customRules, newCustomRule.trim()] }));
    setNewCustomRule('');
  };

  const removeCustomRule = (index) => {
    setRules(prev => ({ ...prev, customRules: prev.customRules.filter((_, idx) => idx !== index) }));
  };

  const handleAddService = (e) => {
    e.preventDefault();
    if (!newService.name.trim()) return;
    const code = newService.code.trim() || newService.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setServices(prev => [...prev, { ...newService, code }]);
    setNewService({ code: '', name: '', category: 'Gastronomía & Catering', unitAmount: 50, perPerson: true });
    setShowAddService(false);
  };

  const removeService = (index) => {
    setServices(prev => prev.filter((_, idx) => idx !== index));
  };
  
  const save = async (event) => {
    event.preventDefault();
    try {
      setSaving(true); 
      setError('');
      setSuccessMsg('');

      const payload = Object.fromEntries(numericFields.map((f) => [f.key, Number(form[f.key])]));
      payload.openingTime = form.openingTime; 
      payload.closingTime = form.closingTime;
      payload.rules = rules; 
      payload.cancellationPolicy = cancellation;

      await eventsClient.updateSpacePolicy(spaceId, payload);
      await eventsClient.replaceSpaceServices(spaceId, services);
      
      setSuccessMsg('¡Políticas y catálogo de servicios guardados con éxito!');
      onSaved?.();
    } catch (err) { 
      setError(err.message || 'Error al guardar las políticas.'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="view-container event-space-policy-editor">
      {/* Top Header */}
      <div className="event-policy-header">
        <div>
          <button 
            type="button" 
            onClick={onClose}
            className="btn btn-outline event-policy-back"
          >
            <ArrowLeft size={14} /> Volver a eventos
          </button>
          <h2 className="event-policy-title">
            Configuración & Políticas de Salones
          </h2>
          <p className="event-policy-subtitle">
            Ajuste capacidades, tarifas por hora, tiempos de preparación y políticas operativas por ambiente.
          </p>
        </div>
      </div>

      {error && (
        <div className="event-policy-message event-policy-message--error">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="event-policy-message event-policy-message--success">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {/* Selector de Ambiente */}
      <div className="card event-policy-card event-policy-space-selector">
        <P1Select 
          label="Seleccionar Salón o Espacio para Configurar" 
          value={spaceId} 
          onChange={(e) => setSpaceId(e.target.value)}
        >
          <option value="">-- Seleccione un Salón --</option>
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>{space.name}</option>
          ))}
        </P1Select>
      </div>

      {form ? (
        <form onSubmit={save} className="event-policy-form">
          {/* Card: Tarifas y Capacidad */}
          <div className="card event-policy-card">
            <h3 className="event-policy-section-title">
              1. Tarifas, Tiempos de Montaje y Capacidad
            </h3>
            <div className="event-policy-grid event-policy-grid--three">
              {numericFields.map((f) => (
                <P1Input 
                  key={f.key} 
                  type="number" 
                  step="0.01" 
                  label={f.label} 
                  value={form[f.key] ?? ''} 
                  onChange={(e) => change(f.key, e.target.value)} 
                />
              ))}
            </div>
          </div>

          {/* Card: Horarios de Operación */}
          <div className="card event-policy-card">
            <h3 className="event-policy-section-title">
              2. Horario de Disponibilidad del Ambiente
            </h3>
            <div className="event-policy-grid event-policy-grid--two">
              <P1Input 
                type="time" 
                label="Horario de Apertura" 
                value={form.openingTime || ''} 
                onChange={(e) => change('openingTime', e.target.value)} 
              />
              <P1Input 
                type="time" 
                label="Horario de Cierre" 
                value={form.closingTime || ''} 
                onChange={(e) => change('closingTime', e.target.value)} 
              />
            </div>
          </div>

          {/* Card: Reglas Operativas Visuales (SIN JSON) */}
          <div className="card event-policy-card">
            <h3 className="event-policy-section-title event-policy-section-title--icon">
              <ShieldCheck size={18} color="#C59D5F" /> 3. Reglas y Restricciones del Salón
            </h3>

            <div className="event-policy-grid event-policy-grid--two event-policy-rules-grid">
              <label className={`event-policy-rule${rules.liveMusicAllowed ? ' is-enabled' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={rules.liveMusicAllowed} 
                  onChange={(e) => setRules(r => ({ ...r, liveMusicAllowed: e.target.checked }))} 
                  className="event-policy-checkbox"
                />
                <div>
                  <strong className="event-policy-rule-title">Música en Vivo / Orquesta Permitida</strong>
                  <span className="event-policy-rule-copy">Permite bandas y equipos de amplificación alta</span>
                </div>
              </label>

              <label className={`event-policy-rule${rules.externalCateringAllowed ? ' is-enabled' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={rules.externalCateringAllowed} 
                  onChange={(e) => setRules(r => ({ ...r, externalCateringAllowed: e.target.checked }))} 
                  className="event-policy-checkbox"
                />
                <div>
                  <strong className="event-policy-rule-title">Catering Externo Permitido</strong>
                  <span className="event-policy-rule-copy">Si se desmarca, solo se admiten consumos del hotel</span>
                </div>
              </label>

              <label className={`event-policy-rule${rules.securityRequired ? ' is-enabled' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={rules.securityRequired} 
                  onChange={(e) => setRules(r => ({ ...r, securityRequired: e.target.checked }))} 
                  className="event-policy-checkbox"
                />
                <div>
                  <strong className="event-policy-rule-title">Personal de Seguridad Obligatorio</strong>
                  <span className="event-policy-rule-copy">Requiere al menos 1 agente asignado por la propiedad</span>
                </div>
              </label>

              <label className={`event-policy-rule${rules.smokingAllowed ? ' is-enabled' : ''}`}>
                <input 
                  type="checkbox" 
                  checked={rules.smokingAllowed} 
                  onChange={(e) => setRules(r => ({ ...r, smokingAllowed: e.target.checked }))} 
                  className="event-policy-checkbox"
                />
                <div>
                  <strong className="event-policy-rule-title">Terraza / Zona de Fumadores Habilitada</strong>
                  <span className="event-policy-rule-copy">Habilita ceniceros y ventilación de terraza</span>
                </div>
              </label>
            </div>

            <div className="event-policy-grid event-policy-grid--two event-policy-volume-grid">
              <div>
                <label className="event-policy-field-label">
                  Límite Máximo de Volumen Acústico (dB)
                </label>
                <input 
                  type="number"
                  min="50"
                  max="120"
                  value={rules.maxDecibels}
                  onChange={(e) => setRules(r => ({ ...r, maxDecibels: Number(e.target.value) }))}
                  className="event-policy-field-control"
                />
              </div>
            </div>

            {/* Custom Rules List */}
            <div>
              <label className="event-policy-field-label">
                Restricciones Específicas del Ambiente
              </label>
              <div className="event-policy-custom-rule-entry">
                <input 
                  type="text"
                  placeholder="Ej: No se permite pirotecnia en interiores, Prohibido confeti metálico..."
                  value={newCustomRule}
                  onChange={(e) => setNewCustomRule(e.target.value)}
                  className="event-policy-field-control event-policy-custom-rule-input"
                />
                <button type="button" onClick={addCustomRule} className="btn btn-outline event-policy-inline-button">
                  <Plus size={15} /> Agregar Regla
                </button>
              </div>
              <div className="event-policy-custom-rules">
                {rules.customRules.map((rule, idx) => (
                  <span key={idx} className="event-policy-custom-rule">
                    {rule}
                    <button type="button" onClick={() => removeCustomRule(idx)} className="event-policy-remove-button">
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card: Política de Cancelación Visual (SIN JSON) */}
          <div className="card event-policy-card">
            <h3 className="event-policy-section-title">
              4. Política de Cancelación y Penalidades
            </h3>
            <div className="event-policy-grid event-policy-grid--three event-policy-cancellation-grid">
              <div>
                <label className="event-policy-field-label">
                  Días Mínimos para Reembolso Completo
                </label>
                <input 
                  type="number"
                  min="0"
                  value={cancellation.daysBeforeFullRefund}
                  onChange={(e) => setCancellation(c => ({ ...c, daysBeforeFullRefund: Number(e.target.value) }))}
                  className="event-policy-field-control"
                />
              </div>

              <div>
                <label className="event-policy-field-label">
                  Penalidad por Cancelación Tardía (%)
                </label>
                <input 
                  type="number"
                  min="0"
                  max="100"
                  value={cancellation.penaltyPercentage}
                  onChange={(e) => setCancellation(c => ({ ...c, penaltyPercentage: Number(e.target.value) }))}
                  className="event-policy-field-control"
                />
              </div>

              <div className="event-policy-refund-field">
                <label className="event-policy-checkbox-label">
                  <input 
                    type="checkbox"
                    checked={cancellation.guaranteeRefundable}
                    onChange={(e) => setCancellation(c => ({ ...c, guaranteeRefundable: e.target.checked }))}
                    className="event-policy-checkbox"
                  />
                  <span className="event-policy-rule-title">Garantía Reembolsable al 100%</span>
                </label>
              </div>
            </div>

            <div>
              <label className="event-policy-field-label">
                Cláusula o Nota Aclaratoria
              </label>
              <textarea 
                rows={2}
                value={cancellation.notes}
                onChange={(e) => setCancellation(c => ({ ...c, notes: e.target.value }))}
                className="event-policy-field-control event-policy-notes"
              />
            </div>
          </div>

          {/* Card: Catálogo de Servicios por Salón (SIN JSON) */}
          <div className="card event-policy-card">
            <div className="event-policy-services-header">
              <h3 className="event-policy-section-title event-policy-section-title--services">
                5. Catálogo de Servicios & Paquetes Disponibles en este Salón
              </h3>
              <button 
                type="button" 
                onClick={() => setShowAddService(!showAddService)}
                className="btn btn-primary event-policy-service-toggle"
              >
                <Plus size={14} /> {showAddService ? 'Cerrar Formulario' : '+ Agregar Servicio'}
              </button>
            </div>

            {/* Formulario Agregar Servicio */}
            {showAddService && (
              <div className="event-policy-add-service">
                <h4 className="event-policy-add-service-title">Nuevo Servicio para el Ambiente</h4>
                <div className="event-policy-service-grid">
                  <div>
                    <label className="event-policy-service-label">Nombre del Servicio *</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Open Bar Autor, Coffee Break..." 
                      value={newService.name} 
                      onChange={(e) => setNewService(s => ({ ...s, name: e.target.value }))}
                      className="event-policy-service-control"
                    />
                  </div>

                  <div>
                    <label className="event-policy-service-label">Categoría</label>
                    <select 
                      value={newService.category} 
                      onChange={(e) => setNewService(s => ({ ...s, category: e.target.value }))}
                      className="event-policy-service-control"
                    >
                      {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="event-policy-service-label">Tarifa (S/)</label>
                    <input 
                      type="number" 
                      step="0.50" 
                      min="0" 
                      value={newService.unitAmount} 
                      onChange={(e) => setNewService(s => ({ ...s, unitAmount: Number(e.target.value) }))}
                      className="event-policy-service-control"
                    />
                  </div>

                  <div>
                    <label className="event-policy-service-label">Modalidad</label>
                    <select 
                      value={newService.perPerson ? 'person' : 'fixed'} 
                      onChange={(e) => setNewService(s => ({ ...s, perPerson: e.target.value === 'person' }))}
                      className="event-policy-service-control"
                    >
                      <option value="person">Por Persona</option>
                      <option value="fixed">Tarifa Plana</option>
                    </select>
                  </div>

                  <button 
                    type="button" 
                    onClick={handleAddService} 
                    className="btn btn-primary event-policy-service-save"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            {/* Tabla de Servicios */}
            {services.length > 0 ? (
              <table className="event-policy-services-table">
                <thead>
                  <tr className="event-policy-services-heading">
                    <th>Servicio</th>
                    <th>Categoría</th>
                    <th>Modalidad</th>
                    <th className="is-right">Tarifa Unit.</th>
                    <th className="is-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, idx) => (
                    <tr key={idx}>
                      <td className="event-policy-service-name">
                        {s.name || s.serviceCode || s.code}
                      </td>
                      <td className="event-policy-service-category">
                        {s.category || 'General'}
                      </td>
                      <td>
                        <span className={`event-policy-service-mode${s.perPerson ? ' is-per-person' : ''}`}>
                          {s.perPerson ? 'Por persona' : 'Tarifa fija'}
                        </span>
                      </td>
                      <td className="event-policy-service-amount">
                        S/ {Number(s.unitAmount || 0).toFixed(2)}
                      </td>
                      <td className="event-policy-service-actions">
                        <button 
                          type="button" 
                          onClick={() => removeService(idx)} 
                           className="event-policy-delete-service"
                          title="Eliminar servicio"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="event-policy-no-services">
                No hay servicios adicionales configurados específicamente para este salón.
              </div>
            )}
          </div>

          <div className="event-policy-form-actions">
            <button type="button" onClick={onClose} className="btn btn-outline event-policy-cancel">
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="btn btn-primary event-policy-submit"
            >
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Políticas del Ambiente'}
            </button>
          </div>
        </form>
      ) : (
        <div className="event-policy-no-space">
          Seleccione un salón para cargar sus parámetros.
        </div>
      )}
    </div>
  );
}
