import { AlertTriangle, CheckCircle2, Circle, Clock3, Search, XCircle } from 'lucide-react';
import { usePermissions } from '../../auth/authContext';
import { permissionForAction, permissionForPrimaryAction } from '../../auth/permissions';

const STATUS_TONES = {
  disponible: 'green', aprobada: 'green', aprobado: 'green', pagado: 'green', firmado: 'green', activa: 'green', activo: 'green', completada: 'green', completado: 'green', confirmado: 'green', confirmada: 'green', entregado: 'green', registrado: 'green', generado: 'green', habilitado: 'green', respondida: 'green', leída: 'green', óptimo: 'green', abierta: 'green', dentro: 'green', 'sin daños': 'green', ingreso: 'green', listo: 'green', finalizado: 'green', finalizada: 'green', resuelta: 'green', cerrada: 'green', consumido: 'green', liberado: 'green',
  reservada: 'blue', 'cliente presente': 'blue', asignada: 'blue', asignado: 'blue', reservado: 'blue', 'dentro de piscina': 'blue', 'pedido recibido': 'blue', alternativa: 'blue', alternativo: 'blue', 'cargado a cuenta': 'blue',
  pendiente: 'yellow', 'pendiente de firma': 'yellow', 'pendiente de integración': 'yellow', 'pendiente de hardware': 'yellow', 'pendiente de backend': 'yellow', 'pendiente de pago': 'yellow', 'integración fiscal pendiente': 'yellow', 'en proceso': 'yellow', 'en preparación': 'yellow', 'en camino': 'yellow', 'en limpieza': 'yellow', 'en mantenimiento': 'yellow', 'en reparación': 'yellow', reportado: 'yellow', tentativo: 'yellow', 'bajo mínimo': 'yellow', 'sin reservar': 'yellow', 'borrador interno': 'yellow', media: 'yellow', alta: 'yellow',
  ocupada: 'purple', bar: 'purple',
  'no disponible': 'red', 'fuera de servicio': 'red', bloqueada: 'red', urgente: 'red', cancelado: 'red', cancelada: 'red', rechazado: 'red', rechazada: 'red', insuficiente: 'red', crítico: 'red', vencido: 'red', vencida: 'red', 'no presentado': 'red', 'no configurado': 'red', 'con incidencia': 'red', egreso: 'red',
};

const STATUS_ICONS = { green: CheckCircle2, blue: Circle, yellow: Clock3, purple: Circle, red: XCircle, gray: Circle };

export function PageHeader({ title, description, action, actionType, metadata }) {
  const { can } = usePermissions();
  const route = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  const explicitActionType = actionType || action?.props?.actionType;
  const required = explicitActionType ? permissionForAction({ type: explicitActionType }) : permissionForPrimaryAction(route, action?.props?.children);
  const authorizedAction = action && required && can(required) ? action : null;
  return <header className="page-heading"><div>{metadata ? <span className="page-metadata">{metadata}</span> : null}<h2>{title}</h2><p>{description}</p></div>{authorizedAction ? <div className="page-actions">{authorizedAction}</div> : null}</header>;
}

export function Kpi({ label, value, detail, icon: Icon = CheckCircle2, tone = 'green' }) {
  return <article className="kpi-card"><div className={`kpi-icon-circle tone-${tone}`}><Icon size={20} aria-hidden="true" /></div><div className="kpi-content"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div>{detail ? <div className="kpi-subtext">{detail}</div> : null}</div></article>;
}

export function StatusBadge({ children }) {
  const value = String(children || '').trim().toLowerCase();
  const color = STATUS_TONES[value] || 'gray';
  const Icon = color === 'yellow' && ['alta', 'bajo mínimo'].includes(value) ? AlertTriangle : STATUS_ICONS[color];
  return <span className={`badge badge-${color}`}><Icon size={12} strokeWidth={2.5} aria-hidden="true" />{children}</span>;
}

export function EmptyState({ title = 'Sin resultados', description = 'No hay registros que coincidan con los filtros actuales.' }) {
  return <div className="empty-state"><Search size={28} aria-hidden="true" /><strong>{title}</strong><span>{description}</span></div>;
}

export function SectionHeader({ eyebrow, title, description, action, id }) {
  return <div className="section-header"><div>{eyebrow ? <span className="section-kicker">{eyebrow}</span> : null}<h3 id={id}>{title}</h3>{description ? <p>{description}</p> : null}</div>{action}</div>;
}

export function MetricStrip({ items, label = 'Resumen operativo' }) {
  return <section className="metric-strip" aria-label={label}>{items.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.detail ? <small>{item.detail}</small> : null}</div>)}</section>;
}

export function DetailGrid({ items, compact = false }) {
  return <div className={`detail-grid ${compact ? 'compact' : ''}`}>{items.map((item) => <div key={item.label}><span>{item.label}</span>{item.node || <strong>{item.value ?? 'No registrado'}</strong>}{item.detail ? <small>{item.detail}</small> : null}</div>)}</div>;
}

export function DataTable({ caption, columns, children, emptyTitle, emptyDescription }) {
  if (!children) return <section className="card"><EmptyState title={emptyTitle} description={emptyDescription} /></section>;
  return <section className="card table-container"><table className="custom-table"><caption>{caption}</caption><thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{children}</tbody></table></section>;
}
