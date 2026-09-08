import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Clock, 
  Users, 
  DollarSign, 
  UserCheck, 
  Sparkles, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Layers,
  Repeat,
  UtensilsCrossed,
  Coffee,
  Wine,
  Tv,
  Mic,
  Flower2,
} from 'lucide-react';
import { P1Input, P1Select, P1Badge } from '../components/ui/P1Atoms';
import { eventsClient } from './eventsClient';
import { useHotel } from '../state/hotelContext.js';

const QUICK_TEMPLATES = [
  { label: '💍 Boda / Matrimonio', title: 'Recepción de Boda', hours: 6, kind: 'time_bound' },
  { label: '💼 Conferencia / Directorio', title: 'Reunión de Directorio Ejecutivo', hours: 4, kind: 'time_bound' },
  { label: '🎂 Celebración Privada', title: 'Celebración de Cumpleaños VIP', hours: 4, kind: 'time_bound' },
  { label: '🥂 Cena de Gala / Banquete', title: 'Cena de Gala Anual', hours: 5, kind: 'time_bound' },
  { label: '🍹 Cóctel / After Office', title: 'Networking & Cóctel Corporativo', hours: 3, kind: 'time_bound' },
];

const STANDARD_CATERING_SERVICES = [
  { code: 'coffee_break', name: 'Coffee Break Ejecutivo (Café, jugos, bocaditos)', unitAmount: 35, perPerson: true, icon: Coffee },
  { code: 'lunch_dinner_3courses', name: 'Almuerzo / Cena de Gala 3 Tiempos', unitAmount: 85, perPerson: true, icon: UtensilsCrossed },
  { code: 'open_bar_cocktails', name: 'Open Bar Coctelería de Autor (Pisco Sour, Chilcanos)', unitAmount: 65, perPerson: true, icon: Wine },
  { code: 'projector_audio_pro', name: 'Proyector Láser 4K & Sonido Profesional', unitAmount: 250, perPerson: false, icon: Tv },
  { code: 'wireless_mics_podium', name: 'Set de Micrófonos Inalámbricos & Podio', unitAmount: 120, perPerson: false, icon: Mic },
  { code: 'floral_decoration', name: 'Decoración Floral & Mantelería Fina', unitAmount: 180, perPerson: false, icon: Flower2 },
];
const EMPTY_GUESTS = [];

export function EventEditor({ eventId, onSaved, onCancel }) {
  const { state } = useHotel();
  const hotelGuests = state.guests ?? EMPTY_GUESTS;
  const hotelStays = state.stays || [];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [expectedVersion, setExpectedVersion] = useState(1);
  const [guestSearch, setGuestSearch] = useState('');
  const [conflictWarning, setConflictWarning] = useState(null);

  // Selected Services
  const [selectedServices, setSelectedServices] = useState({});

  // Default start time: Tomorrow at 18:00
  const getDefaultStartsAt = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  };

  const getDefaultEndsAt = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(22, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    spaceId: '',
    identityType: 'guest', // 'guest' | 'account'
    identityId: '',
    timeKind: 'time_bound',
    startsAt: getDefaultStartsAt(),
    endsAt: getDefaultEndsAt(),
    timezone: 'America/Lima',
    attendees: 20,
    estimatedAmount: 1500,
    recurrence: 'none',
    recurrenceWeeks: 4
  });

  useEffect(() => {
    const controller = new AbortController();
    const fetchSpaces = async () => {
      try {
        const sp = await eventsClient.getSpaces(controller.signal);
        if (controller.signal.aborted) return;
        setSpaces(sp);
        if (sp.length > 0) setFormData(prev => prev.spaceId ? prev : ({ ...prev, spaceId: sp[0].id }));
      } catch (e) {
        if (!controller.signal.aborted) console.error(e);
      }
    };
    fetchSpaces();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (eventId) {
      const fetchEvent = async () => {
        try {
          setLoading(true);
          const ev = await eventsClient.getEventDetail(eventId, controller.signal);
          if (controller.signal.aborted) return;
          setExpectedVersion(ev.version);

          // Restore services
          const servMap = {};
          (ev.services || []).forEach(s => {
            servMap[s.serviceCode] = {
              code: s.serviceCode,
              quantity: s.quantity || 1,
              unitAmount: Number(s.unitAmount || 0),
              notes: s.notes || ''
            };
          });
          setSelectedServices(servMap);

          setFormData({
            title: ev.title || '',
            description: ev.description || '',
            spaceId: ev.spaceId || '',
            identityType: ev.guestId ? 'guest' : 'account',
            identityId: ev.guestId || ev.customerAccountId || '',
            timeKind: ev.timeKind || 'time_bound',
            startsAt: ev.startsAt ? ev.startsAt.slice(0, 16) : getDefaultStartsAt(),
            endsAt: ev.endsAt ? ev.endsAt.slice(0, 16) : getDefaultEndsAt(),
            timezone: ev.timezone || 'America/Lima',
            attendees: ev.attendees || 1,
            estimatedAmount: ev.estimatedAmount ? parseFloat(ev.estimatedAmount) : 0,
            recurrence: 'none',
            recurrenceWeeks: 4
          });
        } catch (e) {
          if (!controller.signal.aborted) setError(e.message);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      };
      fetchEvent();
    } else {
      if (hotelGuests.length > 0) {
        setFormData(prev => ({ ...prev, identityId: hotelGuests[0].id }));
      }
    }
    return () => controller.abort();
  }, [eventId, hotelGuests]);

  const selectedSpace = useMemo(() => {
    return spaces.find(s => s.id === formData.spaceId);
  }, [spaces, formData.spaceId]);

  // Real-time Space Conflict Detection
  const verifyAvailability = useCallback(async (spaceId, startsAt, endsAt) => {
    if (!spaceId || !startsAt || !endsAt) return;
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (start >= end) return;

    try {
      setCheckingConflict(true);
      const res = await eventsClient.checkSpaceAvailability(
        spaceId,
        start.toISOString(),
        end.toISOString(),
        eventId || undefined
      );

      if (!res.isAvailable && res.conflictingEvent) {
        setConflictWarning(res.conflictingEvent);
      } else {
        setConflictWarning(null);
      }
    } catch (err) {
      console.warn('Conflict check error:', err);
    } finally {
      setCheckingConflict(false);
    }
  }, [eventId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      verifyAvailability(formData.spaceId, formData.startsAt, formData.endsAt);
    }, 400);
    return () => clearTimeout(timer);
  }, [formData.spaceId, formData.startsAt, formData.endsAt, verifyAvailability]);

  // Duration in hours calculation
  const durationInfo = useMemo(() => {
    if (!formData.startsAt || !formData.endsAt) return null;
    const start = new Date(formData.startsAt);
    const end = new Date(formData.endsAt);
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return { isValid: false, text: 'La fecha de fin debe ser posterior al inicio' };
    const diffHours = diffMs / (1000 * 60 * 60);
    const hours = Math.floor(diffHours);
    const minutes = Math.round((diffHours - hours) * 60);
    
    let text = '';
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      text = `${days} día${days > 1 ? 's' : ''} ${remHours > 0 ? `y ${remHours}h` : ''}`;
    } else {
      text = `${hours} hora${hours !== 1 ? 's' : ''} ${minutes > 0 ? `y ${minutes} min` : ''}`;
    }
    return { isValid: true, hours: diffHours, text };
  }, [formData.startsAt, formData.endsAt]);

  const isOverCapacity = useMemo(() => {
    if (!selectedSpace || !selectedSpace.capacity) return false;
    return Number(formData.attendees) > Number(selectedSpace.capacity);
  }, [selectedSpace, formData.attendees]);

  // Filtered hotel guests
  const filteredGuests = useMemo(() => {
    if (!guestSearch.trim()) return hotelGuests;
    const q = guestSearch.toLowerCase();
    return hotelGuests.filter(g => 
      `${g.firstName || ''} ${g.lastName || ''} ${g.name || ''}`.toLowerCase().includes(q) ||
      (g.documentNumber || '').includes(q) ||
      (g.email || '').toLowerCase().includes(q)
    );
  }, [hotelGuests, guestSearch]);

  const toggleService = (svc) => {
    setSelectedServices(prev => {
      const updated = { ...prev };
      if (updated[svc.code]) {
        delete updated[svc.code];
      } else {
        updated[svc.code] = {
          code: svc.code,
          name: svc.name,
          quantity: svc.perPerson ? Number(formData.attendees || 1) : 1,
          unitAmount: svc.unitAmount,
          perPerson: svc.perPerson
        };
      }
      return updated;
    });
  };

  const updateServiceQty = (code, qty) => {
    setSelectedServices(prev => {
      if (!prev[code]) return prev;
      return {
        ...prev,
        [code]: { ...prev[code], quantity: Math.max(1, qty) }
      };
    });
  };

  // Auto calculate total budget based on Space Base Rate + Services
  const calculatedBudget = useMemo(() => {
    const base = selectedSpace?.baseRate ? Number(selectedSpace.baseRate) : 0;
    const servicesTotal = Object.values(selectedServices).reduce((sum, s) => {
      const qty = s.perPerson ? Number(formData.attendees || 1) : Number(s.quantity || 1);
      return sum + (Number(s.unitAmount || 0) * qty);
    }, 0);
    return base + servicesTotal;
  }, [selectedSpace, selectedServices, formData.attendees]);

  const applyCalculatedBudget = () => {
    setFormData(prev => ({ ...prev, estimatedAmount: calculatedBudget }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const applyTemplate = (tpl) => {
    setFormData(prev => {
      const start = new Date(prev.startsAt || new Date());
      const end = new Date(start);
      end.setHours(start.getHours() + tpl.hours);

      return {
        ...prev,
        title: tpl.title,
        timeKind: tpl.kind,
        endsAt: end.toISOString().slice(0, 16)
      };
    });
  };

  const adjustDuration = (addedHours) => {
    if (!formData.startsAt) return;
    const start = new Date(formData.startsAt);
    const end = new Date(start);
    end.setHours(start.getHours() + addedHours);
    setFormData(prev => ({ ...prev, endsAt: end.toISOString().slice(0, 16) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!durationInfo || !durationInfo.isValid) {
      setError('Verifique las fechas: La fecha y hora de finalización debe ser posterior a la de inicio.');
      setLoading(false);
      return;
    }

    if (!formData.identityId) {
      setError('Debe seleccionar o especificar un huésped o titular de la reserva.');
      setLoading(false);
      return;
    }

    if (conflictWarning) {
      const proceed = window.confirm(`¡Atención! El salón ya cuenta con el evento "${conflictWarning.title}" en este horario. ¿Desea continuar de todos modos?`);
      if (!proceed) {
        setLoading(false);
        return;
      }
    }

    try {
      const servicesPayload = Object.values(selectedServices).map(s => ({
        code: s.code,
        quantity: s.perPerson ? Number(formData.attendees || 1) : Number(s.quantity || 1),
        unitAmount: s.unitAmount,
        totalAmount: s.unitAmount * (s.perPerson ? Number(formData.attendees || 1) : Number(s.quantity || 1))
      }));

      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || undefined,
        spaceId: formData.spaceId,
        timeKind: formData.timeKind,
        startsAt: new Date(formData.startsAt).toISOString(),
        endsAt: new Date(formData.endsAt).toISOString(),
        timezone: formData.timezone,
        attendees: parseInt(formData.attendees, 10) || 1,
        estimatedAmount: parseFloat(formData.estimatedAmount) || calculatedBudget || 0,
        services: servicesPayload
      };

      if (formData.identityType === 'guest') {
        payload.guestId = formData.identityId;
        if (eventId) payload.customerAccountId = null;
      } else {
        payload.customerAccountId = formData.identityId;
        if (eventId) payload.guestId = null;
      }

      if (eventId) {
        await eventsClient.updateEvent(eventId, expectedVersion, payload);
      } else {
        await eventsClient.createEvent(payload);
      }
      onSaved();
    } catch (err) {
      if (err.message && err.message.includes('IDEMPOTENCY_KEY_REUSED')) {
        setError('Ya existe una operación en curso con esta clave. Intente nuevamente.');
      } else {
        setError(err.message || 'Error guardando el evento. Verifique conflictos de disponibilidad o si el espacio está ocupado.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view-container event-editor-view">
      {/* Top Header */}
      <div className="event-editor-header">
        <div>
          <button 
            type="button" 
            onClick={onCancel}
            className="btn btn-outline event-editor-back-button"
          >
            <ArrowLeft size={14} /> Volver a la agenda
          </button>
          <div className="event-editor-kicker">
            <Sparkles size={14} /> Gestión de Salones, Banquetería & Eventos 5★
          </div>
          <h2 className="event-editor-title">
            {eventId ? 'Editar Reserva de Evento' : 'Registrar Nuevo Evento'}
          </h2>
          <p className="event-editor-description">
            Complete los datos del anfitrión, selección del salón, paquetes de catering de cocina/bar y horarios de servicio.
          </p>
        </div>
      </div>

      {/* Conflict Warning Alert */}
      {conflictWarning && (
        <div className="event-editor-alert event-editor-conflict-alert">
          <AlertTriangle size={22} color="#D97706" />
          <div className="event-editor-alert-content">
            <span>⚠️ Conflicto de Disponibilidad: El salón ya tiene agendado el evento <strong>"{conflictWarning.title}"</strong> ({new Date(conflictWarning.startsAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} a {new Date(conflictWarning.endsAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}).</span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="event-editor-alert event-editor-error-alert">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Quick Templates Bar */}
      {!eventId && (
        <div className="event-editor-templates">
          <span className="event-editor-templates-label">
            Plantillas Rápidas de Evento:
          </span>
          <div className="event-editor-template-list">
            {QUICK_TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="event-editor-template-button"
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="event-editor-form">
        
        {/* SECTION 1: Información General & Espacio */}
        <div className="card event-editor-card">
          <div className="event-editor-section-heading">
            <Layers size={20} color="#D97706" />
            <h3 className="event-editor-section-title">1. Información del Evento & Salón</h3>
          </div>

          <div className="event-editor-grid event-editor-grid-two event-editor-grid-spaced">
            <P1Input 
              label="Título del Evento *" 
              name="title" 
              value={formData.title} 
              onChange={handleChange} 
              placeholder="Ej: Banquete Anual Grupo Gloria, Boda Civil..."
              required 
            />

            <div>
              <P1Select 
                label="Salón / Espacio Asignado *" 
                name="spaceId" 
                value={formData.spaceId} 
                onChange={handleChange}
                required
              >
                <option value="">-- Seleccione un Salón --</option>
                {spaces.map(sp => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name} {sp.capacity ? `(Capacidad: ${sp.capacity} personas)` : ''}
                  </option>
                ))}
              </P1Select>

              {selectedSpace && (
                <div className="event-editor-space-meta">
                  <P1Badge variant="gold">
                    <Users size={12} /> Aforo: {selectedSpace.capacity || 'N/A'} pers.
                  </P1Badge>
                  {selectedSpace.baseRate && (
                    <P1Badge variant="neutral">
                      <DollarSign size={12} /> Tarifa Base: S/ {selectedSpace.baseRate}
                    </P1Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="event-editor-grid event-editor-grid-two">
            <P1Select
              label="Tipo de Modalidad *"
              name="timeKind"
              value={formData.timeKind}
              onChange={handleChange}
            >
              <option value="time_bound">Por horas (Con horario específico)</option>
              <option value="full_day">Día completo (Jornada entera)</option>
              <option value="multi_day">Varios días (Evento continuo)</option>
            </P1Select>

            <div className="event-editor-field">
              <label className="event-editor-field-label">
                Descripción / Notas de Coordinación
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Ej: Proyector 4K, catering 3 tiempos, sonido y luces..."
                className="event-editor-text-input"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Anfitrión / Titular */}
        <div className="card event-editor-card">
          <div className="event-editor-section-heading event-editor-section-heading-between">
            <div className="event-editor-section-heading-content">
              <UserCheck size={20} color="#D97706" />
              <h3 className="event-editor-section-title">2. Anfitrión & Titular de la Reserva</h3>
            </div>
            
            {/* Segmented Control */}
            <div className="event-editor-segmented-control">
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, identityType: 'guest', identityId: hotelGuests[0]?.id || '' }))}
                className={`event-editor-segment-button${formData.identityType === 'guest' ? ' is-selected' : ''}`}
              >
                👤 Huésped del Hotel
              </button>
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, identityType: 'account', identityId: '' }))}
                className={`event-editor-segment-button${formData.identityType === 'account' ? ' is-selected' : ''}`}
              >
                🏢 Cliente Externo / Corporativo
              </button>
            </div>
          </div>

          {formData.identityType === 'guest' ? (
            <div>
              <div className="event-editor-grid event-editor-grid-guest">
                <div>
                  <label className="event-editor-field-label">
                    Seleccionar Huésped Registrado *
                  </label>
                  <select
                    value={formData.identityId}
                    onChange={(e) => setFormData(p => ({ ...p, identityId: e.target.value }))}
                    className="event-editor-select"
                    required
                  >
                    <option value="">-- Seleccionar Huésped --</option>
                    {filteredGuests.map(g => {
                      const guestName = g.firstName ? `${g.firstName} ${g.lastName}` : (g.name || 'Huésped');
                      const doc = g.documentNumber ? ` · DNI/Doc: ${g.documentNumber}` : '';
                      const stay = hotelStays.find(s => s.guestId === g.id && s.status === 'En Curso');
                      const room = stay ? ` · Hab: ${stay.roomNumber || stay.roomId}` : '';
                      return (
                        <option key={g.id} value={g.id}>
                          {guestName} {doc} {room}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="event-editor-field-label">
                    Filtrar lista de huéspedes
                  </label>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o DNI..."
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    className="event-editor-text-input"
                  />
                </div>
              </div>
              <span className="event-editor-helper-text">
                💡 El evento quedará vinculado al perfil del huésped y sus consumos podrán ser cargados a su folio de habitación.
              </span>
            </div>
          ) : (
            <div>
              <P1Input
                label="Identificador de Cuenta de Cliente / Empresa (ID Comercial) *"
                name="identityId"
                value={formData.identityId}
                onChange={handleChange}
                placeholder="Ej: Ingrese el ID de cliente o cuenta comercial"
                required
                helperText="Identificador del cliente o empresa contratante."
              />
            </div>
          )}
        </div>

        {/* SECTION 3: Fechas, Horarios & Duración */}
        <div className="card event-editor-card">
          <div className="event-editor-section-heading event-editor-section-heading-between">
            <div className="event-editor-section-heading-content">
              <Clock size={20} color="#D97706" />
              <h3 className="event-editor-section-title">3. Fechas, Horarios & Duración</h3>
            </div>

            {durationInfo && durationInfo.isValid && (
              <P1Badge variant="success" className="p1-badge-prominent">
                <Clock size={13} /> Duración: {durationInfo.text}
              </P1Badge>
            )}
          </div>

          <div className="event-editor-grid event-editor-grid-three event-editor-grid-spaced">
            <P1Input 
              type="datetime-local" 
              label="Fecha y Hora de Inicio *" 
              name="startsAt" 
              value={formData.startsAt} 
              onChange={handleChange} 
              required 
            />
            <P1Input 
              type="datetime-local" 
              label="Fecha y Hora de Fin *" 
              name="endsAt" 
              value={formData.endsAt} 
              onChange={handleChange} 
              required 
            />
            <P1Select 
              label="Zona Horaria *" 
              name="timezone" 
              value={formData.timezone} 
              onChange={handleChange}
            >
              <option value="America/Lima">America/Lima (UTC-5 - Perú)</option>
              <option value="America/Bogota">America/Bogotá (UTC-5)</option>
              <option value="America/Santiago">America/Santiago (UTC-4)</option>
              <option value="UTC">UTC</option>
            </P1Select>
          </div>

          {/* Quick Duration Presets */}
          <div className="event-editor-duration-presets">
            <span className="event-editor-muted-label">Ajuste rápido de duración:</span>
            {[
              { label: '+2 Horas', hours: 2 },
              { label: '+4 Horas', hours: 4 },
              { label: '+6 Horas', hours: 6 },
              { label: '+8 Horas (Jornada Completa)', hours: 8 },
              { label: '+24 Horas', hours: 24 },
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => adjustDuration(p.hours)}
                className="event-editor-duration-button"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 4: Paquetes de Catering & Servicios del Salón (Recomendación 1) */}
        <div className="card event-editor-card">
          <div className="event-editor-section-heading event-editor-section-heading-between">
            <div className="event-editor-section-heading-content">
              <UtensilsCrossed size={20} color="#D97706" />
              <h3 className="event-editor-section-title">4. Paquetes de Catering & Servicios del Salón</h3>
            </div>
            <P1Badge variant="gold">
              Conectado a Cocina y Bar
            </P1Badge>
          </div>

          <p className="event-editor-section-copy">
            Seleccione los servicios de banquetería, coffee break y tecnología que se prepararán para el evento:
          </p>

          <div className="event-editor-services-grid">
            {STANDARD_CATERING_SERVICES.map(svc => {
              const isSelected = !!selectedServices[svc.code];
              const Icon = svc.icon;
              const currentQty = isSelected ? (svc.perPerson ? Number(formData.attendees || 1) : selectedServices[svc.code].quantity) : (svc.perPerson ? Number(formData.attendees || 1) : 1);
              const subtotal = svc.unitAmount * currentQty;

              return (
                <div
                  key={svc.code}
                  onClick={() => toggleService(svc)}
                  className={`event-editor-service${isSelected ? ' is-selected' : ''}`}
                >
                  <div className="event-editor-service-main">
                    <div className="event-editor-service-icon">
                      <Icon size={18} />
                    </div>
                    <div>
                      <strong className="event-editor-service-name">{svc.name}</strong>
                      <span className="event-editor-service-meta">
                        S/ {svc.unitAmount.toFixed(2)} {svc.perPerson ? 'por persona' : 'tarifa plana'}
                      </span>
                    </div>
                  </div>

                  <div className="event-editor-service-total" onClick={e => e.stopPropagation()}>
                    <span className="event-editor-service-price">
                      S/ {subtotal.toFixed(2)}
                    </span>
                    {!svc.perPerson && isSelected && (
                      <div className="event-editor-quantity-controls">
                        <button type="button" onClick={() => updateServiceQty(svc.code, currentQty - 1)} className="event-editor-quantity-button">-</button>
                        <span className="event-editor-quantity-value">{currentQty}</span>
                        <button type="button" onClick={() => updateServiceQty(svc.code, currentQty + 1)} className="event-editor-quantity-button">+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 5: Aforo, Presupuesto & Recurrencia */}
        <div className="card event-editor-card">
          <div className="event-editor-section-heading">
            <DollarSign size={20} color="#D97706" />
            <h3 className="event-editor-section-title">5. Asistentes, Presupuesto & Recurrencia</h3>
          </div>

          <div className="event-editor-grid event-editor-grid-three">
            <div>
              <P1Input 
                type="number" 
                label="Asistentes Esperados *" 
                name="attendees" 
                value={formData.attendees} 
                onChange={handleChange} 
                min="1" 
                required
              />
              {isOverCapacity && (
                <div className="event-editor-capacity-warning">
                  <AlertTriangle size={13} /> Supera el aforo máximo de {selectedSpace?.capacity} personas.
                </div>
              )}
            </div>

            <div>
              <P1Input 
                type="number" 
                step="0.01" 
                label="Importe / Presupuesto Estimado (S/)" 
                name="estimatedAmount" 
                value={formData.estimatedAmount} 
                onChange={handleChange} 
                min="0"
              />
              {calculatedBudget > 0 && (
                <button
                  type="button"
                  onClick={applyCalculatedBudget}
                  className="event-editor-budget-link"
                >
                  Usar presupuesto sugerido (S/ {calculatedBudget.toFixed(2)})
                </button>
              )}
            </div>

            <P1Select 
              label="Recurrencia del Evento" 
              name="recurrence" 
              value={formData.recurrence} 
              onChange={handleChange}
            >
              <option value="none">Sin recurrencia (Evento único)</option>
              <option value="weekly">Semanal (Mismo día y hora)</option>
            </P1Select>
          </div>

          {formData.recurrence === 'weekly' && (
            <div className="event-editor-recurrence-alert">
              <Repeat size={18} color="#B45309" />
              <div className="event-editor-alert-content">
                <span className="event-editor-recurrence-title">Repetición Semanal</span>
                <span className="event-editor-recurrence-copy">Se generarán instancias automáticas para las semanas indicadas.</span>
              </div>
              <div className="event-editor-recurrence-weeks">
                <P1Input 
                  type="number" 
                  label="Semanas a repetir" 
                  name="recurrenceWeeks" 
                  value={formData.recurrenceWeeks} 
                  onChange={handleChange} 
                  min="1" 
                  max="52" 
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 6: Summary & Final Buttons */}
        <div className="event-editor-footer">
          <button 
            type="button" 
            onClick={onCancel}
            className="btn btn-outline event-editor-cancel-button"
          >
            Cancelar
          </button>

          <div className="event-editor-submit-actions">
            <button 
              type="submit" 
              disabled={loading}
              className="btn btn-primary event-editor-submit-button"
            >
              <CheckCircle2 size={18} />
              {loading ? 'Guardando Evento...' : eventId ? 'Actualizar Evento' : 'Crear y Agendar Evento'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
