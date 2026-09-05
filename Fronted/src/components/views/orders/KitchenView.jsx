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
    <div style={{
      background: cfg.bg,
      border: `2px solid ${isUrgent ? '#EF4444' : cfg.border}`,
      borderRadius: 16,
      padding: '18px 20px',
      marginBottom: 14,
      boxShadow: isUrgent ? '0 0 18px rgba(239,68,68,0.35)' : '0 0 10px rgba(0,0,0,0.4)',
      transition: 'border-color 0.3s, box-shadow 0.3s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {isUrgent && <AlertCircle size={16} color="#EF4444" style={{ flexShrink: 0 }} />}
          <span style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: cfg.badgeText, background: cfg.badge, padding: '3px 10px', borderRadius: 20,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Icon size={10} />{cfg.label}
          </span>
          <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{order.source}</span>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: cfg.text }}>{formatMoney(order.total)}</div>
          <div style={{ fontSize: 11, color: isUrgent ? '#EF4444' : '#6B7280', fontWeight: isUrgent ? 800 : 500, marginTop: 2 }}>
            <Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
            {elapsed(order.createdAt)} esperando
          </div>
        </div>
      </div>

      {/* Items */}
      <div style={{ borderTop: `1px solid ${cfg.border}40`, paddingTop: 12, marginBottom: 14 }}>
        {(order.items || []).map((item, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            padding: '5px 0',
            borderBottom: i < order.items.length - 1 ? `1px solid ${cfg.border}25` : 'none',
          }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#F9FAFB' }}>
              <span style={{ fontSize: 19, fontWeight: 900, color: cfg.text, marginRight: 8 }}>{item.quantity}\xD7</span>
              {itemLabel(item)}
            </span>
          </div>
        ))}
        {order.comment && (
          <div style={{
            marginTop: 10, padding: '7px 12px', background: '#1F2937',
            borderRadius: 8, fontSize: 13, color: '#D1FAE5', fontStyle: 'italic',
            borderLeft: `3px solid ${cfg.border}`,
          }}>
            \uD83D\uDCAC {order.comment}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={() => onAdvance(order)}
          disabled={advancing === order.id}
          style={{
            flex: 1, padding: '13px 0', borderRadius: 12, border: 'none',
            background: advancing === order.id ? '#374151' : cfg.border,
            color: advancing === order.id ? '#6B7280' : '#fff',
            fontSize: 14, fontWeight: 900,
            cursor: advancing === order.id ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background 0.2s',
          }}
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
            style={{
              padding: '13px 16px', borderRadius: 12,
              background: 'transparent', border: '2px solid #374151',
              color: '#6B7280', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
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
    <div style={{ minWidth: 290, flex: '1 1 290px', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        padding: '10px 16px', borderRadius: 12,
        background: `${cfg.border}18`, border: `1px solid ${cfg.border}40`,
      }}>
        <Icon size={18} color={cfg.border} />
        <span style={{ fontSize: 14, fontWeight: 800, color: cfg.text }}>{cfg.label}</span>
        <span style={{
          marginLeft: 'auto', background: cfg.badge, color: cfg.badgeText,
          borderRadius: 20, padding: '2px 12px', fontSize: 13, fontWeight: 900,
        }}>{orders.length}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 0', color: '#374151', fontSize: 14, fontWeight: 600 }}>
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
    <div style={{
      minHeight: '100vh', background: '#0A0A0A',
      padding: '24px 28px', boxSizing: 'border-box',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid #1F2937',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ChefHat size={32} color="#D97706" />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#F9FAFB', letterSpacing: '-0.02em' }}>
              Vista de Cocina
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#4B5563' }}>
              {activeOrders.length} pedido{activeOrders.length !== 1 ? 's' : ''} activo{activeOrders.length !== 1 ? 's' : ''} \xB7 Auto-refresh cada 30s
            </p>
          </div>
        </div>
        <button
          onClick={() => ordersResource.reload()}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 12,
            background: '#111827', border: '1px solid #374151',
            color: '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {ordersResource.status === 'loading' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100, color: '#374151' }}>
          <RefreshCw size={64} style={{ marginBottom: 20, opacity: 0.3, animation: 'spin 2s linear infinite' }} />
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Cargando pedidos</div>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : ordersResource.status === 'error' ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100, color: '#EF4444' }}>
          <AlertCircle size={64} style={{ marginBottom: 20, opacity: 0.8 }} />
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Error al cargar</div>
          <div style={{ fontSize: 14, color: '#F87171' }}>{ordersResource.error}</div>
          <button onClick={() => ordersResource.reload()} style={{ marginTop: 20, padding: '10px 20px', borderRadius: 8, background: '#374151', color: '#fff', border: 'none', cursor: 'pointer' }}>Reintentar</button>
        </div>
      ) : ordersResource.isForbidden ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100, color: '#EF4444' }}>
          <AlertCircle size={64} style={{ marginBottom: 20, opacity: 0.8 }} />
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Acceso denegado</div>
          <div style={{ fontSize: 14, color: '#F87171' }}>No tienes permiso para ver los pedidos de cocina.</div>
        </div>
      ) : activeOrders.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 100, color: '#374151' }}>
          <ChefHat size={64} style={{ marginBottom: 20, opacity: 0.3 }} />
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Sin pedidos activos</div>
          <div style={{ fontSize: 14, color: '#4B5563' }}>Los nuevos pedidos aparecerán aquí automáticamente</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 20 }}>
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
