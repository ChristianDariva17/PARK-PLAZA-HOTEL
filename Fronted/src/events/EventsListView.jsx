import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, 
  Search, 
  Building2, 
  Users, 
  Clock, 
  CheckCircle2, 
  PlayCircle, 
  Flag, 
  XCircle, 
  Archive, 
  Printer, 
  DollarSign, 
  Calendar,
  UtensilsCrossed,
  RefreshCw
} from 'lucide-react';
import { useEventsResource } from './useEventsResource';
import { P1Badge } from '../components/ui/P1Atoms';
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
    <div className="view-container events-module-view">
      {/* Page Header */}
      <header className="page-heading events-page-heading">
        <div>
          <span className="page-metadata events-page-metadata">
            Agenda, Salones & Banquetería 5★
          </span>
          <h2 className="events-page-title">
            Directorio de Eventos
          </h2>
          <p className="events-page-description">
            Consulte programaciones, disponibilidad de salones, comandas BEO y estado operativo.
          </p>
        </div>
        <div className="page-actions events-page-actions">
          <button 
            type="button" 
            onClick={onManagePolicies}
            className="btn btn-outline events-action-policy"
          >
            <Building2 size={16} /> Políticas de ambientes
          </button>
          <button 
            type="button" 
            onClick={onCreateEvent}
            className="btn btn-primary events-action-create"
          >
            <CalendarDays size={16} /> Nuevo evento
          </button>
        </div>
      </header>

      {/* KPI Metric Strip */}
      <div className="events-kpi-grid">
        <div className="card events-kpi-card">
          <div className="events-kpi-icon events-kpi-icon-calendar">
            <Calendar size={22} />
          </div>
          <div>
            <span className="events-kpi-label">Eventos Registrados</span>
            <strong className="events-kpi-value">{total}</strong>
          </div>
        </div>

        <div className="card events-kpi-card">
          <div className="events-kpi-icon events-kpi-icon-tentative">
            <Clock size={22} />
          </div>
          <div>
            <span className="events-kpi-label">Tentativos / Pre-reservas</span>
            <strong className="events-kpi-value events-kpi-value-tentative">{kpis.tentative}</strong>
          </div>
        </div>

        <div className="card events-kpi-card">
          <div className="events-kpi-icon events-kpi-icon-progress">
            <PlayCircle size={22} />
          </div>
          <div>
            <span className="events-kpi-label">En Curso / Montaje</span>
            <strong className="events-kpi-value events-kpi-value-progress">{kpis.inProgress}</strong>
          </div>
        </div>

        <div className="card events-kpi-card">
          <div className="events-kpi-icon events-kpi-icon-revenue">
            <DollarSign size={22} />
          </div>
          <div>
            <span className="events-kpi-label">Proyección Ingresos (S/)</span>
            <strong className="events-kpi-value events-kpi-value-revenue">{formatMoney(kpis.totalRevenue)}</strong>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <section className="card events-filter-section">
        {/* Row 1: Status Filter Tabs */}
        <div className="events-status-tabs">
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleStatusChange(tab.key)}
              className={`events-status-tab${selectedStatus === tab.key ? ' is-selected' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Row 2: Search, Space Select & Date Range */}
        <div className="events-filter-controls">
          <form onSubmit={handleSearch} className="events-search-form">
            <Search size={16} color="#94A3B8" className="events-search-icon" />
            <input
              type="text"
              placeholder="Buscar por título, anfitrión, empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="events-filter-input events-search-input"
            />
          </form>

          <select
            value={selectedSpace}
            onChange={(e) => handleSpaceChange(e.target.value)}
            className="events-filter-input"
          >
            <option value="">Todos los Salones</option>
            {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select
            value={dateFilter}
            onChange={(e) => handleDateFilterChange(e.target.value)}
            className="events-filter-input"
          >
            <option value="all">Cualquier Fecha</option>
            <option value="today">Hoy</option>
            <option value="week">Próximos 7 días</option>
            <option value="month">Este mes</option>
          </select>

          <button 
            type="button" 
            onClick={refresh}
            className="btn btn-outline events-refresh-button"
            title="Recargar eventos"
          >
            <RefreshCw size={14} /> Refrescar
          </button>
        </div>
      </section>

      {error ? (
        <div className="events-error-alert">
          {error}
        </div>
      ) : null}

      {/* Events List */}
      <section className="card events-directory-section">
        <div className="events-directory-header">
          <div>
            <span className="events-directory-kicker">Programación Operativa</span>
            <h3 className="events-directory-title">Eventos Registrados</h3>
          </div>
          <span className="events-directory-count">
            {total} evento{total === 1 ? '' : 's'} en total
          </span>
        </div>

        {loading ? (
          <div className="events-empty-state events-loading-state">
            <RefreshCw size={24} className="events-loading-icon" />
            <p>Cargando programación de eventos...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="events-empty-state">
            <CalendarDays size={48} color="#CBD5E1" className="events-empty-icon" />
            <h3 className="events-empty-title">No se encontraron eventos</h3>
            <p className="events-empty-copy">Modifique los filtros de búsqueda o registre un nuevo evento.</p>
          </div>
        ) : (
          <div className="events-list">
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
                  className="events-list-item"
                >
                  {/* Left: Date Block */}
                  <div className="events-list-main">
                    <div className="events-date-block">
                      <span className="events-date-month">{monthStr}</span>
                      <strong className="events-date-day">{dayNum}</strong>
                    </div>

                    {/* Middle: Event Info */}
                    <div>
                      <div className="events-meta-row">
                        <span className="events-space-name">
                          {event.space?.name || 'Salón Gran Plaza'}
                        </span>
                        <span className="events-meta-separator">•</span>
                        <span className="events-time">
                          <Clock size={12} /> {startTime} - {endTime}
                        </span>
                      </div>

                      <h4 className="events-item-title">
                        {event.title}
                      </h4>

                      <div className="events-item-details">
                        <span className="events-inline-detail">
                          <Users size={13} /> {event.attendees || 20} asistentes
                        </span>
                        <span>•</span>
                        <span className="events-inline-detail events-total-detail">
                          <DollarSign size={13} color="#15803D" /> Total: {formatMoney(Number(event.estimatedAmount || 0))}
                        </span>
                        {event.services && event.services.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="events-inline-detail events-services-detail">
                              <UtensilsCrossed size={12} /> {event.services.length} servicio(s)
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Status and Actions */}
                  <div className="events-item-actions">
                    <P1Badge variant={status.variant}>
                      {status.label}
                    </P1Badge>

                    {/* Quick BEO Button */}
                    <button
                      type="button"
                      onClick={() => setBeoEvent(event)}
                      className="btn btn-outline events-beo-button"
                      title="Ver e imprimir Orden BEO"
                    >
                      <Printer size={13} /> BEO
                    </button>

                    <button 
                      type="button" 
                      onClick={() => onSelectEvent(event.id)}
                      className="btn btn-primary events-detail-button"
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
          <div className="events-pagination">
            <span className="events-pagination-label">
              Mostrando {events.length} de {total} eventos
            </span>
            <div className="events-pagination-actions">
              <button 
                type="button"
                disabled={filters.page <= 1} 
                onClick={() => updateFilters({ page: filters.page - 1 })}
                className="btn btn-outline events-pagination-button"
              >
                Anterior
              </button>
              <button 
                type="button"
                disabled={events.length < filters.pageSize} 
                onClick={() => updateFilters({ page: filters.page + 1 })}
                className="btn btn-outline events-pagination-button"
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
