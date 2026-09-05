import { useState, useCallback, useEffect } from 'react';
import { ShoppingCart, ChefHat, BarChart3, Clock, CheckCircle2, XCircle, Flame, Bell, Star, Filter, Search, RefreshCw, Plus, ArrowRight, Wine, Coffee, UtensilsCrossed } from 'lucide-react';
import { useHotel } from '../../../state/hotelContext.js';
import { formatMoney } from '../../../domain/hotelModel.js';
import { getItemDisplayPrice } from '../../../restaurant/restaurantModel.js';
import { useRestaurantResource } from '../../../restaurant/useRestaurantResource.js';

const ORDER_STATUSES = ['Pedido recibido', 'Confirmado', 'En preparacion', 'Listo', 'Entregado', 'Pagado'];
const KANBAN_STAGES = ['Pedido recibido', 'Confirmado', 'En preparacion', 'Listo'];
const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Transferencia', 'Cargar a la habitación'];

const statusColors = {
  'Pedido recibido': { bg: '#FEF3C7', border: '#F59E0B', text: '#D97706', icon: Bell, label: 'Pedido recibido' },
  'Confirmado': { bg: '#DBEAFE', border: '#3B82F6', text: '#1D4ED8', icon: CheckCircle2, label: 'Confirmado' },
  'En preparacion': { bg: '#FFEDD5', border: '#F97316', text: '#C2410C', icon: Flame, label: 'En preparación' },
  'Listo': { bg: '#D1FAE5', border: '#10B981', text: '#047857', icon: Star, label: 'Listo' },
  'Entregado': { bg: '#EDE9FE', border: '#8B5CF6', text: '#6D28D9', icon: ArrowRight, label: 'Entregado' },
  'Pagado': { bg: '#DCFCE7', border: '#22C55E', text: '#15803D', icon: CheckCircle2, label: 'Pagado' },
  'Cancelado': { bg: '#FEE2E2', border: '#EF4444', text: '#B91C1C', icon: XCircle, label: 'Cancelado' },
};

function StatusBadge({ status }) {
  const cfg = statusColors[status] || { bg: 'rgba(156,163,175,0.12)', border: '#6b7280', text: '#9ca3af', icon: Clock, label: status };
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text, fontSize: 11, fontWeight: 700 }}>
      <Icon size={10} />{cfg.label}
    </span>
  );
}

function ElapsedBadge({ createdAt }) {
  const [elapsedMins, setElapsedMins] = useState(0);

  useEffect(() => {
    const update = () => {
      if (!createdAt) return;
      const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
      setElapsedMins(Math.max(0, mins));
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [createdAt]);

  const isUrgent = elapsedMins >= 20;
  const isWarning = elapsedMins >= 10 && elapsedMins < 20;

  const bg = isUrgent ? '#FEE2E2' : isWarning ? '#FEF3C7' : '#DCFCE7';
  const color = isUrgent ? '#B91C1C' : isWarning ? '#B45309' : '#15803D';
  const border = isUrgent ? '#FCA5A5' : isWarning ? '#FDE047' : '#86EFAC';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 12,
      background: bg,
      border: `1px solid ${border}`,
      color: color,
      fontSize: 11,
      fontWeight: 800
    }}>
      <Clock size={11} /> {elapsedMins} min
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '18px 22px', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)', flex: 1, minWidth: 180 }}>
      <div style={{ background: `${color}15`, borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={24} color={color} /></div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function OrderCard({ order, onAdvance, onAdvanceItem, onCancel, onSelect, stationFilter }) {
  const idx = ORDER_STATUSES.indexOf(order.status);
  const canAdvance = idx >= 0 && idx < ORDER_STATUSES.indexOf('Pagado');
  const canCancel = ['Pedido recibido', 'Confirmado', 'En preparacion'].includes(order.status);

  function itemDisplayName(item) {
    if (!item) return '';
    return item.variantName || item.menuItemVariantName ? `${item.menuItemName || item.name} — ${item.variantName || item.menuItemVariantName}` : (item.menuItemName || item.name);
  }

  const itemsToShow = (order.items || []).filter(item => {
    if (stationFilter === 'Todos') return true;
    return (item.station || 'kitchen') === stationFilter;
  });

  return (
    <div onClick={() => onSelect(order)} style={{ background: '#FFFFFF', borderRadius: 14, border: `1px solid #E5E7EB`, padding: '16px', cursor: 'pointer', marginBottom: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: '#F3F4F6', padding: '2px 8px', borderRadius: 6 }}>
            {order.source}
          </span>
          <ElapsedBadge createdAt={order.createdAt} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#D97706' }}>{formatMoney(order.total)}</div>
      </div>

      {/* Items Breakdown with Station Badges & Notes */}
      <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(itemsToShow.length ? itemsToShow : order.items || []).map((i, idx) => {
          const isBar = i.station === 'bar';
          const isCoffee = i.station === 'coffee';
          const isReady = i.status === 'listo' || i.status === 'entregado';

          return (
            <div key={i.id || idx} style={{
              padding: '6px 10px',
              borderRadius: 8,
              background: isReady ? 'rgba(34, 197, 94, 0.08)' : '#F9FAFB',
              border: `1px solid ${isReady ? '#86EFAC' : '#E5E7EB'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12.5
            }}>
              <div>
                <span style={{ fontWeight: 700, color: '#111827' }}>{i.quantity}x {itemDisplayName(i)}</span>
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: isBar ? '#9333EA' : isCoffee ? '#D97706' : '#2563EB' }}>
                  {isBar ? '🍸 Bar' : isCoffee ? '☕ Café' : '👨‍🍳 Cocina'}
                </span>
                {i.notes && (
                  <div style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic', marginTop: 2 }}>
                    💬 {i.notes}
                  </div>
                )}
              </div>

              {/* Station Action Button */}
              {onAdvanceItem && !isReady && ['Confirmado', 'En preparacion'].includes(order.status) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAdvanceItem(order.id, i.id, 'listo'); }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#DCFCE7',
                    border: '1px solid #86EFAC',
                    color: '#15803D',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                  title="Marcar este ítem como listo en la estación"
                >
                  ✓ Listo
                </button>
              )}
              {isReady && (
                <span style={{ color: '#15803D', fontSize: 11, fontWeight: 800 }}>✓ Listo</span>
              )}
            </div>
          );
        })}
      </div>

      {order.comment && (
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10, fontStyle: 'italic' }}>
          📝 Nota: {order.comment}
        </div>
      )}

      {/* Bottom Footer Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
        <div style={{ fontSize: 12, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <Clock size={12} /> {order.estimatedMinutes} min est.
        </div>
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          {canCancel && <button onClick={() => onCancel(order)} style={{ padding: '6px 12px', borderRadius: 8, background: '#FEE2E2', border: 'none', color: '#DC2626', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Cancelar</button>}
          {canAdvance && <button onClick={() => onAdvance(order)} style={{ padding: '6px 14px', borderRadius: 8, background: '#FEF3C7', border: 'none', color: '#D97706', fontSize: 11, cursor: 'pointer', fontWeight: 800 }}>Avanzar Comanda</button>}
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({ orders, onAdvance, onAdvanceItem, onCancel, onSelect, stationFilter }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, overflowX: 'auto', minWidth: 800 }}>
      {KANBAN_STAGES.map(stage => {
        const cfg = statusColors[stage];
        const Icon = cfg.icon;
        const stageOrders = orders.filter(o => o.status === stage);
        return (
          <div key={stage} style={{ background: '#F9FAFB', borderRadius: 16, border: `1px solid #E5E7EB`, padding: '16px 14px', minHeight: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid #E5E7EB` }}>
              <Icon size={16} color={cfg.text} />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{cfg.label}</span>
              <span style={{ marginLeft: 'auto', background: cfg.bg, color: cfg.text, borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 800 }}>{stageOrders.length}</span>
            </div>
            {stageOrders.length === 0
              ? <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '40px 0', fontWeight: 500 }}>Sin pedidos</div>
              : stageOrders.map(o => <OrderCard key={o.id} order={o} onAdvance={onAdvance} onAdvanceItem={onAdvanceItem} onCancel={onCancel} onSelect={onSelect} stationFilter={stationFilter} />)
            }
          </div>
        );
      })}
    </div>
  );
}

function OrderFormModal({ order, stays, recipes, onClose, restaurantCommands, notify }) {
  const [form, setForm] = useState({
    source: order?.source || 'Barra',
    stayId: order?.stayId || '',
    items: order?.items?.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes || '' })) || [{ menuItemId: '', quantity: 1, notes: '' }],
    paymentMethod: order?.paymentMethod || 'Efectivo',
    estimatedMinutes: order?.estimatedMinutes || 15,
    comment: order?.comment || '',
  });
  const activeRecipes = (recipes || []).filter(r => r.status === 'active');
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setItemField = (idx, k, v) => {
    const updated = [...form.items];
    updated[idx] = { ...updated[idx], [k]: v };
    setForm(f => ({ ...f, items: updated }));
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { menuItemId: '', quantity: 1, notes: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }));

  const total = form.items.reduce((s, item) => {
    const recipe = (recipes || []).find(r => r.id === item.menuItemId);
    if (!recipe) return s;
    const price = Number(recipe.salePrice || 0);
    return s + (price * item.quantity);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = {
      source: form.source,
      stayId: form.stayId || null,
      items: form.items
        .filter(i => i.menuItemId)
        .map(i => ({ menuItemId: i.menuItemId, quantity: Number(i.quantity), notes: i.notes?.trim() || null })),
      paymentMethod: form.paymentMethod,
      estimatedMinutes: Number(form.estimatedMinutes),
      comment: form.comment || null,
    };
    try {
      if (order) { await restaurantCommands.updateOrder(order.id, body); notify?.('Pedido actualizado', 'Los cambios se han guardado.', 'success'); }
      else { await restaurantCommands.createOrder(body); notify?.('Pedido creado', 'El pedido está visible en cocina y bar.', 'success'); }
      onClose();
    } catch (err) { notify?.('Error', err.message, 'error'); }
  };
  const inputStyle = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', color: '#111827', fontSize: 14, width: '100%', boxSizing: 'border-box', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)', outline: 'none' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.3)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E5E7EB', padding: 28, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ margin: 0, color: '#111827', fontSize: 18, fontWeight: 800 }}>{order ? 'Editar Comanda' : 'Nueva Comanda (Cocina / Bar)'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 22 }}>x</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Origen</span>
              <select value={form.source} onChange={e => setField('source', e.target.value)} style={inputStyle}>
                {['Barra', 'Habitación', 'Terraza', 'Restaurante'].map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Método de pago</span>
              <select value={form.paymentMethod} onChange={e => setField('paymentMethod', e.target.value)} style={inputStyle}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>
          {form.source === 'Habitación' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Estadía / Habitación</span>
              <select value={form.stayId} onChange={e => setField('stayId', e.target.value)} style={inputStyle}>
                <option value="">-- Sin vincular --</option>
                {(stays||[]).map(s => <option key={s.id} value={s.id}>Hab. {s.roomNumber || s.roomId}</option>)}
              </select>
            </label>
          )}
          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Productos y Notas de Preparación</span>
              <button type="button" onClick={addItem} style={{ padding: '4px 12px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8, color: '#D97706', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>+ Agregar</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} style={{ marginBottom: 12, background: '#F9FAFB', padding: '10px', borderRadius: 10, border: '1px solid #E5E7EB' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, marginBottom: 6 }}>
                  <select value={item.menuItemId} onChange={e => setItemField(i, 'menuItemId', e.target.value)} style={{ ...inputStyle, padding: '8px 10px' }}>
                    <option value=''>-- Seleccionar producto --</option>
                    {activeRecipes.map(r => (
                      <option key={r.id} value={r.id}>{r.name} - S/ {Number(r.salePrice || 0).toFixed(2)} ({r.category})</option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
                    <button type='button' onClick={() => setItemField(i, 'quantity', Math.max(1, item.quantity - 1))} style={{ padding: '0 8px', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 18 }}>-</button>
                    <span style={{ flex: 1, textAlign: 'center', color: '#111827', fontWeight: 700 }}>{item.quantity}</span>
                    <button type='button' onClick={() => setItemField(i, 'quantity', item.quantity + 1)} style={{ padding: '0 8px', background: 'none', border: 'none', color: '#D97706', cursor: 'pointer', fontSize: 18 }}>+</button>
                  </div>
                  <button type='button' onClick={() => removeItem(i)} style={{ background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: 8, color: '#DC2626', cursor: 'pointer', fontWeight: 700 }}>x</button>
                </div>
                <input
                  type="text"
                  placeholder="Especificación (ej: Sin cebolla, término medio, sin hielo)"
                  value={item.notes || ''}
                  onChange={e => setItemField(i, 'notes', e.target.value)}
                  style={{ ...inputStyle, padding: '6px 10px', fontSize: 12, color: '#4B5563' }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#FEF3C7', borderRadius: 12, border: '1px solid #FDE047' }}>
            <span style={{ fontWeight: 700, color: '#92400E' }}>Total Estimado:</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#B45309' }}>{formatMoney(total)}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, background: '#F3F4F6', border: '1px solid #E5E7EB', color: '#6B7280', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
            <button type="submit" style={{ padding: '10px 24px', borderRadius: 10, background: '#1E3A8A', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>{order ? 'Guardar Cambios' : 'Enviar Comanda'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OrdersView({ notify }) {
  const { state, restaurantCommands } = useHotel();
  const ordersResource = useRestaurantResource(state, restaurantCommands, 'orders');
  const menuResource = useRestaurantResource(state, restaurantCommands, 'menu');
  
  const [stationFilter, setStationFilter] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Activos');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(undefined);
  const [selected, setSelected] = useState(null);

  const orders = ordersResource.data;
  const recipes = menuResource.data;
  const stays = state.stays || [];

  const filtered = orders.filter(o => {
    const mStatus = filterStatus === 'Todos' ? true : filterStatus === 'Activos' ? !['Pagado','Cancelado'].includes(o.status) : filterStatus === 'Historial' ? ['Pagado','Cancelado'].includes(o.status) : o.status === filterStatus;
    const mSearch = !search || (o.items||[]).some(i => (i.menuItemName || i.name || '').toLowerCase().includes(search.toLowerCase()));
    const mStation = stationFilter === 'Todos' ? true : (o.items || []).some(i => (i.station || 'kitchen') === stationFilter);
    return mStatus && mSearch && mStation;
  });

  const activeOrders = orders.filter(o => !['Pagado','Cancelado'].includes(o.status));
  const inKitchen = orders.filter(o => ['Confirmado','En preparacion'].includes(o.status));
  const barOrders = orders.filter(o => !['Pagado','Cancelado'].includes(o.status) && (o.items || []).some(i => i.station === 'bar'));
  const kitchenOrders = orders.filter(o => !['Pagado','Cancelado'].includes(o.status) && (o.items || []).some(i => (i.station || 'kitchen') === 'kitchen'));
  const coffeeOrders = orders.filter(o => !['Pagado','Cancelado'].includes(o.status) && (o.items || []).some(i => i.station === 'coffee'));

  const handleAdvance = useCallback(async (order) => {
    const i = ORDER_STATUSES.indexOf(order.status);
    if (i < 0 || i >= ORDER_STATUSES.indexOf('Pagado')) return;
    try {
      await restaurantCommands.advanceOrder(order.id, { expectedStatus: order.status });
      notify?.('Comanda avanzada', 'Estado y reservas de stock sincronizados.', 'success');
    } catch (err) { notify?.('Error', err.message, 'error'); }
  }, [restaurantCommands, notify]);

  const handleAdvanceItem = useCallback(async (orderId, itemId, targetStatus) => {
    try {
      await restaurantCommands.advanceOrderItem(orderId, itemId, { status: targetStatus });
      notify?.('Ítem de comanda actualizado', 'Estación actualizada con éxito.', 'success');
    } catch (err) { notify?.('Error', err.message, 'error'); }
  }, [restaurantCommands, notify]);

  const handleCancel = useCallback(async (order) => {
    if (!window.confirm('¿Cancelar esta comanda? Se liberará el stock reservado.')) return;
    try {
      await restaurantCommands.cancelOrder(order.id, { reason: 'Cancelación operativa' });
      notify?.('Comanda cancelada', 'Se ha cancelado la comanda.', 'success');
    } catch (err) { notify?.('Error', err.message, 'error'); }
  }, [restaurantCommands, notify]);

  return (
    <div style={{ padding: '28px 36px', height: '100%', overflowY: 'auto', boxSizing: 'border-box', backgroundColor: '#FAFAFA' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#111827', display: 'flex', alignItems: 'center', gap: 12, letterSpacing: '-0.02em' }}>
            <ShoppingCart size={28} color="#D97706" /> Comandas & KDS (Cocina y Bar)
          </h2>
          <p style={{ margin: '6px 0 0', color: '#6B7280', fontSize: 14, fontWeight: 500 }}>
            División inteligente por estaciones · Tiempos de preparación en vivo · Control de recetas
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { ordersResource.reload(); menuResource.reload(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700, padding: '9px 16px', background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#6B7280' }}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button 
            onClick={() => setEditor(null)} 
            style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 800, padding: '9px 20px', background: '#1E3A8A', border: 'none', color: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
          >
            <Plus size={16} /> Nueva Comanda
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        <MetricCard icon={ShoppingCart} label="Comandas Activas" value={activeOrders.length} color="#d4af37" />
        <MetricCard icon={Wine} label="Pendientes en Bar" value={barOrders.length} color="#9333ea" />
        <MetricCard icon={UtensilsCrossed} label="En Cocina" value={kitchenOrders.length} color="#f97316" />
        <MetricCard icon={Coffee} label="Cafetería" value={coffeeOrders.length} color="#b45309" />
      </div>

      {/* KDS Station Filter Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, background: '#F3F4F6', padding: '4px', borderRadius: 12 }}>
          {[
            { id: 'Todos', label: `Todas (${activeOrders.length})`, icon: ShoppingCart },
            { id: 'bar', label: `🍸 KDS Bar (${barOrders.length})`, icon: Wine },
            { id: 'kitchen', label: `👨‍🍳 KDS Cocina (${kitchenOrders.length})`, icon: UtensilsCrossed },
            { id: 'coffee', label: `☕ Cafetería (${coffeeOrders.length})`, icon: Coffee },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStationFilter(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: stationFilter === tab.id ? '#FFFFFF' : 'transparent',
                color: stationFilter === tab.id ? '#111827' : '#6B7280',
                fontWeight: stationFilter === tab.id ? 800 : 600,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: stationFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search and Status */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', padding: '6px 12px', borderRadius: 10, border: '1px solid #E5E7EB' }}>
            <Search size={15} color="#9CA3AF" />
            <input
              type="text"
              placeholder="Buscar producto en comanda..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: 13, color: '#111827', width: 200 }}
            />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '8px 12px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 10, color: '#111827', fontSize: 13, fontWeight: 600 }}>
            <option value="Activos">Activos</option>
            <option value="Todos">Todos</option>
            <option value="Historial">Historial</option>
            {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <KanbanBoard
        orders={filtered}
        onAdvance={handleAdvance}
        onAdvanceItem={handleAdvanceItem}
        onCancel={handleCancel}
        onSelect={setSelected}
        stationFilter={stationFilter}
      />

      {/* Editor Modal */}
      {editor !== undefined && (
        <OrderFormModal
          order={editor}
          stays={stays}
          recipes={recipes}
          onClose={() => setEditor(undefined)}
          restaurantCommands={restaurantCommands}
          notify={notify}
        />
      )}
    </div>
  );
}
