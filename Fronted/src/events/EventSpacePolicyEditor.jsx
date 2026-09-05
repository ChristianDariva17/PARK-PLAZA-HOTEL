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
    eventsClient.getSpaces().then(sp => {
      setSpaces(sp);
      if (sp.length > 0 && !spaceId) {
        setSpaceId(sp[0].id);
      }
    }).catch((err) => setError(err.message)); 
  }, []);

  useEffect(() => {
    if (!spaceId) { setForm(null); return; }
    setError('');
    setSuccessMsg('');
    eventsClient.getSpacePolicy(spaceId).then((policy) => {
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
    }).catch((err) => setError(err.message));
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
    <div className="view-container" style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 60 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <button 
            type="button" 
            onClick={onClose}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 14px', fontSize: 13 }}
          >
            <ArrowLeft size={14} /> Volver a eventos
          </button>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-navy, #1E3A8A)', margin: 0 }}>
            Configuración & Políticas de Salones
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-muted, #6B7280)', fontSize: 13.5 }}>
            Ajuste capacidades, tarifas por hora, tiempos de preparación y políticas operativas por ambiente.
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600 }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '14px 18px', background: '#DCFCE7', border: '1px solid #86EFAC', color: '#166534', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600 }}>
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {/* Selector de Ambiente */}
      <div className="card" style={{ padding: 22, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--color-border, #E5E7EB)', marginBottom: 20 }}>
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
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Card: Tarifas y Capacidad */}
          <div className="card" style={{ padding: 24, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--color-border, #E5E7EB)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 16px', borderBottom: '1px solid #F3F4F6', paddingBottom: 10 }}>
              1. Tarifas, Tiempos de Montaje y Capacidad
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
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
          <div className="card" style={{ padding: 24, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--color-border, #E5E7EB)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 16px', borderBottom: '1px solid #F3F4F6', paddingBottom: 10 }}>
              2. Horario de Disponibilidad del Ambiente
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
          <div className="card" style={{ padding: 24, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--color-border, #E5E7EB)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 16px', borderBottom: '1px solid #F3F4F6', paddingBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color="#C59D5F" /> 3. Reglas y Restricciones del Salón
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: '1px solid #E5E7EB', background: rules.liveMusicAllowed ? '#F0FDF4' : '#F9FAFB', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={rules.liveMusicAllowed} 
                  onChange={(e) => setRules(r => ({ ...r, liveMusicAllowed: e.target.checked }))} 
                  style={{ width: 18, height: 18 }}
                />
                <div>
                  <strong style={{ fontSize: 13, color: '#111827', display: 'block' }}>Música en Vivo / Orquesta Permitida</strong>
                  <span style={{ fontSize: 11.5, color: '#6B7280' }}>Permite bandas y equipos de amplificación alta</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: '1px solid #E5E7EB', background: rules.externalCateringAllowed ? '#F0FDF4' : '#F9FAFB', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={rules.externalCateringAllowed} 
                  onChange={(e) => setRules(r => ({ ...r, externalCateringAllowed: e.target.checked }))} 
                  style={{ width: 18, height: 18 }}
                />
                <div>
                  <strong style={{ fontSize: 13, color: '#111827', display: 'block' }}>Catering Externo Permitido</strong>
                  <span style={{ fontSize: 11.5, color: '#6B7280' }}>Si se desmarca, solo se admiten consumos del hotel</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: '1px solid #E5E7EB', background: rules.securityRequired ? '#F0FDF4' : '#F9FAFB', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={rules.securityRequired} 
                  onChange={(e) => setRules(r => ({ ...r, securityRequired: e.target.checked }))} 
                  style={{ width: 18, height: 18 }}
                />
                <div>
                  <strong style={{ fontSize: 13, color: '#111827', display: 'block' }}>Personal de Seguridad Obligatorio</strong>
                  <span style={{ fontSize: 11.5, color: '#6B7280' }}>Requiere al menos 1 agente asignado por la propiedad</span>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, border: '1px solid #E5E7EB', background: rules.smokingAllowed ? '#F0FDF4' : '#F9FAFB', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={rules.smokingAllowed} 
                  onChange={(e) => setRules(r => ({ ...r, smokingAllowed: e.target.checked }))} 
                  style={{ width: 18, height: 18 }}
                />
                <div>
                  <strong style={{ fontSize: 13, color: '#111827', display: 'block' }}>Terraza / Zona de Fumadores Habilitada</strong>
                  <span style={{ fontSize: 11.5, color: '#6B7280' }}>Habilita ceniceros y ventilación de terraza</span>
                </div>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                  Límite Máximo de Volumen Acústico (dB)
                </label>
                <input 
                  type="number"
                  min="50"
                  max="120"
                  value={rules.maxDecibels}
                  onChange={(e) => setRules(r => ({ ...r, maxDecibels: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14 }}
                />
              </div>
            </div>

            {/* Custom Rules List */}
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                Restricciones Específicas del Ambiente
              </label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <input 
                  type="text"
                  placeholder="Ej: No se permite pirotecnia en interiores, Prohibido confeti metálico..."
                  value={newCustomRule}
                  onChange={(e) => setNewCustomRule(e.target.value)}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13 }}
                />
                <button type="button" onClick={addCustomRule} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={15} /> Agregar Regla
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {rules.customRules.map((rule, idx) => (
                  <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: '#F1F5F9', borderRadius: 9999, fontSize: 12, color: '#334155' }}>
                    {rule}
                    <button type="button" onClick={() => removeCustomRule(idx)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}>
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card: Política de Cancelación Visual (SIN JSON) */}
          <div className="card" style={{ padding: 24, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--color-border, #E5E7EB)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 16px', borderBottom: '1px solid #F3F4F6', paddingBottom: 10 }}>
              4. Política de Cancelación y Penalidades
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                  Días Mínimos para Reembolso Completo
                </label>
                <input 
                  type="number"
                  min="0"
                  value={cancellation.daysBeforeFullRefund}
                  onChange={(e) => setCancellation(c => ({ ...c, daysBeforeFullRefund: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                  Penalidad por Cancelación Tardía (%)
                </label>
                <input 
                  type="number"
                  min="0"
                  max="100"
                  value={cancellation.penaltyPercentage}
                  onChange={(e) => setCancellation(c => ({ ...c, penaltyPercentage: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 14 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={cancellation.guaranteeRefundable}
                    onChange={(e) => setCancellation(c => ({ ...c, guaranteeRefundable: e.target.checked }))}
                    style={{ width: 18, height: 18 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Garantía Reembolsable al 100%</span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                Cláusula o Nota Aclaratoria
              </label>
              <textarea 
                rows={2}
                value={cancellation.notes}
                onChange={(e) => setCancellation(c => ({ ...c, notes: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Card: Catálogo de Servicios por Salón (SIN JSON) */}
          <div className="card" style={{ padding: 24, borderRadius: 14, background: '#FFFFFF', border: '1px solid var(--color-border, #E5E7EB)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #F3F4F6', paddingBottom: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0 }}>
                5. Catálogo de Servicios & Paquetes Disponibles en este Salón
              </h3>
              <button 
                type="button" 
                onClick={() => setShowAddService(!showAddService)}
                className="btn btn-primary"
                style={{ fontSize: 12.5, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} /> {showAddService ? 'Cerrar Formulario' : '+ Agregar Servicio'}
              </button>
            </div>

            {/* Formulario Agregar Servicio */}
            {showAddService && (
              <div style={{ background: '#F8FAFC', padding: 18, borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 18 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 800, color: '#1E3A8A' }}>Nuevo Servicio para el Ambiente</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 100px 120px auto', gap: 12, alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Nombre del Servicio *</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Open Bar Autor, Coffee Break..." 
                      value={newService.name} 
                      onChange={(e) => setNewService(s => ({ ...s, name: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Categoría</label>
                    <select 
                      value={newService.category} 
                      onChange={(e) => setNewService(s => ({ ...s, category: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    >
                      {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Tarifa (S/)</label>
                    <input 
                      type="number" 
                      step="0.50" 
                      min="0" 
                      value={newService.unitAmount} 
                      onChange={(e) => setNewService(s => ({ ...s, unitAmount: Number(e.target.value) }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>Modalidad</label>
                    <select 
                      value={newService.perPerson ? 'person' : 'fixed'} 
                      onChange={(e) => setNewService(s => ({ ...s, perPerson: e.target.value === 'person' }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13 }}
                    >
                      <option value="person">Por Persona</option>
                      <option value="fixed">Tarifa Plana</option>
                    </select>
                  </div>

                  <button 
                    type="button" 
                    onClick={handleAddService} 
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: 13, fontWeight: 800 }}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            {/* Tabla de Servicios */}
            {services.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', color: '#475569' }}>Servicio</th>
                    <th style={{ padding: '10px 12px', color: '#475569' }}>Categoría</th>
                    <th style={{ padding: '10px 12px', color: '#475569' }}>Modalidad</th>
                    <th style={{ padding: '10px 12px', color: '#475569', textAlign: 'right' }}>Tarifa Unit.</th>
                    <th style={{ padding: '10px 12px', color: '#475569', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#111827' }}>
                        {s.name || s.serviceCode || s.code}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748B' }}>
                        {s.category || 'General'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 6, background: s.perPerson ? '#EFF6FF' : '#F1F5F9', color: s.perPerson ? '#1D4ED8' : '#475569', fontWeight: 600 }}>
                          {s.perPerson ? 'Por persona' : 'Tarifa fija'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#15803D' }}>
                        S/ {Number(s.unitAmount || 0).toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => removeService(idx)} 
                          style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: 4 }}
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
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#94A3B8', fontSize: 13 }}>
                No hay servicios adicionales configurados específicamente para este salón.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ padding: '12px 24px' }}>
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={saving} 
              className="btn btn-primary" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 32px', fontWeight: 800, fontSize: 14 }}
            >
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Políticas del Ambiente'}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>
          Seleccione un salón para cargar sus parámetros.
        </div>
      )}
    </div>
  );
}
