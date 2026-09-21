import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Check, Edit, History, Lock, Package, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { formatMoney } from '../domain/hotelModel';
import { useHotel } from '../state/hotelContext';
import { useActionPermission } from '../components/auth/useActionPermission';
import { Dialog, TabPanel, Tabs } from '../components/ui/Overlay';
import { FilterBar } from '../components/ui/FilterBar';
import { DataTable, MetricStrip, PageHeader, StatusBadge } from '../components/views/SharedViewParts';
import { useRestaurantResource } from '../restaurant/useRestaurantResource';

const displayDateTime = (value) => value ? new Date(value).toLocaleString('es-PE') : 'No registrado';
const inventoryAvailable = (item) => Math.round((Number(item?.stock ?? 0) - Number(item?.reserved ?? 0)) * 100) / 100;

const getInventoryCategory = (name = '', unit = '') => {
  const n = (name || '').toLowerCase();
  const u = (unit || '').toLowerCase();
  if (u === 'oz' || n.includes('pisco') || n.includes('licor') || n.includes('ron') || n.includes('gin') || n.includes('vodka') || n.includes('vino') || n.includes('whisky') || n.includes('cerveza') || n.includes('jarabe') || n.includes('amargo') || n.includes('curaçao') || n.includes('trago')) {
    return { id: 'bar', label: 'Bar & Coctelería', icon: '🍸' };
  }
  if (n.includes('lomo') || n.includes('pollo') || n.includes('carne') || n.includes('panceta') || n.includes('bife') || n.includes('tocino') || n.includes('costilla')) {
    return { id: 'carnes', label: 'Carnes & Aves', icon: '🥩' };
  }
  if (n.includes('pescado') || n.includes('corvina') || n.includes('marisco') || n.includes('calamar') || n.includes('langostino') || n.includes('pulpo') || n.includes('concha') || n.includes('camaron') || n.includes('ceviche')) {
    return { id: 'pescados', label: 'Pescados & Mariscos', icon: '🐟' };
  }
  if (n.includes('cebolla') || n.includes('limon') || n.includes('limón') || n.includes('aji') || n.includes('ají') || n.includes('tomate') || n.includes('menta') || n.includes('culantro') || n.includes('papa') || n.includes('choclo') || n.includes('camote') || n.includes('palta') || n.includes('lechuga') || n.includes('hierba') || n.includes('rocoto') || n.includes('fruta')) {
    return { id: 'frescos', label: 'Frescos & Verduras', icon: '🥬' };
  }
  if (n.includes('queso') || n.includes('leche') || n.includes('huevo') || n.includes('mantequilla') || n.includes('crema')) {
    return { id: 'lacteos', label: 'Lácteos & Huevos', icon: '🧀' };
  }
  if (n.includes('arroz') || n.includes('harina') || n.includes('fideo') || n.includes('pasta') || n.includes('aceite') || n.includes('vinagre') || n.includes('salsa') || n.includes('azucar') || n.includes('sal') || n.includes('pimienta') || n.includes('sillao') || n.includes('kion')) {
    return { id: 'abarrotes', label: 'Abarrotes & Secos', icon: '🍚' };
  }
  return { id: 'suministros', label: 'Insumos Generales', icon: '📦' };
};

const getCleanSku = (item) => {
  if (!item?.id) return 'INS-0000';
  const cleanId = String(item.id).replace(/-/g, '').slice(-4).toUpperCase();
  return `INS-${cleanId}`;
};

// ─── Inventory Item Editor Modal ─────────────────────────────────────────────
function InventoryItemEditor({ item, onClose, notify }) {
  const { state, inventoryCommands } = useHotel();
  const canCreate = useActionPermission('INVENTORY_ITEM_CREATE');
  const canUpdate = useActionPermission('INVENTORY_ITEM_UPDATE');
  const allowed = item ? canUpdate : canCreate;

  const suppliersList = state.suppliers || [];

  const [form, setForm] = useState(item ? {
    name: item.name || '',
    unit: item.unit || 'unidad',
    lot: item.lot || '',
    minimum: item.minimum !== undefined ? item.minimum : 1,
    cost: item.cost !== undefined ? item.cost : 0,
    supplierId: item.supplierId || '',
  } : {
    name: '',
    unit: 'Litro',
    lot: '',
    minimum: 2,
    cost: 0,
    supplierId: '',
  });

  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState(null);
  const [showAdjustPrompt, setShowAdjustPrompt] = useState(false);
  const [createdItem, setCreatedItem] = useState(null);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const buildBody = () => {
    const minimum = Number(form.minimum);
    const cost = Number(form.cost);
    if (!form.name.trim() || form.name.trim().length < 2) return { error: 'El nombre debe tener entre 2 y 160 caracteres.' };
    if (!form.unit.trim()) return { error: 'La unidad de medida es obligatoria.' };
    if (!Number.isFinite(minimum) || minimum < 0) return { error: 'El stock mínimo debe ser un número mayor o igual a 0.' };
    if (!Number.isFinite(cost) || cost < 0) return { error: 'El costo unitario debe ser un número mayor o igual a 0.' };
    return {
      body: {
        name: form.name.trim(),
        unit: form.unit.trim().slice(0, 40),
        lot: form.lot.trim() || null,
        minimum,
        cost,
        supplierId: form.supplierId.trim() || null,
      }
    };
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const { body, error } = buildBody();
    if (error) { setFormError(error); return; }
    setPending(true);
    try {
      if (item) {
        await inventoryCommands.updateItem(item.id, body);
        notify('Insumo actualizado', `${body.name} actualizado en almacén.`, 'success');
        onClose();
      } else {
        const created = await inventoryCommands.createItem(body);
        notify('Insumo registrado', `${body.name} se agregó al catálogo de almacén.`, 'success');
        setCreatedItem(created);
        setShowAdjustPrompt(true);
      }
    } catch (err) {
      const status = err?.status || err?.data?.statusCode;
      if (status === 401) { notify('Sesión vencida', 'Iniciá sesión nuevamente.', 'error'); return; }
      if (status === 403) { notify('Sin permiso', 'No tenés permiso para esta operación.', 'error'); return; }
      setFormError(err?.data?.message || err?.message || 'No se pudo guardar el insumo.');
    } finally {
      setPending(false);
    }
  };

  if (!allowed) return null;

  if (showAdjustPrompt && createdItem) {
    return (
      <div className="detail-stack">
        <div className="alert-banner alert-banner-info">
          El insumo <strong>{createdItem.name}</strong> fue creado con stock 0. ¿Deseas registrar su stock inicial mediante un ajuste?
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar sin ajustar</button>
          <button type="button" className="btn btn-primary" onClick={() => { setShowAdjustPrompt(false); onClose(); }}>
            Registrar stock inicial
          </button>
        </div>
      </div>
    );
  }

  const categoryInfo = getInventoryCategory(form.name, form.unit);

  return (
    <form className="form-grid" onSubmit={submit}>
      {/* Live Item Preview Banner */}
      <div className="span-2 inventory-editor-preview">
        <div className="inventory-editor-preview-main">
          <div className="inventory-editor-preview-icon">
            {categoryInfo.icon}
          </div>
          <div>
            <span className="inventory-editor-preview-category">
              {categoryInfo.label}
            </span>
            <h4 className="inventory-editor-preview-name">
              {form.name.trim() || 'Nombre del Insumo / Mercadería'}
            </h4>
          </div>
        </div>
        <div className="inventory-editor-preview-cost">
          <span className="inventory-editor-preview-cost-label">Costo Unitario</span>
          <strong className="inventory-editor-preview-cost-value">
            {Number(form.cost) > 0 ? formatMoney(Number(form.cost)) : 'S/ 0.00'}
          </strong>
        </div>
      </div>

      <label className="span-2">
        Nombre Oficial del Insumo *
        <input
          required
          value={form.name}
          maxLength={160}
          placeholder="Ej: Pisco Quebranta 42°, Lomo Fino de Res, Aceite de Oliva Extra Virgen..."
          onChange={(e) => set('name', e.target.value)}
          disabled={pending}
          className="inventory-editor-name-input" />
      </label>

      <label>
        Unidad de Medida Oficial *
        <select
          required
          value={form.unit}
          onChange={(e) => set('unit', e.target.value)}
          disabled={pending}
          className="inventory-editor-unit-select"
        >
          <option value="und">Unidad (und)</option>
          <option value="kg">Kilo (kg)</option>
          <option value="g">Gramo (g)</option>
          <option value="Litro">Litro (L)</option>
          <option value="ml">Mililitro (ml)</option>
          <option value="oz">Onza (oz)</option>
          <option value="botella">Botella</option>
          <option value="paquete">Paquete</option>
          <option value="lata">Lata</option>
          <option value="caja">Caja</option>
          <option value="porcion">Porción</option>
          {!['und', 'kg', 'g', 'Litro', 'ml', 'oz', 'botella', 'paquete', 'lata', 'caja', 'porcion'].includes(form.unit) && form.unit && (
            <option value={form.unit}>{form.unit}</option>
          )}
        </select>
      </label>

      <label>
        Lote o Partida de Recepción
        <input
          value={form.lot}
          maxLength={60}
          placeholder="Ej: LOT-2026-09, Sin lote..."
          onChange={(e) => set('lot', e.target.value)}
          disabled={pending}
        />
      </label>

      <label>
        Stock Mínimo de Alerta *
        <input
          type="number"
          min="0"
          step="any"
          required
          value={form.minimum}
          onChange={(e) => set('minimum', e.target.value)}
          disabled={pending}
        />
      </label>

      <label>
        Costo Unitario de Adquisición (S/ PEN) *
        <div className="inventory-editor-cost-control">
          <span className="inventory-editor-currency">S/</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.cost}
            onChange={(e) => set('cost', e.target.value)}
            disabled={pending}
            className="inventory-editor-cost-input"
          />
        </div>
      </label>

      <label className="span-2">
        Proveedor Habitual Homologado
        <select
          value={form.supplierId}
          onChange={(e) => set('supplierId', e.target.value)}
          disabled={pending}
          className="inventory-editor-supplier-select">
          <option value="">Sin proveedor asignado</option>
          {suppliersList.map((sup) => (
            <option key={sup.id} value={sup.id}>
              {sup.tradeName || sup.legalName} ({sup.taxId || 'RUC'})
            </option>
          ))}
        </select>
      </label>

      {formError ? <div className="alert-banner alert-banner-danger span-2" role="alert">{formError}</div> : null}

      <div className="form-actions span-2 inventory-editor-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancelar</button>
        <button className="btn btn-primary inventory-editor-submit" disabled={pending}>
          {pending ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}
          {pending ? 'Guardando…' : (item ? 'Guardar Cambios' : 'Registrar Insumo')}
        </button>
      </div>
    </form>
  );
}

// ─── Inventory Adjustment Modal with Live Calculator ─────────────────────────
function InventoryAdjustment({ item, onClose, notify }) {
  const { inventoryCommands } = useHotel();
  const allowed = useActionPermission('INVENTORY_ADJUST');
  const [quantity, setQuantity] = useState('');
  const [type, setType] = useState('Entrada');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState(null);

  const currentStock = Number(item.stock) || 0;
  const currentReserved = Number(item.reserved) || 0;
  const currentAvailable = currentStock - currentReserved;
  const adjustmentNum = Number(quantity) || 0;
  const resultantStock = Math.max(0, currentStock + adjustmentNum);
  const resultantAvailable = resultantStock - currentReserved;

  const setQuickAdjustment = (val) => {
    setQuantity(String(val));
    if (val > 0 && type === 'Merma') setType('Entrada');
    if (val < 0 && type === 'Entrada') setType('Merma');
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty === 0) {
      setFormError('Indicá una cantidad distinta de cero para el ajuste.');
      return;
    }
    setPending(true);
    try {
      await inventoryCommands.adjustStock(item.id, {
        quantity: qty,
        type,
        note: note.trim().slice(0, 300) || null,
      });
      notify('Ajuste confirmado', `${item.name}: ${qty > 0 ? '+' : ''}${qty} ${item.unit} (${type}).`, 'success');
      onClose();
    } catch (err) {
      const status = err?.status || err?.data?.statusCode;
      if (status === 401) { notify('Sesión vencida', 'Iniciá sesión nuevamente.', 'error'); setPending(false); return; }
      if (status === 403) { notify('Sin permiso', 'No tenés permiso para ajustar inventario.', 'error'); setPending(false); return; }
      if (status === 404) {
        notify('Insumo no encontrado', 'El insumo fue modificado o ya no existe.', 'error');
        inventoryCommands.reloadInventory().catch(() => {});
        onClose();
        return;
      }
      setFormError(err?.data?.message || err?.message || 'No se pudo confirmar el ajuste.');
    } finally {
      setPending(false);
    }
  };

  if (!allowed) return null;

  return (
    <form className="form-grid" onSubmit={submit}>
      {/* Visual Live Stock Transition Display */}
      <div className="span-2 inv-adjust-display">
        <div>
          <span className="inventory-adjust-label">
            Stock Actual
          </span>
          <strong className="inventory-adjust-current-value">
            {currentStock} <small className="inventory-adjust-unit">{item.unit}</small>
          </strong>
          <span className="inventory-adjust-available">
            Disp: {currentAvailable} {item.unit}
          </span>
        </div>

        <div className="inventory-adjust-symbol">
          {adjustmentNum >= 0 ? '+' : '−'}
        </div>

        <div>
          <span className="inventory-adjust-label">
            Ajuste
          </span>
          <strong className="inventory-adjust-value">
            {adjustmentNum !== 0 ? `${adjustmentNum > 0 ? '+' : ''}${adjustmentNum}` : '0'} <small className="inventory-adjust-unit">{item.unit}</small>
          </strong>
          <span className="inventory-adjust-type">
            {type}
          </span>
        </div>

        <div className="inventory-adjust-result-symbol">
          =
        </div>

        <div>
          <span className="inventory-adjust-label">
            Stock Resultante
          </span>
          <strong className="inventory-adjust-result-value">
            {resultantStock} <small className="inventory-adjust-unit">{item.unit}</small>
          </strong>
          <span className="inventory-adjust-result-status">
            {resultantAvailable < Number(item.minimum) ? '⚠️ Quedará bajo mínimo' : '🟢 Stock suficiente'}
          </span>
        </div>
      </div>

      {/* Quick Buttons for One-Click Adjustment */}
      <div className="span-2 inventory-adjust-quick-actions">
        <span className="inventory-adjust-quick-label">
          Ajuste rápido:
        </span>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(1)}>+1</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(5)}>+5</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(10)}>+10</button>
        <button type="button" className="inv-quick-qty-btn" onClick={() => setQuickAdjustment(25)}>+25</button>
        <button type="button" className="inv-quick-qty-btn inventory-adjust-negative" onClick={() => setQuickAdjustment(-1)}>-1</button>
        <button type="button" className="inv-quick-qty-btn inventory-adjust-negative" onClick={() => setQuickAdjustment(-5)}>-5</button>
        <button type="button" className="inv-quick-qty-btn inventory-adjust-negative" onClick={() => setQuickAdjustment(-10)}>-10</button>
      </div>

      <label>
        Cantidad de Ajuste ({item.unit}) *
        <input
          type="number"
          step="any"
          required
          placeholder="Ej: 5 ó -2"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          disabled={pending}
         className="inventory-adjust-quantity-input" />
        <small>Valores positivos suman stock; negativos descuentan merma o consumo.</small>
      </label>

      <label>
        Motivo / Tipo Operativo *
        <select value={type} onChange={(e) => setType(e.target.value)} disabled={pending}>
          <option value="Entrada">Entrada (Compra / Recepción de Proveedor)</option>
          <option value="Ajuste">Ajuste Físico (Inventario Periódico)</option>
          <option value="Merma">Merma / Rotura / Vencimiento</option>
          <option value="Consumo">Consumo Evento / Degustación Especial</option>
          <option value="Devolucion">Devolución a Proveedor</option>
        </select>
      </label>

      <label className="span-2">
        Nota de Auditoría o Referencia
        <textarea
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: Factura F001-492, rotura en barra durante evento, conteo de fin de mes..."
          disabled={pending}
          rows={2}
        />
      </label>

      {formError ? <div className="alert-banner alert-banner-danger span-2" role="alert">{formError}</div> : null}

      <div className="form-actions span-2 inventory-adjust-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancelar</button>
        <button className="btn btn-primary inventory-adjust-submit" disabled={pending}>
          {pending ? <RefreshCw size={15} className="spin" /> : <Check size={15} />}
          {pending ? 'Registrando…' : 'Confirmar Ajuste'}
        </button>
      </div>
    </form>
  );
}

// ─── Kardex / History Modal for Specific Item ────────────────────────────────
function InventoryKardexModal({ item, ledgerEntries, onClose }) {
  if (!item) return null;
  const filteredLedger = ledgerEntries.filter((e) => e.inventoryItemId === item.id);
  const categoryInfo = getInventoryCategory(item.name, item.unit);
  const currentStock = Number(item.stock) || 0;
  const unitCost = Number(item.cost) || 0;
  const totalValuation = Math.round(currentStock * unitCost * 100) / 100;

  return (
    <Dialog open={true} onClose={onClose} title={`Kardex Operativo: ${item.name}`} wide>
      <div className="detail-stack">
        {/* Item Header Snapshot */}
        <div className="inventory-kardex-summary">
          <div>
            <span className="inventory-kardex-label">Rubro</span>
            <strong className="inventory-kardex-category">
              {categoryInfo.icon} {categoryInfo.label}
            </strong>
          </div>
          <div>
            <span className="inventory-kardex-label">Stock Físico Actual</span>
            <strong className="inventory-kardex-stock">
              {item.stock} {item.unit}
            </strong>
          </div>
          <div>
            <span className="inventory-kardex-label">Stock Disponible</span>
            <strong className="inventory-kardex-available">
              {inventoryAvailable(item)} {item.unit}
            </strong>
          </div>
          <div>
            <span className="inventory-kardex-label">Stock Mínimo</span>
            <strong className="inventory-kardex-minimum">
              {item.minimum} {item.unit}
            </strong>
          </div>
          <div>
            <span className="inventory-kardex-label">Valorización en Almacén</span>
            <strong className="inventory-kardex-valuation">
              {formatMoney(totalValuation)}
            </strong>
          </div>
        </div>

        {/* Ledger History Table */}
        <h4 className="inventory-kardex-title">
          Libro de Movimientos Históricos ({filteredLedger.length})
        </h4>

        {filteredLedger.length === 0 ? (
          <div className="inventory-kardex-empty">
            <Package size={28} color="var(--color-muted)"  className="inventory-kardex-empty-icon" />
            <p className="inventory-kardex-empty-text">
              Este insumo no tiene movimientos registrados en el libro aún.
            </p>
          </div>
        ) : (
          <div className="inventory-kardex-table-container">
            <table className="custom-table inventory-kardex-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Tipo</th>
                  <th className="inventory-kardex-quantity-header">Cantidad</th>
                  <th>Referencia</th>
                  <th>Nota / Glosa</th>
                  <th>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {filteredLedger.map((entry) => {
                  const qty = Number(entry.quantity);
                  const isPositive = qty > 0;
                  return (
                    <tr key={entry.id}>
                      <td className="inventory-kardex-date">{displayDateTime(entry.createdAt)}</td>
                      <td>
                        <span className="inventory-kardex-type">
                          {entry.type}
                        </span>
                      </td>
                      <td className="inventory-kardex-quantity">
                        {isPositive ? '+' : ''}{qty} {item.unit}
                      </td>
                      <td>{entry.referenceId || 'Manual'}</td>
                      <td>{entry.note || '—'}</td>
                      <td className="inventory-kardex-responsible">{entry.responsible || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions inventory-kardex-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar Kardex</button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Archive Inventory Dialog ────────────────────────────────────────────────
function ArchiveInventoryDialog({ item, onClose, notify }) {
  const { inventoryCommands } = useHotel();
  const allowed = useActionPermission('INVENTORY_ITEM_ARCHIVE');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 300) {
      setFormError('El motivo debe tener entre 3 y 300 caracteres.');
      return;
    }
    setPending(true);
    try {
      await inventoryCommands.archiveItem(item.id, { reason: trimmed });
      notify('Insumo archivado', `${item.name} ha sido archivado. Podrás reactivarlo en cualquier momento.`, 'success');
      onClose();
    } catch (err) {
      const status = err?.status || err?.data?.statusCode;
      if (status === 401) { notify('Sesión vencida', 'Iniciá sesión nuevamente.', 'error'); setPending(false); return; }
      if (status === 403) { notify('Sin permiso', 'No tenés permiso para archivar insumos.', 'error'); setPending(false); return; }
      setFormError(err?.data?.message || err?.message || 'No se pudo confirmar el archivado.');
    } finally {
      setPending(false);
    }
  };

  if (!allowed) return null;
  return (
    <form className="form-grid" onSubmit={submit}>
      <div className="alert-banner alert-banner-danger span-2">
        Esta acción pausará y archivará <strong>{item.name}</strong>. Permanecerá disponible en el historial del libro y podrás reactivarlo.
      </div>
      <label className="span-2">
        Motivo del archivado *
        <textarea
          required
          minLength={3}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: Insumo discontinuado por el proveedor o reemplazado por nueva marca..."
          disabled={pending}
          rows={3}
        />
        <small>{reason.length}/300 caracteres</small>
      </label>
      {formError ? <div className="alert-banner alert-banner-danger span-2" role="alert">{formError}</div> : null}
      <div className="form-actions span-2">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={pending}>Cancelar</button>
        <button className="btn btn-danger" disabled={pending}>{pending ? 'Archivando…' : 'Confirmar Archivado'}</button>
      </div>
    </form>
  );
}

// ─── Main Operational Inventory View (Luxury 5★ Edition) ─────────────────────
export function OperationalInventoryView({ notify }) {
  const { state, inventoryCommands, restaurantCommands } = useHotel();
  const inventoryResource = useRestaurantResource(state, restaurantCommands, 'inventory');
  const ledgerResource = useRestaurantResource(state, restaurantCommands, 'inventoryLedger');
  const { status: ledgerStatus, reload: reloadLedger } = ledgerResource;

  useEffect(() => {
    if (ledgerStatus !== 'idle') return;
    reloadLedger()?.catch(() => {});
  }, [ledgerStatus, reloadLedger]);

  const canCreate = useActionPermission('INVENTORY_ITEM_CREATE');
  const canUpdate = useActionPermission('INVENTORY_ITEM_UPDATE');
  const canAdjust = useActionPermission('INVENTORY_ADJUST');
  const canArchive = useActionPermission('INVENTORY_ITEM_ARCHIVE');

  const [tab, setTab] = useState('productos');
  const [segment, setSegment] = useState('todos'); // 'todos' | 'bar' | 'carnes' | 'pescados' | 'frescos' | 'lacteos' | 'abarrotes' | 'suministros'
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos'); // 'todos' | 'optimo' | 'bajo_minimo' | 'agotados' | 'archivados'
  const [sortBy, setSortBy] = useState('name'); // 'name' | 'stock_asc' | 'stock_desc' | 'value_desc'
  const [editor, setEditor] = useState(undefined);
  const [adjustId, setAdjustId] = useState(null);
  const [archiveItem, setArchiveItem] = useState(null);
  const [kardexItem, setKardexItem] = useState(null);

  const inventoryStatus = inventoryResource.status;
  const inventoryBlockingLoad = inventoryResource.isLoading && !inventoryResource.data.length;
  const ledgerBlockingLoad = ledgerResource.isLoading && !ledgerResource.data.length;
  const suppliersMap = useMemo(() => new Map((state.suppliers || []).map(s => [s.id, s])), [state.suppliers]);

  const isArchived = (item) => item.status === 'archived' || item.status === 'Archivado';
  const isBelowMin = (item) => !isArchived(item) && inventoryAvailable(item) <= Number(item.minimum) && inventoryAvailable(item) > 0;
  const isCritical = (item) => !isArchived(item) && inventoryAvailable(item) <= 0;

  // Total valuation: sum of (stock * cost)
  const totalValuation = useMemo(() => {
    return inventoryResource.data.reduce((sum, item) => {
      if (isArchived(item)) return sum;
      return sum + (Number(item.stock) || 0) * (Number(item.cost) || 0);
    }, 0);
  }, [inventoryResource.data]);

  // Segment counts
  const segmentStats = useMemo(() => {
    const stats = { todos: inventoryResource.data.length };
    inventoryResource.data.forEach((i) => {
      const cat = getInventoryCategory(i.name, i.unit).id;
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return stats;
  }, [inventoryResource.data]);

  // Filter & Sort records
  const records = useMemo(() => {
    let list = inventoryResource.data.filter((item) => {
      // 1. Segment filter
      if (segment !== 'todos') {
        const cat = getInventoryCategory(item.name, item.unit).id;
        if (cat !== segment) return false;
      }

      // 2. Status filter
      if (statusFilter === 'archivados' && !isArchived(item)) return false;
      if (statusFilter !== 'archivados' && isArchived(item) && statusFilter !== 'todos') return false;
      if (statusFilter === 'bajo_minimo' && !isBelowMin(item)) return false;
      if (statusFilter === 'agotados' && !isCritical(item)) return false;
      if (statusFilter === 'optimo' && (isBelowMin(item) || isCritical(item) || isArchived(item))) return false;

      // 3. Search query
      if (query.trim()) {
        const q = query.toLowerCase();
        const sku = getCleanSku(item).toLowerCase();
        const sup = (item.supplierName || (item.supplierId && suppliersMap.get(item.supplierId)?.tradeName) || '').toLowerCase();
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchLot = (item.lot || '').toLowerCase().includes(q);
        const matchSku = sku.includes(q);
        const matchSup = sup.includes(q);
        if (!matchName && !matchLot && !matchSku && !matchSup) return false;
      }

      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'stock_asc') return (Number(a.stock) || 0) - (Number(b.stock) || 0);
      if (sortBy === 'stock_desc') return (Number(b.stock) || 0) - (Number(a.stock) || 0);
      if (sortBy === 'value_desc') {
        const valA = (Number(a.stock) || 0) * (Number(a.cost) || 0);
        const valB = (Number(b.stock) || 0) * (Number(b.cost) || 0);
        return valB - valA;
      }
      return 0;
    });
  }, [inventoryResource.data, segment, statusFilter, query, sortBy, suppliersMap]);

  const adjustment = inventoryResource.data.find((item) => item.id === adjustId);

  const handleReactivate = async (item) => {
    try {
      await inventoryCommands.reactivateItem(item.id);
      notify('Insumo reactivado', `${item.name} ahora está activo en el inventario.`, 'success');
    } catch (err) {
      notify('Error al reactivar', err.message || 'No se pudo reactivar el insumo.', 'error');
    }
  };

  return (
    <div className="view-container">
      {/* ─── Luxury Page Header ────────────────────────────────────────────── */}
      <PageHeader
        actionType="INVENTORY_ITEM_CREATE"
        metadata="Control Físico & Valorización de Almacén 5★"
        title="Inventario de Insumos"
        description="Gestión de materias primas, control de existencias, libro de movimientos y costos de adquisición del hotel."
        action={
          canCreate ? (
            <button
              type="button"
              className="btn btn-primary inventory-page-create"
              onClick={() => setEditor(null)}
            >
              <Plus size={16} /> Nuevo Insumo
            </button>
          ) : null
        }
      />

      {/* ─── Enriched Metric Strip with Total Valuation ────────────────────── */}
      <MetricStrip items={[
        { label: 'Total Insumos', value: inventoryResource.data.length },
        { label: 'Valorización Almacén', value: formatMoney(totalValuation) },
        { label: 'Insumos Activos', value: inventoryResource.data.filter((i) => !isArchived(i)).length },
        { label: 'Bajo Mínimo (Reponer)', value: inventoryResource.data.filter(isBelowMin).length },
        { label: 'Sin Stock (Agotados)', value: inventoryResource.data.filter(isCritical).length },
        { label: 'Movimientos en Libro', value: ledgerResource.data.length },
      ]} />

      {inventoryResource.data.some(isCritical) ? (
        <div className="alert-banner alert-banner-danger inventory-critical-alert">
          <AlertTriangle size={16} />
          <span>Existen insumos con stock agotado o sobre-reservado que requieren compra urgente para no interrumpir el servicio.</span>
        </div>
      ) : null}

      {(inventoryResource.isForbidden || ledgerResource.isForbidden) ? (
        <div className="alert-banner alert-banner-warning">No tienes permisos suficientes para ver todas las secciones de este módulo.</div>
      ) : null}

      {/* ─── Main Tabs: Insumos vs Libro de Movimientos ───────────────────── */}
      <Tabs label="Inventario y libro" activeTab={tab} onChange={setTab} tabs={[
        { id: 'productos', label: `Insumos en Almacén (${inventoryResource.data.length})` },
        { id: 'ledger', label: `Libro de Movimientos (${ledgerResource.data.length})` },
      ]} />

      <TabPanel active={tab === 'productos'} label="Insumos">
        {inventoryBlockingLoad ? (
          <div className="alert-banner alert-banner-info" role="status">Cargando inventario físico…</div>
        ) : inventoryResource.isError ? (
          <div className="alert-banner alert-banner-danger">
            {inventoryResource.error || 'No se pudo cargar el inventario.'}
            <button className="btn btn-sm btn-outline inventory-retry" onClick={() => inventoryResource.reload()}>Reintentar</button>
          </div>
        ) : inventoryStatus === 'forbidden' ? (
          <div className="alert-banner alert-banner-danger">No tienes permiso para ver el inventario físico.</div>
        ) : null}

        {(!inventoryBlockingLoad && !inventoryResource.isForbidden) ? (
          <>
            {/* ─── Department / Rubro Quick Segment Buttons ────────────────── */}
            <div className="inv-segments-bar">
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'todos' ? 'active' : ''}`}
                onClick={() => setSegment('todos')}
              >
                ✨ Todos <span className="inv-segment-badge">{segmentStats.todos || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'bar' ? 'active' : ''}`}
                onClick={() => setSegment('bar')}
              >
                🍸 Bar & Coctelería <span className="inv-segment-badge">{segmentStats.bar || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'carnes' ? 'active' : ''}`}
                onClick={() => setSegment('carnes')}
              >
                🥩 Carnes & Aves <span className="inv-segment-badge">{segmentStats.carnes || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'pescados' ? 'active' : ''}`}
                onClick={() => setSegment('pescados')}
              >
                🐟 Pescados & Mariscos <span className="inv-segment-badge">{segmentStats.pescados || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'frescos' ? 'active' : ''}`}
                onClick={() => setSegment('frescos')}
              >
                🥬 Frescos & Frutas <span className="inv-segment-badge">{segmentStats.frescos || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'abarrotes' ? 'active' : ''}`}
                onClick={() => setSegment('abarrotes')}
              >
                🍚 Abarrotes & Secos <span className="inv-segment-badge">{segmentStats.abarrotes || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'lacteos' ? 'active' : ''}`}
                onClick={() => setSegment('lacteos')}
              >
                🧀 Lácteos & Huevos <span className="inv-segment-badge">{segmentStats.lacteos || 0}</span>
              </button>
              <button
                type="button"
                className={`inv-segment-btn ${segment === 'suministros' ? 'active' : ''}`}
                onClick={() => setSegment('suministros')}
              >
                📦 Insumos Varios <span className="inv-segment-badge">{segmentStats.suministros || 0}</span>
              </button>
            </div>

            {/* ─── Filter & Search Toolbar ──────────────────────────────────── */}
            <FilterBar label="Filtros de inventario" className="inventory-filter-toolbar">
              <div className="inventory-filter-group">
                <label className="search-label inventory-filter-search">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por insumo, SKU, lote o proveedor..."
                    aria-label="Buscar insumos"
                  />
                </label>
                <label className="inventory-filter-status">
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="todos">Todos los estados</option>
                    <option value="optimo">🟢 Stock Óptimo</option>
                    <option value="bajo_minimo">🟡 Bajo Mínimo (Reponer)</option>
                    <option value="agotados">🔴 Agotados (0 stock)</option>
                    <option value="archivados">📦 Archivados</option>
                  </select>
                </label>
                <label className="inventory-filter-sort">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="name">Nombre: A - Z</option>
                    <option value="stock_asc">Stock: Menor a Mayor</option>
                    <option value="stock_desc">Stock: Mayor a Menor</option>
                    <option value="value_desc">Mayor Valorización (S/)</option>
                  </select>
                </label>
              </div>

              <div className="inventory-filter-result">
                <span className="filter-result">{records.length} insumos listados</span>
              </div>
            </FilterBar>

            {/* ─── Table View (Directorio de Almacén) ───────────────────────── */}
            <DataTable
              caption="Stock físico, reservado y disponible con valorización"
              columns={['Insumo / Rubro', 'Físico / Salud', 'Reservado', 'Disponible', 'Costo Unit. / Valor', 'Proveedor', 'Estado', 'Acciones']}
              emptyTitle="Sin insumos coincidentes"
            >
              {records.length ? records.map((item) => {
                const archived = isArchived(item);
                const belowMin = isBelowMin(item);
                const critical = isCritical(item);
                const category = getInventoryCategory(item.name, item.unit);
                const sku = getCleanSku(item);
                const stockNum = Number(item.stock) || 0;
                const minNum = Number(item.minimum) || 1;
                const availableNum = inventoryAvailable(item);
                const costNum = Number(item.cost) || 0;
                const lineValuation = Math.round(stockNum * costNum * 100) / 100;
                const healthRatio = minNum > 0 ? Math.min(100, Math.max(0, (stockNum / minNum) * 50)) : 100;

                // Resolved supplier name
                const resolvedSupplierName = item.supplierName || (item.supplierId && suppliersMap.get(item.supplierId)?.tradeName) || (item.supplierId && suppliersMap.get(item.supplierId)?.legalName) || null;

                return (
                  <tr key={item.id} className="inventory-row">
                    {/* 1. Name, Rubro & SKU */}
                    <td>
                      <div className="inventory-item-cell">
                        <div className="inventory-item-icon">
                          {category.icon}
                        </div>
                        <div>
                          <strong className="inventory-item-name">{item.name}</strong>
                          <div className="inventory-item-meta">
                            <span className="inventory-item-sku">
                              {sku}
                            </span>
                            <span className="inventory-item-lot">
                              {item.lot ? `Lote: ${item.lot}` : 'Sin lote'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Physical Stock & Health Bar */}
                    <td className="inventory-stock-cell">
                      <div className="inventory-stock-value">
                        <strong className="inventory-stock-number">{item.stock}</strong>
                        <span className="inventory-stock-unit">{item.unit}</span>
                      </div>
                      <div className="inv-health-bar" title={`Stock Físico: ${item.stock} / Mínimo: ${item.minimum}`}>
                        <div
                        className={`inv-health-fill ${critical ? 'critical' : belowMin ? 'warning' : 'optimal'} health-ratio-${healthRatio >= 75 ? 'high' : healthRatio >= 35 ? 'medium' : 'low'}`}
                        />
                      </div>
                      <small className="inventory-stock-minimum">Min: {item.minimum} {item.unit}</small>
                    </td>

                    {/* 3. Reserved */}
                    <td>
                      <span className="inventory-reserved-value">
                        {item.reserved} {item.unit}
                      </span>
                    </td>

                    {/* 4. Available with Smart Pill */}
                    <td>
                      <div className="inventory-available-cell">
                        <strong className="inventory-available-value">
                          {availableNum} {item.unit}
                        </strong>
                        {critical ? (
                          <span className="inv-status-pill critical">🔴 Agotado</span>
                        ) : belowMin ? (
                          <span className="inv-status-pill warning">⚠️ Reponer</span>
                        ) : (
                          <span className="inv-status-pill optimal">🟢 Óptimo</span>
                        )}
                      </div>
                    </td>

                    {/* 5. Unit Cost & Total Line Value */}
                    <td>
                      <div className="inventory-cost-cell">
                        <span className="inventory-cost-unit">
                          Unit: {formatMoney(costNum)}
                        </span>
                        <strong className="inventory-line-value">
                          {formatMoney(lineValuation)}
                        </strong>
                      </div>
                    </td>

                    {/* 6. Supplier */}
                    <td>
                      {resolvedSupplierName ? (
                        <div className="inventory-supplier-value">
                          <Building2 size={13} color="var(--color-gold)" />
                          <span className="inventory-supplier-name">{resolvedSupplierName}</span>
                        </div>
                      ) : (
                        <span className="inventory-no-supplier">
                          Sin proveedor
                        </span>
                      )}
                    </td>

                    {/* 7. Status */}
                    <td>
                      <StatusBadge>{archived ? 'Archivado' : 'Activo'}</StatusBadge>
                    </td>

                    {/* 8. Quick Actions */}
                    <td>
                      <div className="quick-actions-row inventory-row-actions">
                        {!archived ? (
                          <>
                            {canAdjust ? (
                              <button
                                type="button"
                                className="quick-action-btn btn-action-view inventory-adjust-action"
                                data-tooltip="Ajustar stock (Entrada / Merma)"
                                onClick={() => setAdjustId(item.id)}
                              >
                                <Plus size={13} />
                                <span className="inventory-action-label">Ajustar</span>
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className="quick-action-btn inventory-kardex-action"
                              data-tooltip="Ver Kardex / Historial de movimientos"
                              onClick={() => setKardexItem(item)}
                            >
                              <History size={13} />
                              <span className="inventory-action-label">Kardex</span>
                            </button>

                            {canUpdate ? (
                              <button
                                type="button"
                                className="quick-action-btn btn-action-edit"
                                data-tooltip="Editar ficha del insumo"
                                onClick={() => setEditor(item)}
                              >
                                <Edit size={13} />
                              </button>
                            ) : null}

                            {canArchive ? (
                              <button
                                type="button"
                                className="quick-action-btn btn-action-lock"
                                data-tooltip="Pausar y archivar insumo"
                                onClick={() => setArchiveItem(item)}
                              >
                                <Lock size={13} />
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline inventory-reactivate-action"
                            onClick={() => handleReactivate(item)}
                          >
                            <RotateCcw size={12} /> Reactivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : null}
            </DataTable>
          </>
        ) : null}
      </TabPanel>

      {/* ─── Tab 2: Full Ledger (Libro de Movimientos General) ─────────────── */}
      <TabPanel active={tab === 'ledger'} label="Libro de movimientos">
        {ledgerBlockingLoad ? (
          <div className="alert-banner alert-banner-info" role="status">Cargando libro de movimientos…</div>
        ) : ledgerResource.isError ? (
          <div className="alert-banner alert-banner-danger">
            {ledgerResource.error || 'No se pudo cargar el libro.'}
            <button className="btn btn-sm btn-outline ledger-retry-action" onClick={() => ledgerResource.reload()}>Reintentar</button>
          </div>
        ) : ledgerStatus === 'forbidden' ? (
          <div className="alert-banner alert-banner-danger">No tienes permiso para ver el libro de movimientos.</div>
        ) : null}

        {(!ledgerBlockingLoad && !ledgerResource.isForbidden) ? (
          <DataTable
            caption="Auditoría completa de entradas, mermas y ajustes de inventario"
            columns={['Fecha y Hora', 'Insumo / Rubro', 'Tipo de Movimiento', 'Cantidad', 'Referencia', 'Nota / Glosa', 'Responsable']}
          >
            {ledgerResource.data.length ? ledgerResource.data.map((entry) => {
              const item = inventoryResource.data.find((record) => record.id === entry.inventoryItemId);
              const cat = item ? getInventoryCategory(item.name, item.unit) : null;
              const qty = Number(entry.quantity);
              const isPositive = qty > 0;

              return (
                <tr key={entry.id}>
                  <td className="ledger-date">{displayDateTime(entry.createdAt)}</td>
                  <td>
                    {item ? (
                      <div className="ledger-item-cell">
                        <span>{cat?.icon || '📦'}</span>
                        <div>
                          <strong className="ledger-item-name">{item.name}</strong>
                          <br />
                          <small className="ledger-item-meta">{getCleanSku(item)} · Lote: {item.lot || 'Sin lote'}</small>
                        </div>
                      </div>
                    ) : (
                      <span className="ledger-item-unavailable">Insumo no disponible</span>
                    )}
                  </td>
                  <td>
                    <span className="ledger-movement-type">
                      {entry.type}
                    </span>
                  </td>
                  <td className="ledger-quantity">
                    {isPositive ? '+' : ''}{qty}{item ? ` ${item.unit}` : ''}
                  </td>
                  <td>{entry.referenceId || 'Manual'}</td>
                  <td>{entry.note || '—'}</td>
                  <td className="ledger-responsible">{entry.responsible || '—'}</td>
                </tr>
              );
            }) : null}
          </DataTable>
        ) : null}
      </TabPanel>

      {/* ─── Modals ──────────────────────────────────────────────────────────── */}
      {/* 1. Modal Nuevo / Editar Insumo */}
      <Dialog open={editor !== undefined} onClose={() => setEditor(undefined)} title={editor ? `Editar Ficha: ${editor.name}` : 'Nuevo Insumo para Almacén'} wide>
        <InventoryItemEditor item={editor || null} onClose={() => setEditor(undefined)} notify={notify} />
      </Dialog>

      {/* 2. Modal Ajuste con Calculadora en Vivo */}
      <Dialog open={Boolean(adjustment)} onClose={() => setAdjustId(null)} title={adjustment ? `Registrar Ajuste: ${adjustment.name}` : 'Ajuste de Stock'} wide>
        {adjustment ? <InventoryAdjustment item={adjustment} onClose={() => setAdjustId(null)} notify={notify} /> : null}
      </Dialog>

      {/* 3. Modal Archivar Insumo */}
      <Dialog open={Boolean(archiveItem)} onClose={() => setArchiveItem(null)} title={archiveItem ? `Archivar: ${archiveItem.name}` : 'Archivar insumo'}>
        {archiveItem ? <ArchiveInventoryDialog item={archiveItem} onClose={() => setArchiveItem(null)} notify={notify} /> : null}
      </Dialog>

      {/* 4. Drawer / Modal Kardex Histórico por Insumo */}
      {kardexItem && (
        <InventoryKardexModal
          item={kardexItem}
          ledgerEntries={ledgerResource.data}
          onClose={() => setKardexItem(null)}
        />
      )}
    </div>
  );
}


