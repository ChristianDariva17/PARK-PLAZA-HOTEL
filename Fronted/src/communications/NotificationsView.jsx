import React, { useState, useMemo } from 'react';
import { useCommunications } from './useCommunications';
import { DEPARTMENT_CONFIG, PRIORITY_CONFIG } from './communicationsModel';
import { CheckCheck, Trash2, RefreshCw, Search, ArrowRight, Sparkles, Inbox, Clock } from 'lucide-react';

const EMPTY_NOTIFICATIONS = [];

export function NotificationsView({ navigate, notify }) {
  const { 
    notifications, 
    unreadCount, 
    actionLoading, 
    handleMarkRead, 
    handleMarkAllRead, 
    handleClearRead, 
    refresh 
  } = useCommunications();

  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all' | 'unread' | 'read'
  const [searchTerm, setSearchTerm] = useState('');

  const items = notifications.data ?? EMPTY_NOTIFICATIONS;

  // Filter items based on tab, status and search
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Department filter
      if (selectedDepartment !== 'all' && item.departmentKey !== selectedDepartment) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'unread' && item.read) return false;
      if (selectedStatus === 'read' && !item.read) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = (item.title || '').toLowerCase().includes(query);
        const matchDesc = (item.description || '').toLowerCase().includes(query);
        const matchDept = (item.department?.label || '').toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchDept) return false;
      }

      return true;
    });
  }, [items, selectedDepartment, selectedStatus, searchTerm]);

  // Counts per department
  const departmentCounts = useMemo(() => {
    const counts = { all: items.length };
    items.forEach(item => {
      const dept = item.departmentKey || 'general';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return counts;
  }, [items]);

  const handleOpenModule = async (item) => {
    if (!item.read) {
      await handleMarkRead(item.id);
    }
    if (item.route) {
      navigate(item.route);
    }
  };

  const onMarkAll = async () => {
    const ok = await handleMarkAllRead();
    if (ok) {
      notify('Bandeja al día', 'Todas las notificaciones se marcaron como leídas.', 'success');
    } else {
      notify('Aviso', 'No se pudo actualizar la bandeja.', 'error');
    }
  };

  const onClearAllRead = async () => {
    if (window.confirm('¿Desea eliminar de la bandeja todas las notificaciones ya leídas?')) {
      const ok = await handleClearRead();
      if (ok) {
        notify('Bandeja depurada', 'Se eliminaron las notificaciones leídas.', 'success');
      } else {
        notify('Aviso', 'No se pudieron eliminar los registros.', 'error');
      }
    }
  };

  return (
    <div className="view-container notifications-view">
      {/* Luxury Page Header */}
      <div className="notifications-header">
        <div>
          <span className="notifications-kicker">
            <Sparkles size={13} color="#D97706" /> CENTRO DE ALERTAS & NOTIFICACIONES 5★
          </span>
          <h1 className="notifications-title">
            Bandeja de Notificaciones Internas
          </h1>
          <p className="notifications-subtitle">
            Monitoreo en tiempo real de operaciones de recepción, housekeeping, cocina, almacén, eventos y seguridad.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="notifications-actions">
          <button
            type="button"
            onClick={refresh}
            disabled={notifications.status === 'loading'}
            className="btn btn-outline notifications-action"
          >
            <RefreshCw size={14} className={notifications.status === 'loading' ? 'spin' : ''} />
            Actualizar
          </button>

          <button
            type="button"
            className="btn btn-outline notifications-action"
            onClick={onClearAllRead}
            disabled={actionLoading || !items.some(i => i.read)}
            title="Elimina notificaciones leídas de la vista"
          >
            <Trash2 size={14} /> Limpiar Leídas
          </button>

          <button
            type="button"
            className="btn btn-primary notifications-action notifications-action--primary"
            onClick={onMarkAll}
            disabled={actionLoading || unreadCount === 0}
          >
            <CheckCheck size={16} /> Marcar Todas Leídas
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="notifications-metrics">
        <div className="notifications-metric">
          <span className="notifications-metric-label">Total de Notificaciones</span>
          <strong className="notifications-metric-value">{items.length}</strong>
        </div>

        <div className={`notifications-metric notifications-metric--unread${unreadCount > 0 ? ' is-pending' : ''}`}>
          <span className="notifications-metric-label">Sin Leer / Pendientes</span>
          <strong className="notifications-metric-value">
            {unreadCount > 0 ? `${unreadCount} pendientes` : '✓ Todas al día'}
          </strong>
        </div>

        <div className="notifications-metric">
          <span className="notifications-metric-label">Cocina & Bar (A&B)</span>
          <strong className="notifications-metric-value notifications-metric-value--amber">{departmentCounts.restaurant || 0}</strong>
        </div>

        <div className="notifications-metric">
          <span className="notifications-metric-label">Limpieza & Habitaciones</span>
          <strong className="notifications-metric-value notifications-metric-value--green">{departmentCounts.housekeeping || 0}</strong>
        </div>
      </div>

      {/* Department Filter Tabs */}
      <div className="notifications-department-tabs">
        <button
          type="button"
          onClick={() => setSelectedDepartment('all')}
           className={`notifications-tab${selectedDepartment === 'all' ? ' is-selected' : ''}`}
        >
          🌟 Todas ({departmentCounts.all || 0})
        </button>

        {Object.entries(DEPARTMENT_CONFIG).map(([key, cfg]) => {
          const count = departmentCounts[key] || 0;
          if (count === 0 && selectedDepartment !== key) return null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDepartment(key)}
               className={`notifications-tab${selectedDepartment === key ? ' is-selected' : ''}`}
            >
              <span>{cfg.icon}</span> {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search & Sub-Filter Bar */}
      <div className="notifications-filter-bar">
        <div className="notifications-search">
          <Search size={15} className="notifications-search-icon" />
          <input
            type="text"
            placeholder="Buscar por título, contenido o palabra clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
             className="notifications-search-input"
          />
        </div>

        <div className="notifications-status-tabs">
          <button
            type="button"
            onClick={() => setSelectedStatus('all')}
             className={`notifications-status-tab${selectedStatus === 'all' ? ' is-selected' : ''}`}
          >
            Todas ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('unread')}
             className={`notifications-status-tab${selectedStatus === 'unread' ? ' is-selected is-unread' : ''}`}
          >
            Sin leer ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('read')}
             className={`notifications-status-tab${selectedStatus === 'read' ? ' is-selected is-read' : ''}`}
          >
            Leídas ({items.length - unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {notifications.status === 'loading' && items.length === 0 ? (
        <div className="notifications-loading">
          <RefreshCw size={24} className="spin notifications-loading-icon" />
          <p>Cargando notificaciones del hotel...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="notifications-empty">
          <Inbox size={42} color="#94A3B8" className="notifications-empty-icon" />
          <h3 className="notifications-empty-title">
            {selectedStatus === 'unread' ? '¡Estás al día! No hay notificaciones pendientes' : 'No se encontraron notificaciones'}
          </h3>
          <p className="notifications-empty-copy">
            {selectedStatus === 'unread' ? 'Todas las alertas operativas han sido leídas y atendidas.' : 'Intente cambiando los filtros de departamento o término de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="notifications-list">
          {filteredItems.map(item => {
            const isUnread = !item.read;
            const dept = item.department || DEPARTMENT_CONFIG.general;
            const prio = item.priority || PRIORITY_CONFIG.INFO;

            return (
              <div
                key={item.id}
                className={`notification-item${isUnread ? ' is-unread' : ' is-read'}`}
              >
                {/* Left side: Icon + Texts */}
                <div className="notification-item-content">
                  {/* Department Icon Avatar */}
                  <div className={`notification-department-icon notification-department-icon--${item.departmentKey || 'general'}`}>
                    {dept.icon}
                  </div>

                  <div className="notification-item-text">
                    {/* Header line: Title + Priority + Department Badge + Time */}
                    <div className="notification-item-heading">
                      {isUnread && (
                        <span className="notification-unread-dot" title="Sin leer" />
                      )}
                      <strong className="notification-item-title">
                        {item.title}
                      </strong>

                      {/* Department Tag */}
                      <span className={`notification-department-tag notification-department-tag--${item.departmentKey || 'general'}`}>
                        {dept.label}
                      </span>

                      {/* Priority Tag */}
                      {prio.label !== 'Informativo' && (
                        <span className={`notification-priority-tag notification-priority-tag--${item.priorityKey || 'info'}`}>
                          {prio.label}
                        </span>
                      )}

                      <span className="notification-time">
                        <Clock size={12} /> {item.timeAgo}
                      </span>
                    </div>

                    {/* Content / Description */}
                    <p className="notification-item-description">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Right side: Action Buttons */}
                <div className="notification-item-actions">
                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(item.id)}
                      className="btn btn-outline btn-sm notification-mark-read"
                      title="Marcar como leída"
                    >
                      <CheckCheck size={14} /> Leída
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenModule(item)}
                    className={`btn btn-primary btn-sm notification-open-module${isUnread ? ' is-unread' : ' is-read'}`}
                  >
                    Ir al módulo <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
