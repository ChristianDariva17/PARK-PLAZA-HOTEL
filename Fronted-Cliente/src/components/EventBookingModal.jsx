import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, AlertTriangle, LogIn, Calendar, Users, DollarSign, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import { createEventPreReservation, getEventSpacePolicy, getEventSpaces, quoteEvent } from '../api';
import { useAuth } from '../AuthContext';

const money = (amount) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(amount || 0));

export default function EventBookingModal({ data, onClose }) {
  const navigate = useNavigate();
  const { customer } = useAuth();
  const [spaces, setSpaces] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  // Default start date: tomorrow at 18:00, end date: tomorrow at 23:00
  const [form, setForm] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    return {
      title: '',
      description: '',
      spaceId: '',
      attendees: 20,
      eventStartsAt: `${dateStr}T18:00`,
      eventEndsAt: `${dateStr}T23:00`,
      timezone: 'America/Lima',
      services: [],
    };
  });

  useEffect(() => {
    getEventSpaces()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.spaces || [];
        setSpaces(list);
        if (list.length > 0 && !form.spaceId) {
          setForm((f) => ({ ...f, spaceId: list[0].id }));
        }
      })
      .catch((err) => setError(err.message || 'No se pudieron cargar los ambientes de eventos.'));
  }, []);

  useEffect(() => {
    if (!form.spaceId) {
      setPolicy(null);
      return;
    }
    getEventSpacePolicy(form.spaceId)
      .then(setPolicy)
      .catch((err) => setError(err.message || 'No se pudo cargar la política del ambiente.'));
  }, [form.spaceId]);

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setQuote(null); // Reset quotation when form inputs change
  };

  const toggleService = (code) => {
    setForm((current) => ({
      ...current,
      services: current.services.some((service) => service.code === code)
        ? current.services.filter((service) => service.code !== code)
        : [...current.services, { code, quantity: 1 }],
    }));
    setQuote(null);
  };

  const requestQuote = async (e) => {
    if (e) e.preventDefault();
    if (!customer) {
      navigate('/login');
      return;
    }
    if (!form.title.trim()) {
      setError('Por favor ingrese el nombre del evento.');
      return;
    }
    if (!form.spaceId) {
      setError('Por favor seleccione un ambiente para el evento.');
      return;
    }

    setBusy(true);
    setError('');
    setCreated(null);
    try {
      const q = await quoteEvent({
        ...form,
        attendees: Number(form.attendees),
        eventStartsAt: new Date(form.eventStartsAt).toISOString(),
        eventEndsAt: new Date(form.eventEndsAt).toISOString(),
      });
      setQuote(q);
    } catch (err) {
      setError(err.message || 'No se pudo calcular la cotización.');
    } finally {
      setBusy(false);
    }
  };

  const reserve = async () => {
    if (!customer) {
      navigate('/login');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await createEventPreReservation(
        {
          ...form,
          attendees: Number(form.attendees),
          eventStartsAt: new Date(form.eventStartsAt).toISOString(),
          eventEndsAt: new Date(form.eventEndsAt).toISOString(),
        },
        crypto.randomUUID()
      );
      setCreated(res);
    } catch (err) {
      setError(err.message || 'No se pudo registrar la pre-reserva del evento.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="amenity-modal-overlay" onClick={onClose}>
      <div 
        className="amenity-modal" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '680px', width: '92vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Top image banner */}
        <div className="amenity-modal-top" style={{ backgroundImage: `url(${data?.image || '/images/zona_eventos.png'})`, minHeight: '130px' }}>
          <button className="amenity-modal-close" onClick={onClose}><X size={14} /></button>
          <div className="amenity-modal-top-content">
            <span className="amenity-modal-tag">{data?.place || 'Celebraciones'}</span>
            <h2 className="amenity-modal-title">{data?.title || 'ZONA DE EVENTOS'}</h2>
          </div>
        </div>

        {/* Modal body */}
        <div className="amenity-modal-body" style={{ overflowY: 'auto', flex: 1, padding: '24px' }}>
          {created ? (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <CheckCircle2 size={52} color="var(--color-gold)" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', marginBottom: '8px', color: 'var(--color-gold)' }}>
                ¡Pre-Reserva Registrada con Éxito!
              </h3>
              <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginBottom: '20px', lineHeight: '1.6' }}>
                Su solicitud para <strong>"{created.title || form.title}"</strong> ha sido registrada.
                El ambiente queda bloqueado de forma temporal hasta el{' '}
                <strong>{new Date(created.expiresAt).toLocaleString('es-PE')}</strong>.
              </p>

              <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left', fontSize: '13.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Ambiente:</span>
                  <strong>{spaces.find((s) => s.id === form.spaceId)?.name || 'Salón de Eventos'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--color-muted)' }}>Asistentes:</span>
                  <strong>{form.attendees} personas</strong>
                </div>
                {quote?.pricing?.depositAmount && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(212, 175, 55, 0.2)', paddingTop: '8px', marginTop: '8px' }}>
                    <span style={{ color: 'var(--color-gold)', fontWeight: 'bold' }}>Adelanto Requerido:</span>
                    <strong style={{ color: 'var(--color-gold)', fontSize: '15px' }}>{money(quote.pricing.depositAmount)}</strong>
                  </div>
                )}
                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--color-muted)' }}>
                  📌 Comuníquese con recepción o el área de eventos del resort para coordinar el abono y confirmar definitivamente la fecha.
                </div>
              </div>

              <button 
                className="gold-btn-solid full-width" 
                style={{ padding: '14px', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={onClose}
              >
                Entendido y Cerrar
              </button>
            </div>
          ) : !customer ? (
            <div style={{ textAlign: 'center', padding: '24px 12px' }}>
              <Users size={44} color="var(--color-gold)" style={{ margin: '0 auto 14px' }} />
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', marginBottom: '8px' }}>
                Reserve su Evento Exclusivo
              </h3>
              <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginBottom: '22px', lineHeight: '1.5' }}>
                Para solicitar cotizaciones en vivo y pre-reservar nuestros salones de eventos, por favor inicie sesión o cree su cuenta gratuita.
              </p>
              <button 
                className="gold-btn-solid full-width" 
                style={{ padding: '13px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }} 
                onClick={() => navigate('/login')}
              >
                <LogIn size={16} /> Iniciar Sesión en el Portal
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div style={{ color: '#ef4444', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '10px 14px', borderRadius: '8px' }}>
                  {error}
                </div>
              )}

              {/* Formulario */}
              <form onSubmit={requestQuote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--color-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Nombre del Evento *
                    </label>
                    <input
                      required
                      placeholder="Ej. Boda Civil, Conferencia Anual..."
                      value={form.title}
                      onChange={(e) => update('title', e.target.value)}
                      className="luxury-input full-width"
                      style={{ fontSize: '13.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--color-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Ambiente / Salón *
                    </label>
                    <select
                      required
                      value={form.spaceId}
                      onChange={(e) => update('spaceId', e.target.value)}
                      className="luxury-select full-width"
                      style={{ fontSize: '13.5px' }}
                    >
                      <option value="">Seleccione ambiente...</option>
                      {spaces.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.name} (Capacidad: {space.capacity || 'Flexible'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--color-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Inicio del Evento *
                    </label>
                    <input
                      required
                      type="datetime-local"
                      value={form.eventStartsAt}
                      onChange={(e) => update('eventStartsAt', e.target.value)}
                      className="luxury-select full-width"
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--color-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Fin del Evento *
                    </label>
                    <input
                      required
                      type="datetime-local"
                      value={form.eventEndsAt}
                      onChange={(e) => update('eventEndsAt', e.target.value)}
                      className="luxury-select full-width"
                      style={{ fontSize: '13px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--color-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Asistentes *
                    </label>
                    <input
                      required
                      min="1"
                      type="number"
                      value={form.attendees}
                      onChange={(e) => update('attendees', e.target.value)}
                      className="luxury-input full-width"
                      style={{ fontSize: '13.5px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--color-muted)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Descripción / Notas
                    </label>
                    <input
                      placeholder="Montaje especial, equipo multimedia, etc."
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                      className="luxury-input full-width"
                      style={{ fontSize: '13.5px' }}
                    />
                  </div>
                </div>

                {/* Servicios Opcionales */}
                {policy?.services && policy.services.length > 0 && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px 14px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--color-gold)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                      Servicios Adicionales Disponibles
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                      {policy.services.map((service) => {
                        const isSelected = form.services.some((item) => item.code === service.code);
                        return (
                          <label
                            key={service.code}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12.5px',
                              cursor: 'pointer',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              background: isSelected ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                              border: isSelected ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid transparent',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleService(service.code)}
                            />
                            <span>{service.name} <strong>(+{money(service.unitAmount)})</strong></span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Botón de Cotización */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="submit"
                    className="gold-btn-solid"
                    style={{ padding: '10px 22px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                    disabled={busy}
                  >
                    {busy ? 'Calculando cotización...' : 'Calcular Cotización en Vivo'}
                  </button>
                </div>
              </form>

              {/* Tarjeta de Cotización y Confirmación */}
              {quote && (
                <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.35)', borderRadius: '12px', padding: '16px', marginTop: '10px' }}>
                  <h4 style={{ margin: '0 0 12px', fontSize: '15px', color: 'var(--color-gold)', fontFamily: 'var(--font-serif)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    💎 Desglose de Cotización
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-muted)' }}>Tarifa Base del Salón:</span>
                      <strong>{money(quote.pricing.baseAmount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-muted)' }}>Servicios y Limpieza:</span>
                      <strong>{money(quote.pricing.servicesAmount + quote.pricing.cleaningAmount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-muted)' }}>Impuestos de Ley:</span>
                      <strong>{money(quote.pricing.taxAmount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(212, 175, 55, 0.25)', paddingTop: '8px', marginTop: '4px', fontSize: '16px' }}>
                      <span style={{ fontWeight: 'bold' }}>Total Estimado:</span>
                      <strong style={{ color: 'var(--color-gold)', fontSize: '18px' }}>{money(quote.pricing.totalAmount)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-muted)', fontSize: '12px', marginTop: '2px' }}>
                      <span>Adelanto para Confirmar:</span>
                      <strong style={{ color: '#fff' }}>{money(quote.pricing.depositAmount)}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="gold-btn-solid"
                      style={{ padding: '12px 28px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '13.5px' }}
                      onClick={reserve}
                      disabled={busy}
                    >
                      {busy ? 'Generando pre-reserva...' : 'Confirmar Pre-Reserva'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
