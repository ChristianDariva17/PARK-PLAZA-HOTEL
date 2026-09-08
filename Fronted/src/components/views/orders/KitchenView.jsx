import { useState, useCallback, useEffect } from 'react';
import { ChefHat, Clock, CheckCircle2, Flame, Bell, Star, RefreshCw, AlertCircle, ArrowRight } from 'lucide-react';
import { useHotel } from '../../../state/hotelContext.js';
import { formatMoney } from '../../../domain/hotelModel.js';
import { useRestaurantResource } from '../../../restaurant/useRestaurantResource.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVE_STATUSES = ['Pedido recibido', 'Confirmado', 'En preparacion', 'Listo'];

const STATUS_CONFIG = {
  'Pedido recibido': {
    label: 'Nuevo',
    next: 'Confirmar',
    bg: '#1C1200',
    border: '#D97706',
    text: '#FCD34D',
    badge: '#92400E',
    badgeText: '#FDE68A',
    Icon: Bell,
  },
  'Confirmado': {
    label: 'Confirmado',
    next: 'En preparación',
    bg: '#0F172A',
    border: '#3B82F6',
    text: '#93C5FD',
    badge: '#1E3A8A',
    badgeText: '#BFDBFE',
    Icon: CheckCircle2,
  },
  'En preparacion': {
    label: 'En preparación',
    next: 'Listo',
    bg: '#1C0A00',
    border: '#F97316',
    text: '#FED7AA',
    badge: '#7C2D12',
    badgeText: '#FFEDD5',
    Icon: Flame,
  },
  'Listo': {
    label: 'Listo — entregar',
    next: 'Entregado',
    bg: '#052E16',
    border: '#22C55E',
    text: '#86EFAC',
    badge: '#14532D',
    badgeText: '#D1FAE5',
    Icon: Star,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elapsed(createdAt) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

function itemLabel(item) {
  return item.variantName ? `${item.name} \u2014 ${item.variantName}` : item.name;
}

// ─── OrderTicket ──────────────────────────────────────────────────────────────
function OrderTicket({ order, onAdvance, onCancel, advancing }) {
  const cfg = STATUS_CONFIG[order.status];
  if (!cfg) return null;
  const Icon = cfg.Icon;
  const mins = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const isUrgent = order.status === 'Pedido recibido' && mins >= 3;

  return (
    <div className={`kitchen-ticket kitchen-ticket-${order.status === 'Pedido recibido' ? 'received' : order.status === 'Confirmado' ? 'confirmed' : order.status === 'En preparacion' ? 'preparing' : 'ready'}${isUrgent ? ' is-urgent' : ''}`}>
      {/* Header */}
      <div className="kitchen-ticket-header">
        <div className="kitchen-ticket-heading">
          {isUrgent && <AlertCircle size={16} color="#EF4444" className="kitchen-ticket-urgent-icon" />}
          <span className="kitchen-ticket-badge">
            <Icon size={10} />{cfg.label}
          </span>
          <span className="kitchen-ticket-source">{order.source}</span>
        </div>
        <div className="kitchen-ticket-total">
          <div className="kitchen-ticket-amount">{formatMoney(order.total)}</div>
          <div className={`kitchen-ticket-elapsed${isUrgent ? ' is-urgent' : ''}`}>
            <Clock size={10} className="kitchen-ticket-clock" />
            {elapsed(order.createdAt)} esperando
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="kitchen-ticket-items">
        {(order.items || []).map((item, i) => (
          <div key={i} className={`kitchen-ticket-item${i < order.items.length - 1 ? ' has-divider' : ''}`}>
            <span className="kitchen-ticket-item-label">
              <span className="kitchen-ticket-quantity">{item.quantity}\xD7</span>
              {itemLabel(item)}
            </span>
          </div>
        ))}
        {order.comment && (
          <div className="kitchen-ticket-comment">
            \uD83D\uDCAC {order.comment}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="kitchen-ticket-actions">
        <button
          onClick={() => onAdvance(order)}
          disabled={advancing === order.id}
          className={`kitchen-advance-button${advancing === order.id ? ' is-advancing' : ''}`}
        >
          {advancing === order.id
            ? <RefreshCw size={14} />
            : <><ArrowRight size={14} />{cfg.next}</>
          }
        </button>
        {['Pedido recibido', 'Confirmado', 'En preparacion'].includes(order.status) && (
          <button
            onClick={() => onCancel(order)}
            disabled={advancing === order.id}
            className="kitchen-cancel-button"
          >
            \u2715
          </button>
        )}
      </div>
    </div>
  );
}

// ─── StatusColumn ─────────────────────────────────────────────────────────────
function StatusColumn({ status, orders, onAdvance, onCancel, advancing }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <div className="kitchen-status-column">
      <div className={`kitchen-status-header kitchen-status-${status === 'Pedido recibido' ? 'received' : status === 'Confirmado' ? 'confirmed' : status === 'En preparacion' ? 'preparing' : 'ready'}`}>
        <Icon size={18} color={cfg.border} />
        <span className="kitchen-status-label">{cfg.label}</span>
        <span className="kitchen-status-count">{orders.length}</span>
      </div>
      <div className="kitchen-status-orders">
        {orders.length === 0 ? (
          <div className="kitchen-empty-column">
            Sin pedidos
          </div>
        ) : orders.map(order => (
          <OrderTicket
            key={order.id}
            order={order}
            onAdvance={onAdvance}
            onCancel={onCancel}
            advancing={advancing}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function KitchenView({ notify }) {
  const { state, restaurantCommands } = useHotel();
  const ordersResource = useRestaurantResource(state, restaurantCommands, 'orders');
  
  const [advancing, setAdvancing] = useState(null);
  const [, setTick] = useState(0);

  // Tick + auto-reload every 30s to refresh elapsed counters
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(t => t + 1);
      ordersResource.reload();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [ordersResource]);

  const activeOrders = (ordersResource.data || [])
    .filter(o => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const handleAdvance = useCallback(async (order) => {
    if (advancing) return;
    setAdvancing(order.id);
    try {
      await restaurantCommands.advanceOrder(order.id, { expectedStatus: order.status });
      notify?.('Estado avanzado', 'Pedido actualizado correctamente.', 'success');
    } catch (err) {
      notify?.('Error al avanzar', err.message || 'Error desconocido', 'error');
    } finally {
      setAdvancing(null);
    }
  }, [advancing, restaurantCommands, notify]);

  const handleCancel = useCallback(async (order) => {
    if (!window.confirm(`\u00BFCancelar el pedido de ${order.source}?`)) return;
    if (advancing) return;
    setAdvancing(order.id);
    try {
      await restaurantCommands.cancelOrder(order.id, { reason: 'Cancelaci\u00F3n desde cocina' });
      notify?.('Pedido cancelado', 'El pedido fue cancelado.', 'success');
    } catch (err) {
      notify?.('Error al cancelar', err.message || 'Error desconocido', 'error');
    } finally {
      setAdvancing(null);
    }
  }, [advancing, restaurantCommands, notify]);

  return (
    <div className="kitchen-view">
      {/* Header */}
      <div className="kitchen-view-header">
        <div className="kitchen-view-heading">
          <ChefHat size={32} color="#D97706" />
          <div>
            <h1 className="kitchen-view-title">
              Vista de Cocina
            </h1>
            <p className="kitchen-view-subtitle">
              {activeOrders.length} pedido{activeOrders.length !== 1 ? 's' : ''} activo{activeOrders.length !== 1 ? 's' : ''} \xB7 Auto-refresh cada 30s
            </p>
          </div>
        </div>
        <button
          onClick={() => ordersResource.reload()}
          className="kitchen-refresh-button"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {ordersResource.status === 'loading' ? (
        <div className="kitchen-state kitchen-state-loading">
          <RefreshCw size={64} className="kitchen-state-icon kitchen-state-icon-loading" />
          <div className="kitchen-state-title">Cargando pedidos</div>
        </div>
      ) : ordersResource.status === 'error' ? (
        <div className="kitchen-state kitchen-state-error">
          <AlertCircle size={64} className="kitchen-state-icon" />
          <div className="kitchen-state-title">Error al cargar</div>
          <div className="kitchen-state-error-copy">{ordersResource.error}</div>
          <button onClick={() => ordersResource.reload()} className="kitchen-retry-button">Reintentar</button>
        </div>
      ) : ordersResource.isForbidden ? (
        <div className="kitchen-state kitchen-state-error">
          <AlertCircle size={64} className="kitchen-state-icon" />
          <div className="kitchen-state-title">Acceso denegado</div>
          <div className="kitchen-state-error-copy">No tienes permiso para ver los pedidos de cocina.</div>
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="kitchen-state kitchen-state-empty">
          <ChefHat size={64} className="kitchen-state-icon kitchen-state-icon-empty" />
          <div className="kitchen-state-title">Sin pedidos activos</div>
          <div className="kitchen-state-empty-copy">Los nuevos pedidos aparecerán aquí automáticamente</div>
        </div>
      ) : (
        <div className="kitchen-status-grid">
          {ACTIVE_STATUSES.map(status => (
            <StatusColumn
              key={status}
              status={status}
              orders={activeOrders.filter(o => o.status === status)}
              onAdvance={handleAdvance}
              onCancel={handleCancel}
              advancing={advancing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
