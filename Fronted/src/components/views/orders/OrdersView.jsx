import { useState, useCallback, useEffect } from 'react';
import { ShoppingCart, Clock, CheckCircle2, XCircle, Flame, Bell, Star, Search, RefreshCw, Plus, ArrowRight, Wine, Coffee, UtensilsCrossed, Minus } from 'lucide-react';
import { useHotel } from '../../../state/hotelContext.js';
import { formatMoney } from '../../../domain/hotelModel.js';
import { useRestaurantResource } from '../../../restaurant/useRestaurantResource.js';
import { Dialog } from '../../ui/Overlay';
import { P1Button, P1Input, P1Select } from '../../ui/P1Atoms';

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

  const tone = isUrgent ? 'danger' : isWarning ? 'warning' : 'success';

  return (
    <span className={`elapsed-badge elapsed-badge-${tone}`}>
      <Clock size={11} /> {elapsedMins} min
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, color }) {
  const tone = color === '#9333ea' ? 'purple' : color === '#f97316' ? 'orange' : color === '#b45309' ? 'brown' : 'gold';
  return (
    <div className={`module-metric-card module-metric-${tone}`}>
      <div className="module-metric-icon"><Icon size={24} /></div>
      <div className="module-metric-content">
        <div className="module-metric-value">{value}</div>
        <div className="module-metric-label">{label}</div>
      </div>
    </div>
  );
}

function OrderCard({ order, onAdvance, onAdvanceItem, onCancel, stationFilter }) {
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
    <article className="order-card">
      {/* Top Header */}
      <div className="order-card-header">
        <div className="order-card-meta">
          <span className="order-source">
            {order.source}
          </span>
          <ElapsedBadge createdAt={order.createdAt} />
        </div>
        <div className="order-total">{formatMoney(order.total)}</div>
      </div>

      {/* Items Breakdown with Station Badges & Notes */}
      <div className="order-items">
        {(itemsToShow.length ? itemsToShow : order.items || []).map((i, idx) => {
          const isBar = i.station === 'bar';
          const isCoffee = i.station === 'coffee';
          const isReady = i.status === 'listo' || i.status === 'entregado';

          return (
            <div key={i.id || idx} className={`order-item ${isReady ? 'is-ready' : ''}`}>
              <div>
                <span className="order-item-name">{i.quantity}x {itemDisplayName(i)}</span>
                <span className={`order-station order-station-${isBar ? 'bar' : isCoffee ? 'coffee' : 'kitchen'}`}>
                  {isBar ? '🍸 Bar' : isCoffee ? '☕ Café' : '👨‍🍳 Cocina'}
                </span>
                {i.notes && (
                  <div className="order-item-note">
                    💬 {i.notes}
                  </div>
                )}
              </div>

              {/* Station Action Button */}
              {onAdvanceItem && !isReady && ['Confirmado', 'En preparacion'].includes(order.status) && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAdvanceItem(order.id, i.id, 'listo'); }}
                  className="btn btn-sm btn-success"
                  title="Marcar este ítem como listo en la estación"
                >
                  ✓ Listo
                </button>
              )}
              {isReady && (
                <span className="order-ready">✓ Listo</span>
              )}
            </div>
          );
        })}
      </div>

      {order.comment && (
      <div className="order-comment">
          📝 Nota: {order.comment}
        </div>
      )}

      {/* Bottom Footer Actions */}
      <div className="order-card-footer">
        <div className="order-estimate">
          <Clock size={12} /> {order.estimatedMinutes} min est.
        </div>
        <div className="order-actions" onClick={e => e.stopPropagation()}>
          {canCancel && <button className="btn btn-sm btn-danger" onClick={() => onCancel(order)}>Cancelar</button>}
          {canAdvance && <button className="btn btn-sm btn-warning" onClick={() => onAdvance(order)}>Avanzar Comanda</button>}
        </div>
      </div>
    </article>
  );
}

function KanbanBoard({ orders, onAdvance, onAdvanceItem, onCancel, stationFilter }) {
  return (
    <div className="orders-kanban">
      {KANBAN_STAGES.map(stage => {
        const cfg = statusColors[stage];
        const Icon = cfg.icon;
        const stageOrders = orders.filter(o => o.status === stage);
        return (
          <div key={stage} className="orders-kanban-column">
            <div className="orders-kanban-header">
              <Icon size={16} aria-hidden="true" />
              <span>{cfg.label}</span>
              <span className="orders-kanban-count">{stageOrders.length}</span>
            </div>
            {stageOrders.length === 0
              ? <div className="orders-empty-column">Sin pedidos</div>
              : stageOrders.map(o => <OrderCard key={o.id} order={o} onAdvance={onAdvance} onAdvanceItem={onAdvanceItem} onCancel={onCancel} stationFilter={stationFilter} />)
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
  return (
    <Dialog open onClose={onClose} title={order ? 'Editar Comanda' : 'Nueva Comanda (Cocina / Bar)'} wide>
        <form className="order-form" onSubmit={handleSubmit}>
          <div className="order-form-grid">
            <P1Select label="Origen" value={form.source} onChange={e => setField('source', e.target.value)}>
                {['Barra', 'Habitación', 'Terraza', 'Restaurante'].map(s => <option key={s}>{s}</option>)}
            </P1Select>
            <P1Select label="Método de pago" value={form.paymentMethod} onChange={e => setField('paymentMethod', e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
            </P1Select>
          </div>
          {form.source === 'Habitación' && (
            <P1Select label="Estadía / Habitación" value={form.stayId} onChange={e => setField('stayId', e.target.value)}>
                <option value="">-- Sin vincular --</option>
                {(stays||[]).map(s => <option key={s.id} value={s.id}>Hab. {s.roomNumber || s.roomId}</option>)}
            </P1Select>
          )}
          <div className="order-form-items">
            <div className="order-form-section-header">
              <span>Productos y Notas de Preparación</span>
              <P1Button type="button" variant="secondary" className="btn-sm" onClick={addItem}><Plus size={14} />Agregar</P1Button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="order-form-item">
                <div className="order-form-item-grid">
                  <select className="form-control" value={item.menuItemId} onChange={e => setItemField(i, 'menuItemId', e.target.value)} aria-label={`Producto ${i + 1}`}>
                    <option value=''>-- Seleccionar producto --</option>
                    {activeRecipes.map(r => (
                      <option key={r.id} value={r.id}>{r.name} - S/ {Number(r.salePrice || 0).toFixed(2)} ({r.category})</option>
                    ))}
                  </select>
                  <div className="order-quantity-control">
                    <button type="button" className="icon-button" aria-label={`Reducir cantidad del producto ${i + 1}`} onClick={() => setItemField(i, 'quantity', Math.max(1, item.quantity - 1))}><Minus size={14} /></button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button type="button" className="icon-button" aria-label={`Aumentar cantidad del producto ${i + 1}`} onClick={() => setItemField(i, 'quantity', item.quantity + 1)}><Plus size={14} /></button>
                  </div>
                  <button type="button" className="icon-button btn-danger" aria-label={`Eliminar producto ${i + 1}`} onClick={() => removeItem(i)}><XCircle size={15} /></button>
                </div>
                <P1Input
                  aria-label={`Notas del producto ${i + 1}`}
                  placeholder="Especificación (ej: Sin cebolla, término medio, sin hielo)"
                  value={item.notes || ''}
                  onChange={e => setItemField(i, 'notes', e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="order-form-total">
            <span>Total Estimado:</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div className="form-actions">
            <P1Button type="button" variant="secondary" onClick={onClose}>Cancelar</P1Button>
            <P1Button type="submit">{order ? 'Guardar Cambios' : 'Enviar Comanda'}</P1Button>
          </div>
        </form>
    </Dialog>
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
    <div className="view-container orders-view">
      {/* Top Header */}
      <div className="orders-header">
        <div>
          <h2>
            <ShoppingCart size={28} color="#D97706" /> Comandas & KDS (Cocina y Bar)
          </h2>
          <p>
            División inteligente por estaciones · Tiempos de preparación en vivo · Control de recetas
          </p>
        </div>
        <div className="orders-header-actions">
          <button className="btn btn-outline" onClick={() => { ordersResource.reload(); menuResource.reload(); }}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button className="btn btn-primary" onClick={() => setEditor(null)}>
            <Plus size={16} /> Nueva Comanda
          </button>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="orders-metrics">
        <MetricCard icon={ShoppingCart} label="Comandas Activas" value={activeOrders.length} color="#d4af37" />
        <MetricCard icon={Wine} label="Pendientes en Bar" value={barOrders.length} color="#9333ea" />
        <MetricCard icon={UtensilsCrossed} label="En Cocina" value={kitchenOrders.length} color="#f97316" />
        <MetricCard icon={Coffee} label="Cafetería" value={coffeeOrders.length} color="#b45309" />
      </div>

      {/* KDS Station Filter Tabs */}
      <div className="orders-toolbar">
        <div className="orders-station-tabs" role="tablist" aria-label="Filtrar por estación">
          {[
            { id: 'Todos', label: `Todas (${activeOrders.length})`, icon: ShoppingCart },
            { id: 'bar', label: `🍸 KDS Bar (${barOrders.length})`, icon: Wine },
            { id: 'kitchen', label: `👨‍🍳 KDS Cocina (${kitchenOrders.length})`, icon: UtensilsCrossed },
            { id: 'coffee', label: `☕ Cafetería (${coffeeOrders.length})`, icon: Coffee },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStationFilter(tab.id)}
              className={`orders-station-tab ${stationFilter === tab.id ? 'active' : ''}`}
              role="tab"
              aria-selected={stationFilter === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search and Status */}
        <div className="orders-filters">
          <label className="orders-search"><Search size={15} aria-hidden="true" />
            <input
              type="text"
              aria-label="Buscar producto en comanda"
              placeholder="Buscar producto en comanda..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <select className="form-control orders-status-filter" aria-label="Filtrar por estado" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
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
