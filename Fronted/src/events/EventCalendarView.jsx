import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, MapPin, Sparkles, Filter } from 'lucide-react';
import { useEventsResource } from './useEventsResource';
import { eventsClient } from './eventsClient';
import { P1Button, P1Badge } from '../components/ui/P1Atoms';

const pad = (value) => String(value).padStart(2, '0');
const keyFor = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const statusLabels = { 
  confirmed: 'Confirmado', 
  tentative: 'Tentativo', 
  preparing: 'Preparación',
  in_progress: 'En Curso',
  cancelled: 'Cancelado', 
  completed: 'Completado', 
  archived: 'Archivado', 
  draft: 'Borrador' 
};

export function EventCalendarView({ onSelectEvent, onCreateEvent }) {
  const { events, loading, error } = useEventsResource();
  const [spaces, setSpaces] = useState([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState('all');
  const [month, setMonth] = useState(() => new Date());

  useEffect(() => {
    eventsClient.getSpaces().then(setSpaces).catch(console.error);
  }, []);

  const monthLabel = new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(month);
  
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
  }, [month]);

  const filteredEvents = useMemo(() => {
    if (selectedSpaceId === 'all') return events;
    return events.filter(e => e.spaceId === selectedSpaceId);
  }, [events, selectedSpaceId]);

  const eventsByDay = useMemo(() => filteredEvents.reduce((map, event) => { 
    const date = new Date(event.startsAt); 
    const key = keyFor(date); 
    (map[key] ||= []).push(event); 
    return map; 
  }, {}), [filteredEvents]);

  return (
    <div className="view-container events-module-view">
      {/* Top Header */}
      <header className="page-heading events-page-heading">
        <div>
          <span className="page-metadata events-page-metadata">
            Fechas, Horarios & Ocupación de Salones
          </span>
          <h2 className="events-page-title">
            Calendario de Eventos & Salones
          </h2>
          <p className="events-page-description">
            Visualice la ocupación de cada ambiente, detecte disponibilidad y gestione eventos directamente.
          </p>
        </div>
        <div className="page-actions events-page-actions">
          <P1Button onClick={onCreateEvent}>
            <Plus size={16} aria-hidden="true" /> Nuevo Evento
          </P1Button>
        </div>
      </header>

      {/* Filter by Space Bar */}
      <div className="events-filter-bar">
        <div className="events-filter-control">
          <MapPin size={16} color="#D97706" />
          <span className="events-filter-label">Filtrar por Salón:</span>
          <select
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
            className="events-filter-select"
          >
            <option value="all">-- Todos los Salones ({spaces.length}) --</option>
            {spaces.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="events-filter-result">
          Mostrando <strong>{filteredEvents.length}</strong> eventos agendados
        </div>
      </div>

      {error ? <div className="alert-banner alert-banner-danger" role="alert">{error}</div> : null}

      {/* Calendar Grid Shell */}
      <section className="card calendar-shell">
        <div className="calendar-toolbar events-calendar-toolbar">
          <button 
            className="calendar-nav" 
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} 
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="events-calendar-heading">
            <span className="section-kicker events-calendar-kicker">Agenda Mensual</span>
            <h3 className="events-calendar-title">
              {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
            </h3>
          </div>

          <button 
            className="calendar-nav" 
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} 
            aria-label="Mes siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-weekdays">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="calendar-grid">
          {days.map((day) => { 
            const dayEvents = eventsByDay[keyFor(day)] || []; 
            const inMonth = day.getMonth() === month.getMonth(); 
            const hasMultiple = dayEvents.length > 1;

            return (
              <div className={`calendar-day ${inMonth ? '' : 'calendar-day-muted'}`} key={keyFor(day)}>
                <div className="calendar-day-header">
                  <time dateTime={keyFor(day)}>{day.getDate()}</time>
                  {hasMultiple && inMonth && (
                    <span className="calendar-day-count">
                      {dayEvents.length} ev.
                    </span>
                  )}
                </div>

                {dayEvents.map((event) => (
                  <button 
                    className={`calendar-event calendar-event-${event.status}`} 
                    key={event.id} 
                    onClick={() => onSelectEvent(event.id)} 
                    title={`${event.title} · ${event.space?.name || 'Sin espacio'} (${new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: event.timezone || 'UTC' }).format(new Date(event.startsAt))})`}
                  >
                    <strong>
                      {new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: event.timezone || 'UTC' }).format(new Date(event.startsAt))}
                    </strong>
                    <span>{event.title}</span>
                  </button>
                ))}
              </div>
            ); 
          })}
        </div>
      </section>

      {/* Legend Footer */}
      <div className="calendar-legend events-calendar-legend">
        <span><i className="legend-dot legend-confirmed" /> Confirmado & Bloqueado</span>
        <span><i className="legend-dot legend-tentative" /> Tentativo (Pre-reserva)</span>
        <span><i className="legend-dot legend-other" /> En Preparación / Finalizado</span>
        {loading ? <span className="calendar-loading">Cargando calendario...</span> : null}
      </div>
    </div>
  );
}
