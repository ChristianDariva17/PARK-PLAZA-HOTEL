export const DEPARTMENT_CONFIG = {
  frontdesk: {
    label: 'Recepción & Reservas',
    icon: '🛎️',
    bg: '#EFF6FF',
    color: '#1D4ED8',
    borderColor: '#BFDBFE',
  },
  housekeeping: {
    label: 'Limpieza & Habitaciones',
    icon: '🧹',
    bg: '#ECFDF5',
    color: '#059669',
    borderColor: '#A7F3D0',
  },
  restaurant: {
    label: 'Cocina & Bar',
    icon: '🍽️',
    bg: '#FFFBEB',
    color: '#D97706',
    borderColor: '#FDE68A',
  },
  purchases: {
    label: 'Compras & Proveedores',
    icon: '📦',
    bg: '#F5F3FF',
    color: '#7C3AED',
    borderColor: '#DDD6FE',
  },
  maintenance: {
    label: 'Mantenimiento & Incidencias',
    icon: '⚠️',
    bg: '#FEF2F2',
    color: '#DC2626',
    borderColor: '#FECACA',
  },
  events: {
    label: 'Eventos & Salones',
    icon: '💍',
    bg: '#FFF1F2',
    color: '#E11D48',
    borderColor: '#FECDD3',
  },
  security: {
    label: 'Seguridad & Acceso',
    icon: '🔒',
    bg: '#F8FAFC',
    color: '#475569',
    borderColor: '#E2E8F0',
  },
  general: {
    label: 'General Hotel',
    icon: '📢',
    bg: '#F1F5F9',
    color: '#334155',
    borderColor: '#CBD5E1',
  },
};

export const PRIORITY_CONFIG = {
  HIGH: {
    label: 'Urgente',
    bg: '#FEE2E2',
    color: '#B91C1C',
    dotColor: '#EF4444',
  },
  ALARM: {
    label: 'Alerta',
    bg: '#FEF3C7',
    color: '#B45309',
    dotColor: '#F59E0B',
  },
  MEDIUM: {
    label: 'Operativo',
    bg: '#E0F2FE',
    color: '#0369A1',
    dotColor: '#0EA5E9',
  },
  TASK: {
    label: 'Tarea',
    bg: '#EDE9FE',
    color: '#6D28D9',
    dotColor: '#8B5CF6',
  },
  INFO: {
    label: 'Informativo',
    bg: '#F1F5F9',
    color: '#475569',
    dotColor: '#94A3B8',
  },
};

export function formatTimeAgo(isoString) {
  if (!isoString) return 'Reciente';
  const now = new Date();
  const date = new Date(isoString);
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 45) return 'Hace unos segundos';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `Hace ${mins} min${mins > 1 ? 's' : ''}`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `Hace ${hours} h${hours > 1 ? 's' : ''}`;
  }
  if (diffSec < 172800) {
    return `Ayer a las ${date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const adaptNotificationResponse = (notification) => {
  const meta = notification.metadata || {};
  const departmentKey = meta.department || notification.department || 'general';
  const priorityKey = meta.priority || notification.type || 'INFO';
  const dept = DEPARTMENT_CONFIG[departmentKey] || DEPARTMENT_CONFIG.general;
  const prio = PRIORITY_CONFIG[priorityKey] || PRIORITY_CONFIG.INFO;

  // Normalize action route (e.g. '/limpieza' or 'limpieza' -> 'limpieza')
  let route = notification.route || notification.actionLink || 'dashboard';
  if (route.startsWith('/')) route = route.slice(1);
  if (route.startsWith('#/')) route = route.slice(2);

  return {
    ...notification,
    id: notification.id,
    title: notification.title,
    description: notification.description ?? notification.content,
    read: notification.read ?? notification.isRead,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
    timeAgo: formatTimeAgo(notification.createdAt),
    route,
    departmentKey,
    department: dept,
    priorityKey,
    priority: prio,
  };
};

export const adaptPreferenceResponse = (preference) => {
  return {
    ...preference,
  };
};
