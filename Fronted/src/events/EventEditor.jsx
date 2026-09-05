import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  Clock, 
  Users, 
  DollarSign, 
  MapPin, 
  UserCheck, 
  Building2, 
  Sparkles, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  FileText,
  Layers,
  Repeat,
  UtensilsCrossed,
  Coffee,
  Wine,
  Tv,
  Mic,
  Flower2,
  Plus,
  Minus
} from 'lucide-react';
import { P1Button, P1Input, P1Select, P1Badge } from '../components/ui/P1Atoms';
import { eventsClient } from './eventsClient';
import { useHotel } from '../state/hotelContext.js';
import { formatMoney } from '../domain/hotelModel.js';

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

export function EventEditor({ eventId, onSaved, onCancel }) {
  const { state } = useHotel();
  const hotelGuests = state.guests || [];
  const hotelStays = state.stays || [];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [spaces, setSpaces] = useState([]);
  const [expectedVersion, setExpectedVersion] = useState(1);
  const [guestSearch, setGuestSearch] = useState('');
  const [conflictWarning, setConflictWarning] = useState(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

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
    const fetchSpaces = async () => {
      try {
        const sp = await eventsClient.getSpaces();
        setSpaces(sp);
        if (sp.length > 0 && !formData.spaceId) {
          setFormData(prev => ({ ...prev, spaceId: sp[0].id }));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchSpaces();

    if (eventId) {
      const fetchEvent = async () => {
        try {
          setLoading(true);
          const ev = await eventsClient.getEventDetail(eventId);
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
          setError(e.message);
        } finally {
          setLoading(false);
        }
      };
      fetchEvent();
    } else {
      if (hotelGuests.length > 0) {
        setFormData(prev => ({ ...prev, identityId: hotelGuests[0].id }));
      }
    }
  }, [eventId]);

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
    <div className="view-container" style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 60 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <button 
            type="button" 
            onClick={onCancel}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 14px', fontSize: 13 }}
          >
            <ArrowLeft size={14} /> Volver a la agenda
          </button>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D97706', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} /> Gestión de Salones, Banquetería & Eventos 5★
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#1E3A8A', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            {eventId ? 'Editar Reserva de Evento' : 'Registrar Nuevo Evento'}
          </h2>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 13.5 }}>
            Complete los datos del anfitrión, selección del salón, paquetes de catering de cocina/bar y horarios de servicio.
          </p>
        </div>
      </div>

      {/* Conflict Warning Alert */}
      {conflictWarning && (
        <div style={{ padding: '14px 18px', background: '#FEF3C7', border: '1.5px solid #F59E0B', color: '#92400E', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13.5, fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <AlertTriangle size={22} color="#D97706" />
          <div style={{ flex: 1 }}>
            <span>⚠️ Conflicto de Disponibilidad: El salón ya tiene agendado el evento <strong>"{conflictWarning.title}"</strong> ({new Date(conflictWarning.startsAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} a {new Date(conflictWarning.endsAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}).</span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div style={{ padding: '14px 18px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, fontWeight: 600 }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Quick Templates Bar */}
      {!eventId && (
        <div style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(30, 58, 138, 0.04))', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: 14, padding: '14px 18px', marginBottom: 22 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: '0.05em' }}>
            Plantillas Rápidas de Evento:
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {QUICK_TEMPLATES.map((tpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tpl)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  color: '#111827',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* SECTION 1: Información General & Espacio */}
        <div className="card" style={{ padding: 24, borderRadius: 16, border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
            <Layers size={20} color="#D97706" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>1. Información del Evento & Salón</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
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
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A' }}>
                Descripción / Notas de Coordinación
              </label>
              <input
                type="text"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Ej: Proyector 4K, catering 3 tiempos, sonido y luces..."
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid #E5E7EB',
                  fontSize: 13.5,
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Anfitrión / Titular */}
        <div className="card" style={{ padding: 24, borderRadius: 16, border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <UserCheck size={20} color="#D97706" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>2. Anfitrión & Titular de la Reserva</h3>
            </div>
            
            {/* Segmented Control */}
            <div style={{ display: 'flex', background: '#F3F4F6', padding: '3px', borderRadius: 10 }}>
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, identityType: 'guest', identityId: hotelGuests[0]?.id || '' }))}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: formData.identityType === 'guest' ? '#FFFFFF' : 'transparent',
                  color: formData.identityType === 'guest' ? '#1E3A8A' : '#6B7280',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: formData.identityType === 'guest' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                👤 Huésped del Hotel
              </button>
              <button
                type="button"
                onClick={() => setFormData(p => ({ ...p, identityType: 'account', identityId: '' }))}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: formData.identityType === 'account' ? '#FFFFFF' : 'transparent',
                  color: formData.identityType === 'account' ? '#1E3A8A' : '#6B7280',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  boxShadow: formData.identityType === 'account' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                🏢 Cliente Externo / Corporativo
              </button>
            </div>
          </div>

          {formData.identityType === 'guest' ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                    Seleccionar Huésped Registrado *
                  </label>
                  <select
                    value={formData.identityId}
                    onChange={(e) => setFormData(p => ({ ...p, identityId: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #E5E7EB',
                      fontSize: 14,
                      color: '#111827',
                      background: '#FFFFFF',
                      outline: 'none'
                    }}
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
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                    Filtrar lista de huéspedes
                  </label>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o DNI..."
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: '1px solid #E5E7EB',
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
              <span style={{ fontSize: 11.5, color: '#6B7280', marginTop: 6, display: 'block' }}>
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
        <div className="card" style={{ padding: 24, borderRadius: 16, border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={20} color="#D97706" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>3. Fechas, Horarios & Duración</h3>
            </div>

            {durationInfo && durationInfo.isValid && (
              <P1Badge variant="success" style={{ fontSize: 12.5, padding: '4px 12px' }}>
                <Clock size={13} /> Duración: {durationInfo.text}
              </P1Badge>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 14 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>Ajuste rápido de duración:</span>
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
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #E5E7EB',
                  background: '#F9FAFB',
                  color: '#4B5563',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION 4: Paquetes de Catering & Servicios del Salón (Recomendación 1) */}
        <div className="card" style={{ padding: 24, borderRadius: 16, border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <UtensilsCrossed size={20} color="#D97706" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>4. Paquetes de Catering & Servicios del Salón</h3>
            </div>
            <P1Badge variant="gold">
              Conectado a Cocina y Bar
            </P1Badge>
          </div>

          <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
            Seleccione los servicios de banquetería, coffee break y tecnología que se prepararán para el evento:
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {STANDARD_CATERING_SERVICES.map(svc => {
              const isSelected = !!selectedServices[svc.code];
              const Icon = svc.icon;
              const currentQty = isSelected ? (svc.perPerson ? Number(formData.attendees || 1) : selectedServices[svc.code].quantity) : (svc.perPerson ? Number(formData.attendees || 1) : 1);
              const subtotal = svc.unitAmount * currentQty;

              return (
                <div
                  key={svc.code}
                  onClick={() => toggleService(svc)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: `1.5px solid ${isSelected ? '#D97706' : '#E5E7EB'}`,
                    background: isSelected ? 'rgba(212, 175, 55, 0.05)' : '#F9FAFB',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ padding: 8, borderRadius: 8, background: isSelected ? '#FEF3C7' : '#FFFFFF', border: '1px solid #E5E7EB' }}>
                      <Icon size={18} color={isSelected ? '#D97706' : '#6B7280'} />
                    </div>
                    <div>
                      <strong style={{ fontSize: 13, color: '#111827', display: 'block' }}>{svc.name}</strong>
                      <span style={{ fontSize: 11.5, color: '#6B7280' }}>
                        S/ {svc.unitAmount.toFixed(2)} {svc.perPerson ? 'por persona' : 'tarifa plana'}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isSelected ? '#B45309' : '#4B5563', display: 'block' }}>
                      S/ {subtotal.toFixed(2)}
                    </span>
                    {!svc.perPerson && isSelected && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <button type="button" onClick={() => updateServiceQty(svc.code, currentQty - 1)} style={{ padding: '2px 6px', border: '1px solid #E5E7EB', borderRadius: 4, background: '#FFF', cursor: 'pointer' }}>-</button>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{currentQty}</span>
                        <button type="button" onClick={() => updateServiceQty(svc.code, currentQty + 1)} style={{ padding: '2px 6px', border: '1px solid #E5E7EB', borderRadius: 4, background: '#FFF', cursor: 'pointer' }}>+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 5: Aforo, Presupuesto & Recurrencia */}
        <div className="card" style={{ padding: 24, borderRadius: 16, border: '1px solid #E5E7EB', background: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
            <DollarSign size={20} color="#D97706" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>5. Asistentes, Presupuesto & Recurrencia</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
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
                <div style={{ fontSize: 11.5, color: '#B91C1C', marginTop: 4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
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
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#D97706',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: 4,
                    padding: 0,
                    textDecoration: 'underline'
                  }}
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
            <div style={{ marginTop: 14, padding: '12px 16px', background: '#FEF3C7', borderRadius: 10, border: '1px solid #FDE047', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Repeat size={18} color="#B45309" />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#92400E', display: 'block' }}>Repetición Semanal</span>
                <span style={{ fontSize: 11.5, color: '#B45309' }}>Se generarán instancias automáticas para las semanas indicadas.</span>
              </div>
              <div style={{ width: 140 }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
          <button 
            type="button" 
            className="btn btn-outline"
            onClick={onCancel}
            style={{ padding: '12px 24px', fontSize: 14, fontWeight: 700 }}
          >
            Cancelar
          </button>

          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              type="submit" 
              disabled={loading}
              className="btn btn-primary"
              style={{
                padding: '12px 32px',
                fontSize: 14,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}
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
