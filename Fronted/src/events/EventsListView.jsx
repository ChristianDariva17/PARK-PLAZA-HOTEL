import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, 
  Search, 
  Building2, 
  Users, 
  Clock, 
  Sparkles, 
  Filter, 
  CheckCircle2, 
  PlayCircle, 
  Flag, 
  XCircle, 
  Archive, 
  Printer, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  Layers,
  UtensilsCrossed,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { useEventsResource } from './useEventsResource';
import { P1Button, P1Badge } from '../components/ui/P1Atoms';
import { formatMoney } from '../domain/hotelModel.js';
import { EventBeoModal } from './EventBeoModal';

const STATUS_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'tentative', label: 'Tentativos' },
  { key: 'confirmed', label: 'Confirmados' },
  { key: 'preparing', label: 'En Montaje' },
  { key: 'in_progress', label: 'En Curso' },
  { key: 'completed', label: 'Finalizados' },
  { key: 'cancelled', label: 'Cancelados' },
];

const STATUS_CONFIG = {
  draft: { label: 'Borrador', variant: 'neutral', icon: Clock },
  tentative: { label: 'Tentativo', variant: 'warning', icon: Clock },
  confirmed: { label: 'Confirmado', variant: 'success', icon: CheckCircle2 },
  preparing: { label: 'En Montaje', variant: 'primary', icon: PlayCircle },
  in_progress: { label: 'En Curso', variant: 'primary', icon: PlayCircle },
  completed: { label: 'Finalizado', variant: 'success', icon: Flag },
  cancelled: { label: 'Cancelado', variant: 'danger', icon: XCircle },
  archived: { label: 'Archivado', variant: 'neutral', icon: Archive },
};

const formatDateTime = (value, timezone) => {
  try { 
    return new Intl.DateTimeFormat('es-PE', { 
      dateStyle: 'medium', 
      timeStyle: 'short', 
      timeZone: timezone || 'America/Lima' 
    }).format(new Date(value)); 
  } catch { 
    return value; 
  }
};

export function EventsListView({ onSelectEvent, onCreateEvent, onManagePolicies }) {
  const { events, spaces, loading, error, filters, updateFilters, total, refresh } = useEventsResource();
  const [searchTerm, setSearchTerm] = useState(filters.q || '');
  const [selectedSpace, setSelectedSpace] = useState(filters.spaceId || '');
  const [selectedStatus, setSelectedStatus] = useState(filters.status || '');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'week' | 'month'

  // BEO modal state
  const [beoEvent, setBeoEvent] = useState(null);

  const handleSearch = (e) => {
    e?.preventDefault();
    updateFilters({ q: searchTerm });
  };

  const handleStatusChange = (status) => {
    setSelectedStatus(status);
    updateFilters({ status });
  };

  const handleSpaceChange = (spaceId) => {
    setSelectedSpace(spaceId);
    updateFilters({ spaceId });
  };

  const handleDateFilterChange = (range) => {
    setDateFilter(range);
    const now = new Date();
    let from = '';
    let to = '';

    if (range === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      from = start.toISOString();
      to = end.toISOString();
    } else if (range === 'week') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      from = start.toISOString();
      to = end.toISOString();
    } else if (range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      from = start.toISOString();
      to = end.toISOString();
    }

    updateFilters({ from, to });
  };

  // KPIs calculation
  const kpis = useMemo(() => {
    const totalEvents = events.length;
    const inProgress = events.filter(e => e.status === 'in_progress' || e.status === 'preparing').length;
    const tentative = events.filter(e => e.status === 'tentative').length;
    const totalRevenue = events
      .filter(e => e.status !== 'cancelled')
      .reduce((sum, e) => sum + Number(e.estimatedAmount || 0), 0);
    const totalAttendees = events
      .filter(e => e.status !== 'cancelled')
      .reduce((sum, e) => sum + Number(e.attendees || 0), 0);

    return { totalEvents, inProgress, tentative, totalRevenue, totalAttendees };
  }, [events]);

  return (
    <div className="view-container events-module-view" style={{ paddingBottom: 60 }}>
      {/* Page Header */}
      <header className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <span className="page-metadata" style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.08em' }}>
            Agenda, Salones & Banquetería 5★
          </span>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: '#1E3A8A', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
            Directorio de Eventos
          </h2>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 13.5 }}>
            Consulte programaciones, disponibilidad de salones, comandas BEO y estado operativo.
          </p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 10 }}>
          <button 
            type="button" 
            onClick={onManagePolicies}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 700 }}
          >
            <Building2 size={16} /> Políticas de ambientes
          </button>
          <button 
            type="button" 
            onClick={onCreateEvent}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', fontWeight: 800 }}
          >
            <CalendarDays size={16} /> Nuevo evento
          </button>
        </div>
      </header>

      {/* KPI Metric Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 20px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D4ED8' }}>
            <Calendar size={22} />
          </div>
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eventos Registrados</span>
            <strong style={{ fontSize: 22, fontWeight: 900, color: '#111827', display: 'block', lineHeight: 1.2 }}>{total}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706' }}>
            <Clock size={22} />
          </div>
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tentativos / Pre-reservas</span>
            <strong style={{ fontSize: 22, fontWeight: 900, color: '#D97706', display: 'block', lineHeight: 1.2 }}>{kpis.tentative}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#15803D' }}>
            <PlayCircle size={22} />
          </div>
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>En Curso / Montaje</span>
            <strong style={{ fontSize: 22, fontWeight: 900, color: '#15803D', display: 'block', lineHeight: 1.2 }}>{kpis.inProgress}</strong>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45309' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proyección Ingresos (S/)</span>
            <strong style={{ fontSize: 20, fontWeight: 900, color: '#92400E', display: 'block', lineHeight: 1.2 }}>{formatMoney(kpis.totalRevenue)}</strong>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <section className="card" style={{ padding: '18px 22px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E5E7EB', marginBottom: 20 }}>
        {/* Row 1: Status Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 14, borderBottom: '1px solid #F3F4F6', marginBottom: 16 }}>
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusChange(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 9999,
                fontSize: 12.5,
                fontWeight: 700,
                border: '1px solid',
                borderColor: selectedStatus === tab.key ? '#1E3A8A' : '#E5E7EB',
                background: selectedStatus === tab.key ? '#1E3A8A' : '#FFFFFF',
                color: selectedStatus === tab.key ? '#FFFFFF' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Row 2: Search, Space Select & Date Range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr auto', gap: 14, alignItems: 'center' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12 }} />
            <input
              type="text"
              placeholder="Buscar por título, anfitrión, empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13 }}
            />
          </form>

          <select
            value={selectedSpace}
            onChange={(e) => handleSpaceChange(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, background: '#FFFFFF' }}
          >
            <option value="">Todos los Salones</option>
            {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #E5E7EB', fontSize: 13, background: '#FFFFFF' }}
          >
            <option value="all">Cualquier Fecha</option>
            <option value="today">Hoy</option>
            <option value="week">Próximos 7 días</option>
            <option value="month">Este mes</option>
          </select>

          <button 
            type="button" 
            onClick={refresh}
            className="btn btn-outline"
            style={{ padding: '9px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            title="Recargar eventos"
          >
            <RefreshCw size={14} /> Refrescar
          </button>
        </div>
      </section>

      {error ? (
        <div style={{ padding: '14px 18px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 12, marginBottom: 20 }}>
          {error}
        </div>
      ) : null}

      {/* Events List */}
      <section className="card" style={{ padding: 24, borderRadius: 14, background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #F3F4F6', paddingBottom: 12 }}>
          <div>
            <span style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.06em' }}>Programación Operativa</span>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#111827', margin: '2px 0 0' }}>Eventos Registrados</h3>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#64748B' }}>
            {total} evento{total === 1 ? '' : 's'} en total
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} />
            <p>Cargando programación de eventos...</p>
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>
            <CalendarDays size={48} color="#CBD5E1" style={{ marginBottom: 12 }} />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#475569', margin: '0 0 6px' }}>No se encontraron eventos</h3>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Modifique los filtros de búsqueda o registre un nuevo evento.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {events.map((event) => {
              const status = STATUS_CONFIG[event.status] || { label: event.status, variant: 'neutral', icon: Clock };
              const startDate = new Date(event.startsAt);
              const endDate = new Date(event.endsAt);
              const dayNum = new Intl.DateTimeFormat('es-PE', { day: '2-digit', timeZone: event.timezone || 'America/Lima' }).format(startDate);
              const monthStr = new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: event.timezone || 'America/Lima' }).format(startDate).toUpperCase();
              const startTime = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: event.timezone || 'America/Lima' }).format(startDate);
              const endTime = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: event.timezone || 'America/Lima' }).format(endDate);

              return (
                <article 
                  key={event.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: 12,
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {/* Left: Date Block */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div style={{ 
                      width: 56, 
                      height: 58, 
                      borderRadius: 10, 
                      background: '#0F172A', 
                      color: '#FFFFFF', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      textAlign: 'center'
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#C59D5F', letterSpacing: '0.05em' }}>{monthStr}</span>
                      <strong style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{dayNum}</strong>
                    </div>

                    {/* Middle: Event Info */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {event.space?.name || 'Salón Gran Plaza'}
                        </span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>•</span>
                        <span style={{ fontSize: 12, color: '#475569', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {startTime} - {endTime}
                        </span>
                      </div>

                      <h4 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#0F172A' }}>
                        {event.title}
                      </h4>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#64748B' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Users size={13} /> {event.attendees || 20} asistentes
                        </span>
                        <span>•</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#0F172A' }}>
                          <DollarSign size={13} color="#15803D" /> Total: {formatMoney(Number(event.estimatedAmount || 0))}
                        </span>
                        {event.services && event.services.length > 0 && (
                          <>
                            <span>•</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#D97706' }}>
                              <UtensilsCrossed size={12} /> {event.services.length} servicio(s)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Status and Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <P1Badge variant={status.variant}>
                      {status.label}
                    </P1Badge>

                    {/* Quick BEO Button */}
                    <button
                      type="button"
                      onClick={() => setBeoEvent(event)}
                      className="btn btn-outline"
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: 12, 
                        fontWeight: 700, 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 5,
                        borderColor: '#C59D5F',
                        color: '#B45309',
                        background: '#FFFBEB'
                      }}
                      title="Ver e imprimir Orden BEO"
                    >
                      <Printer size={13} /> BEO
                    </button>

                    <button 
                      type="button" 
                      onClick={() => onSelectEvent(event.id)}
                      className="btn btn-primary"
                      style={{ padding: '7px 16px', fontSize: 13, fontWeight: 800 }}
                    >
                      Ver detalle
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && events.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, paddingTop: 16, borderTop: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: 13, color: '#64748B' }}>
              Mostrando {events.length} de {total} eventos
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                type="button"
                className="btn btn-outline"
                disabled={filters.page <= 1} 
                onClick={() => updateFilters({ page: filters.page - 1 })}
                style={{ padding: '6px 14px', fontSize: 13 }}
              >
                Anterior
              </button>
              <button 
                type="button"
                className="btn btn-outline"
                disabled={events.length < filters.pageSize} 
                onClick={() => updateFilters({ page: filters.page + 1 })}
                style={{ padding: '6px 14px', fontSize: 13 }}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>

      {/* BEO Modal */}
      {beoEvent && (
        <EventBeoModal event={beoEvent} onClose={() => setBeoEvent(null)} />
      )}
    </div>
  );
}
