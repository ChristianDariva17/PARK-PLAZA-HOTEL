import { useState, useCallback } from 'react';
import { ShoppingCart, ChefHat, BarChart3, Clock, CheckCircle2, XCircle, Flame, Bell, Star, Filter, Search, RefreshCw, Plus, ArrowRight } from 'lucide-react';
import { useHotel } from '../../../state/hotelContext.js';
import { formatMoney } from '../../../domain/hotelModel.js';

const ORDER_STATUSES = ['Pedido recibido', 'Confirmado', 'En preparacion', 'Listo', 'Entregado', 'Pagado'];
const KANBAN_STAGES = ['Pedido recibido', 'Confirmado', 'En preparacion', 'Listo'];
const PAYMENT_METHODS = ['Efectivo', 'Tarjeta', 'Yape', 'Plin', 'Transferencia', 'Cargar a la habitacion'];

const statusColors = {
  'Pedido recibido': { bg: 'rgba(245,158,11,0.12)', border: '#f59e0b', text: '#f59e0b', icon: Bell },
  'Confirmado': { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', text: '#3b82f6', icon: CheckCircle2 },
  'En preparacion': { bg: 'rgba(249,115,22,0.12)', border: '#f97316', text: '#f97316', icon: Flame },
  'Listo': { bg: 'rgba(16,185,129,0.12)', border: '#10b981', text: '#10b981', icon: Star },
  'Entregado': { bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6', text: '#8b5cf6', icon: ArrowRight },
  'Pagado': { bg: 'rgba(34,197,94,0.12)', border: '#22c55e', text: '#22c55e', icon: CheckCircle2 },
  'Cancelado': { bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: '#ef4444', icon: XCircle },
};

function StatusBadge({ status }) {
  const cfg = statusColors[status] || { bg: 'rgba(156,163,175,0.12)', border: '#6b7280', text: '#9ca3af', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text, fontSize: 11, fontWeight: 700 }}>
      <Icon size={10} />{status}
    </span>
  );
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '18px 22px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ background: `${color}20`, borderRadius: 10, padding: 10 }}><Icon size={20} color={color} /></div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>{value}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function OrderCard({ order, onAdvance, onCancel, onSelect }) {
  const cfg = statusColors[order.status] || statusColors['Cancelado'];
  const idx = ORDER_STATUSES.indexOf(order.status);
  const canAdvance = idx >= 0 && idx < ORDER_STATUSES.indexOf('Pagado');
  const canCancel = ['Pedido recibido', 'Confirmado', 'En preparacion'].includes(order.status);
  return (
    <div onClick={() => onSelect(order)} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: `1px solid ${cfg.border}30`, padding: '12px 14px', cursor: 'pointer', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{order.source}</div>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#d4af37' }}>{formatMoney(order.total)}</div>
      </div>
      <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 8 }}>{(order.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ')}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{order.estimatedMinutes} min</div>
        <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
          {canCancel && <button onClick={() => onCancel(order)} style={{ padding: '3px 8px', borderRadius: 7, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>}
          {canAdvance && <button onClick={() => onAdvance(order)} style={{ padding: '3px 10px', borderRadius: 7, background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.4)', color: '#d4af37', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Avanzar</button>}
        </div>
      </div>
    </div>
  );
}

function KanbanBoard({ orders, onAdvance, onCancel, onSelect }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, overflowX: 'auto', minWidth: 800 }}>
      {KANBAN_STAGES.map(stage => {
        const cfg = statusColors[stage];
        const Icon = cfg.icon;
        const stageOrders = orders.filter(o => o.status === stage);
        return (
          <div key={stage} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: `1px solid ${cfg.border}30`, padding: '14px 12px', minHeight: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: `1px solid ${cfg.border}30` }}>
              <Icon size={14} color={cfg.text} />
              <span style={{ fontSize: 12, fontWeight: 700, color: cfg.text }}>{stage}</span>
              <span style={{ marginLeft: 'auto', background: cfg.bg, color: cfg.text, borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 800, border: `1px solid ${cfg.border}` }}>{stageOrders.length}</span>
            </div>
            {stageOrders.length === 0
              ? <div style={{ textAlign: 'center', color: '#475569', fontSize: 12, padding: '30px 0' }}>Sin pedidos</div>
              : stageOrders.map(o => <OrderCard key={o.id} order={o} onAdvance={onAdvance} onCancel={onCancel} onSelect={onSelect} />)
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
    items: order?.items?.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity })) || [{ menuItemId: '', quantity: 1 }],
    paymentMethod: order?.paymentMethod || 'Efectivo',
    estimatedMinutes: order?.estimatedMinutes || 15,
    comment: order?.comment || '',
  });
  const activeRecipes = (recipes || []).filter(r => r.status === 'active');
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setItem = (idx, k, v) => { const u = [...form.items]; u[idx] = { ...u[idx], [k]: v }; setForm(f => ({ ...f, items: u })); };
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { menuItemId: '', quantity: 1 }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }));
  const total = form.items.reduce((s, item) => { const r = (recipes||[]).find(r => r.id === item.menuItemId); return s + (r ? r.salePrice * item.quantity : 0); }, 0);
  const handleSubmit = async (e) => {
    e.preventDefault();
    const body = { source: form.source, stayId: form.stayId || null, items: form.items.filter(i => i.menuItemId).map(i => ({ menuItemId: i.menuItemId, quantity: Number(i.quantity) })), paymentMethod: form.paymentMethod, estimatedMinutes: Number(form.estimatedMinutes), comment: form.comment || null };
    try {
      if (order) { await restaurantCommands.updateOrder(order.id, body); notify?.({ type: 'success', title: 'Pedido actualizado' }); }
      else { await restaurantCommands.createOrder(body); notify?.({ type: 'success', title: 'Pedido creado', message: 'El pedido esta visible en cocina.' }); }
      onClose();
    } catch (err) { notify?.({ type: 'error', title: 'Error', message: err.message }); }
  };
  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 12px', color: '#f1f5f9', fontSize: 14, width: '100%', boxSizing: 'border-box' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#1a1f2e', borderRadius: 20, border: '1px solid rgba(212,175,55,0.25)', padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ margin: 0, color: '#f1f5f9', fontSize: 18, fontWeight: 800 }}>{order ? 'Editar Pedido' : 'Nuevo Pedido QR'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 22 }}>x</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Origen</span>
              <select value={form.source} onChange={e => setField('source', e.target.value)} style={inputStyle}>
                {['Habitacion', 'Barra', 'Terraza'].map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Metodo de pago</span>
              <select value={form.paymentMethod} onChange={e => setField('paymentMethod', e.target.value)} style={inputStyle}>
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>
          {form.source === 'Habitacion' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Estadia</span>
              <select value={form.stayId} onChange={e => setField('stayId', e.target.value)} style={inputStyle}>
                <option value="">-- Sin vincular --</option>
                {(stays||[]).map(s => <option key={s.id} value={s.id}>Hab. {s.roomNumber || s.roomId}</option>)}
              </select>
            </label>
          )}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>Productos</span>
              <button type="button" onClick={addItem} style={{ padding: '4px 12px', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, color: '#d4af37', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ Agregar</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 32px', gap: 8, marginBottom: 8 }}>
                <select value={item.menuItemId} onChange={e => setItem(i, 'menuItemId', e.target.value)} style={{ ...inputStyle, padding: '8px 10px' }}>
                  <option value="">-- Seleccionar --</option>
                  {activeRecipes.map(r => <option key={r.id} value={r.id}>{r.name} - {formatMoney(r.salePrice)}</option>)}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden' }}>
                  <button type="button" onClick={() => setItem(i, 'quantity', Math.max(1, item.quantity - 1))} style={{ padding: '0 8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>-</button>
                  <span style={{ flex: 1, textAlign: 'center', color: '#f1f5f9', fontWeight: 700 }}>{item.quantity}</span>
                  <button type="button" onClick={() => setItem(i, 'quantity', item.quantity + 1)} style={{ padding: '0 8px', background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontSize: 18 }}>+</button>
                </div>
                <button type="button" onClick={() => removeItem(i)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', cursor: 'pointer' }}>x</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(212,175,55,0.06)', borderRadius: 10, border: '1px solid rgba(212,175,55,0.15)' }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Total estimado</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#d4af37' }}>{formatMoney(total)}</span>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>ETA (minutos)</span>
            <input type="number" min="1" value={form.estimatedMinutes} onChange={e => setField('estimatedMinutes', e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Comentario</span>
            <textarea value={form.comment} onChange={e => setField('comment', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 6 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
            <button type="submit" style={{ padding: '10px 24px', borderRadius: 10, background: 'linear-gradient(135deg, #d4af37, #f0d060)', border: 'none', color: '#0a0f1a', cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>{order ? 'Guardar' : 'Crear pedido'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OrdersView({ notify }) {
  const { state, restaurantCommands } = useHotel();
  const [view, setView] = useState('kanban');
  const [filterStatus, setFilterStatus] = useState('Activos');
  const [filterSource, setFilterSource] = useState('Todos');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState(undefined);
  const [selected, setSelected] = useState(null);

  const orders = state.orders || [];
  const recipes = state.recipes || [];
  const stays = state.stays || [];

  const filtered = orders.filter(o => {
    const mStatus = filterStatus === 'Todos' ? true : filterStatus === 'Activos' ? !['Pagado','Cancelado'].includes(o.status) : filterStatus === 'Historial' ? ['Pagado','Cancelado'].includes(o.status) : o.status === filterStatus;
    const mSource = filterSource === 'Todos' || o.source === filterSource;
    const mSearch = !search || (o.items||[]).some(i => i.name.toLowerCase().includes(search.toLowerCase()));
    return mStatus && mSource && mSearch;
  });

  const activeOrders = orders.filter(o => !['Pagado','Cancelado'].includes(o.status));
  const inKitchen = orders.filter(o => ['Confirmado','En preparacion'].includes(o.status));
  const paidToday = orders.filter(o => o.status === 'Pagado');
  const revenue = paidToday.reduce((s, o) => s + o.total, 0);

  const handleAdvance = useCallback(async (order) => {
    const i = ORDER_STATUSES.indexOf(order.status);
    if (i < 0 || i >= ORDER_STATUSES.indexOf('Pagado')) return;
    try {
      await restaurantCommands.advanceOrder(order.id, { expectedStatus: order.status });
      notify?.({ type: 'success', title: 'Pedido avanzado', message: 'Estado actualizado.' });
    } catch (err) { notify?.({ type: 'error', title: 'Error', message: err.message }); }
  }, [restaurantCommands, notify]);

  const handleCancel = useCallback(async (order) => {
    if (!window.confirm('Cancelar este pedido?')) return;
    try {
      await restaurantCommands.cancelOrder(order.id, { reason: 'Cancelacion operativa' });
      notify?.({ type: 'success', title: 'Pedido cancelado' });
    } catch (err) { notify?.({ type: 'error', title: 'Error', message: err.message }); }
  }, [restaurantCommands, notify]);

  const btnBase = { display: 'flex', alignItems: 'center', gap: 6, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 };
  const selectStyle = { padding: '8px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#f1f5f9', fontSize: 13 };

  return (
    <div style={{ fontFamily: '"Inter",system-ui,sans-serif', color: '#f1f5f9' }}>
      <div style={{ background: 'linear-gradient(135deg,rgba(212,175,55,0.1),rgba(249,115,22,0.08))', borderRadius: 20, border: '1px solid rgba(212,175,55,0.2)', padding: '22px 26px', marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}><ShoppingCart size={22} color="#d4af37" /> Pedidos QR y Cocina</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>Habitacion - Barra - Terraza</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => restaurantCommands?.reload()} style={{ ...btnBase, padding: '9px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8' }}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button onClick={() => setEditor(null)} style={{ ...btnBase, padding: '9px 20px', background: 'linear-gradient(135deg,#d4af37,#f0d060)', border: 'none', color: '#0a0f1a', fontWeight: 800, fontSize: 14 }}>
            <Plus size={16} /> Nuevo Pedido
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 22 }}>
        <MetricCard icon={ShoppingCart} label="Activos" value={activeOrders.length} color="#d4af37" />
        <MetricCard icon={Flame} label="En cocina" value={inKitchen.length} color="#f97316" />
        <MetricCard icon={CheckCircle2} label="Pagados" value={paidToday.length} color="#22c55e" />
        <MetricCard icon={BarChart3} label="Facturado" value={formatMoney(revenue)} color="#8b5cf6" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
          {[['kanban','Vista Cocina',ChefHat],['list','Lista Completa',Filter]].map(([v,label,Icon]) => (
            <button key={v} onClick={() => setView(v)} style={{ ...btnBase, padding: '7px 16px', background: view===v?'rgba(212,175,55,0.2)':'none', border: view===v?'1px solid rgba(212,175,55,0.4)':'1px solid transparent', color: view===v?'#d4af37':'#64748b' }}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...selectStyle, paddingLeft: 32, width: 170 }} />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
            {['Activos','Historial','Todos',...ORDER_STATUSES].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={selectStyle}>
            {['Todos','Habitacion','Barra','Terraza'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {view === 'kanban' ? (
        <KanbanBoard orders={filtered} onAdvance={handleAdvance} onCancel={handleCancel} onSelect={setSelected} />
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
              <ShoppingCart size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 16, fontWeight: 700 }}>Sin pedidos</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Origen','Productos','Total','ETA','Estado','Acciones'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => {
                  const i = ORDER_STATUSES.indexOf(order.status);
                  const canAdvance = i >= 0 && i < ORDER_STATUSES.indexOf('Pagado');
                  const canCancel = ['Pedido recibido','Confirmado','En preparacion'].includes(order.status);
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#cbd5e1' }}>{order.source}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', maxWidth: 200 }}>{(order.items||[]).map(it => it.quantity + 'x ' + it.name).join(', ')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#d4af37' }}>{formatMoney(order.total)}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#64748b' }}>{order.estimatedMinutes} min</td>
                      <td style={{ padding: '12px 16px' }}><StatusBadge status={order.status} /></td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setSelected(order)} style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Ver</button>
                          {canAdvance && <button onClick={() => handleAdvance(order)} style={{ padding: '4px 12px', borderRadius: 8, background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)', color: '#d4af37', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Avanzar</button>}
                          {canCancel && <button onClick={() => handleCancel(order)} style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>X</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editor !== undefined && <OrderFormModal order={editor} stays={stays} recipes={recipes} onClose={() => setEditor(undefined)} restaurantCommands={restaurantCommands} notify={notify} />}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setSelected(null)}>
          <div style={{ background: '#1a1f2e', borderRadius: 20, border: '1px solid rgba(212,175,55,0.25)', padding: 28, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h3 style={{ margin: 0, color: '#f1f5f9', fontWeight: 800 }}>Detalle del Pedido</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 22 }}>x</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <StatusBadge status={selected.status} />
              <span style={{ fontWeight: 800, color: '#d4af37', fontSize: 20 }}>{formatMoney(selected.total)}</span>
            </div>
            {[
              ['Origen', selected.source],
              ['Pago', selected.paymentMethod],
              ['ETA', selected.estimatedMinutes + ' min'],
              ['Responsable', selected.responsible],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>{l}</span>
                <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              {(selected.items||[]).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: '#cbd5e1' }}>{item.quantity}x {item.name}</span>
                  <span style={{ fontSize: 13, color: '#d4af37', fontWeight: 700 }}>{formatMoney(item.subtotal)}</span>
                </div>
              ))}
            </div>
            {selected.comment && <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(212,175,55,0.06)', borderRadius: 8, fontSize: 12, color: '#94a3b8' }}>Nota: {selected.comment}</div>}
            {selected.cancelReason && <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>Cancelado: {selected.cancelReason}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              {['Pedido recibido','Confirmado','En preparacion'].includes(selected.status) && <button onClick={() => { handleCancel(selected); setSelected(null); }} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>}
              {ORDER_STATUSES.indexOf(selected.status) < ORDER_STATUSES.indexOf('Pagado') && ORDER_STATUSES.indexOf(selected.status) >= 0 && <button onClick={() => { handleAdvance(selected); setSelected(null); }} style={{ padding: '8px 20px', borderRadius: 10, background: 'linear-gradient(135deg,#d4af37,#f0d060)', border: 'none', color: '#0a0f1a', cursor: 'pointer', fontWeight: 800 }}>Avanzar estado</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
