import React, { useState, useMemo } from 'react';
import { useCommunications } from './useCommunications';
import { DEPARTMENT_CONFIG, PRIORITY_CONFIG } from './communicationsModel';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  RefreshCw, 
  Search, 
  Filter, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  Inbox,
  Clock,
  AlertCircle
} from 'lucide-react';

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

  const items = notifications.data || [];

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
    <div className="view-container" style={{ paddingBottom: 60 }}>
      {/* Luxury Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} color="#D97706" /> CENTRO DE ALERTAS & NOTIFICACIONES 5★
          </span>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#1E3A8A', margin: '4px 0 2px' }}>
            Bandeja de Notificaciones Internas
          </h1>
          <p style={{ margin: 0, fontSize: 13.5, color: '#64748B' }}>
            Monitoreo en tiempo real de operaciones de recepción, housekeeping, cocina, almacén, eventos y seguridad.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={refresh}
            disabled={notifications.status === 'loading'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <RefreshCw size={14} className={notifications.status === 'loading' ? 'spin' : ''} />
            Actualizar
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={onClearAllRead}
            disabled={actionLoading || !items.some(i => i.read)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            title="Elimina notificaciones leídas de la vista"
          >
            <Trash2 size={14} /> Limpiar Leídas
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onMarkAll}
            disabled={actionLoading || unreadCount === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800 }}
          >
            <CheckCheck size={16} /> Marcar Todas Leídas
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#FFFFFF', padding: '14px 18px', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, display: 'block' }}>Total de Notificaciones</span>
          <strong style={{ fontSize: 22, color: '#0F172A', fontWeight: 900 }}>{items.length}</strong>
        </div>

        <div style={{ background: unreadCount > 0 ? '#FFFBEB' : '#F8FAFC', padding: '14px 18px', borderRadius: 12, border: unreadCount > 0 ? '1.5px solid #FDE68A' : '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: 12, color: unreadCount > 0 ? '#B45309' : '#64748B', fontWeight: 700, display: 'block' }}>Sin Leer / Pendientes</span>
          <strong style={{ fontSize: 22, color: unreadCount > 0 ? '#D97706' : '#15803D', fontWeight: 900 }}>
            {unreadCount > 0 ? `${unreadCount} pendientes` : '✓ Todas al día'}
          </strong>
        </div>

        <div style={{ background: '#FFFFFF', padding: '14px 18px', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, display: 'block' }}>Cocina & Bar (A&B)</span>
          <strong style={{ fontSize: 22, color: '#D97706', fontWeight: 900 }}>{departmentCounts.restaurant || 0}</strong>
        </div>

        <div style={{ background: '#FFFFFF', padding: '14px 18px', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600, display: 'block' }}>Limpieza & Habitaciones</span>
          <strong style={{ fontSize: 22, color: '#059669', fontWeight: 900 }}>{departmentCounts.housekeeping || 0}</strong>
        </div>
      </div>

      {/* Department Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 16, borderBottom: '2px solid #E5E7EB' }}>
        <button
          type="button"
          onClick={() => setSelectedDepartment('all')}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: selectedDepartment === 'all' ? '#1E3A8A' : '#F1F5F9',
            color: selectedDepartment === 'all' ? '#FFFFFF' : '#475569',
            fontWeight: 800,
            fontSize: 12.5,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
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
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: 'none',
                background: selectedDepartment === key ? '#1E3A8A' : '#F1F5F9',
                color: selectedDepartment === key ? '#FFFFFF' : '#475569',
                fontWeight: 700,
                fontSize: 12.5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{cfg.icon}</span> {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search & Sub-Filter Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: 12, color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Buscar por título, contenido o palabra clave..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', height: 38, paddingLeft: 34, borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setSelectedStatus('all')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: selectedStatus === 'all' ? '#1E3A8A' : '#CBD5E1',
              background: selectedStatus === 'all' ? '#EFF6FF' : '#FFFFFF',
              color: selectedStatus === 'all' ? '#1E3A8A' : '#64748B',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Todas ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('unread')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: selectedStatus === 'unread' ? '#D97706' : '#CBD5E1',
              background: selectedStatus === 'unread' ? '#FFFBEB' : '#FFFFFF',
              color: selectedStatus === 'unread' ? '#B45309' : '#64748B',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Sin leer ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('read')}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid',
              borderColor: selectedStatus === 'read' ? '#15803D' : '#CBD5E1',
              background: selectedStatus === 'read' ? '#ECFDF5' : '#FFFFFF',
              color: selectedStatus === 'read' ? '#15803D' : '#64748B',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Leídas ({items.length - unreadCount})
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {notifications.status === 'loading' && items.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
          <p>Cargando notificaciones del hotel...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: '#FFFFFF', borderRadius: 14, border: '1px solid #E2E8F0', marginTop: 10 }}>
          <Inbox size={42} color="#94A3B8" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1E293B' }}>
            {selectedStatus === 'unread' ? '¡Estás al día! No hay notificaciones pendientes' : 'No se encontraron notificaciones'}
          </h3>
          <p style={{ margin: '6px 0 0', color: '#64748B', fontSize: 13 }}>
            {selectedStatus === 'unread' ? 'Todas las alertas operativas han sido leídas y atendidas.' : 'Intente cambiando los filtros de departamento o término de búsqueda.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredItems.map(item => {
            const isUnread = !item.read;
            const dept = item.department || DEPARTMENT_CONFIG.general;
            const prio = item.priority || PRIORITY_CONFIG.INFO;

            return (
              <div
                key={item.id}
                style={{
                  background: isUnread ? '#FFFFFF' : '#F8FAFC',
                  border: isUnread ? '1.5px solid #93C5FD' : '1px solid #E2E8F0',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  transition: 'all 0.15s ease',
                  boxShadow: isUnread ? '0 3px 8px -1px rgba(30, 58, 138, 0.06)' : 'none',
                }}
              >
                {/* Left side: Icon + Texts */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1 }}>
                  {/* Department Icon Avatar */}
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 10,
                    background: dept.bg,
                    border: `1px solid ${dept.borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    flexShrink: 0,
                  }}>
                    {dept.icon}
                  </div>

                  <div style={{ flex: 1 }}>
                    {/* Header line: Title + Priority + Department Badge + Time */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      {isUnread && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} title="Sin leer" />
                      )}
                      <strong style={{ fontSize: 14, color: isUnread ? '#0F172A' : '#334155', fontWeight: isUnread ? 800 : 700 }}>
                        {item.title}
                      </strong>

                      {/* Department Tag */}
                      <span style={{
                        background: dept.bg,
                        color: dept.color,
                        border: `1px solid ${dept.borderColor}`,
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700
                      }}>
                        {dept.label}
                      </span>

                      {/* Priority Tag */}
                      {prio.label !== 'Informativo' && (
                        <span style={{
                          background: prio.bg,
                          color: prio.color,
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontSize: 10.5,
                          fontWeight: 800,
                          textTransform: 'uppercase'
                        }}>
                          {prio.label}
                        </span>
                      )}

                      <span style={{ fontSize: 11.5, color: '#94A3B8', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {item.timeAgo}
                      </span>
                    </div>

                    {/* Content / Description */}
                    <p style={{ margin: 0, fontSize: 13, color: isUnread ? '#475569' : '#64748B', lineHeight: 1.4 }}>
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Right side: Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {isUnread && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleMarkRead(item.id)}
                      style={{ fontSize: 12, fontWeight: 700, padding: '6px 10px' }}
                      title="Marcar como leída"
                    >
                      <CheckCheck size={14} /> Leída
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleOpenModule(item)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 800,
                      padding: '6px 14px',
                      background: isUnread ? '#1E3A8A' : '#475569',
                      borderColor: isUnread ? '#1E3A8A' : '#475569'
                    }}
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
