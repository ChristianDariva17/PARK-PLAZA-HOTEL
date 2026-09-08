import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from '../components/ui/Overlay';
import { suppliersClient } from './suppliersClient';
import { getInventory } from '../restaurant/restaurantClient';
import { 
  Trash2, 
  Printer, 
  Send, 
  AlertTriangle
} from 'lucide-react';

export function PurchaseOrderModal({ open, supplierId, initialItems = [], onClose, onCreated }) {
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(supplierId || '');
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [currency, setCurrency] = useState('PEN');
  const [notes, setNotes] = useState('Entregar en recepción de almacén central del hotel en horario de 08:00 a 14:00.');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Print / View Generated PO state
  const [createdPO, setCreatedPO] = useState(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setCreatedPO(null);
      suppliersClient.getSuppliers({ pageSize: 100 }).then(res => setSuppliers(res.items || [])).catch(console.error);
      getInventory().then(res => setInventory(res || [])).catch(console.error);

      if (supplierId) {
        setSelectedSupplierId(supplierId);
      }
    }
  }, [open, supplierId]);

  // If initialItems provided (e.g. from low stock suggester), prefill them
  useEffect(() => {
    if (open && initialItems.length > 0) {
      setItems(initialItems.map(itm => ({
        inventoryItemId: itm.id || itm.inventoryItemId,
        name: itm.name,
        unit: itm.unit,
        quantity: itm.suggestedQuantity || itm.quantity || 10,
        unitCost: itm.cost !== undefined ? itm.cost : (itm.unitCost || 0),
      })));
    }
  }, [open, initialItems]);

  // If supplier selected and items empty, prefill with supplier's linked insumos
  useEffect(() => {
    if (selectedSupplierId && items.length === 0 && !initialItems.length) {
      suppliersClient.getSupplierInventory(selectedSupplierId)
        .then(inv => {
          if (inv && inv.length > 0) {
            setItems(inv.map(itm => ({
              inventoryItemId: itm.id,
              name: itm.name,
              unit: itm.unit,
              quantity: Math.max(10, Number(itm.minimum || 5) * 2),
              unitCost: Number(itm.cost || 0),
            })));
          }
        })
        .catch(console.error);
    }
  }, [selectedSupplierId, initialItems.length, items.length]);

  const addItem = (invItem) => {
    if (!invItem) return;
    if (items.some(i => i.inventoryItemId === invItem.id)) return;
    setItems(prev => [
      ...prev,
      {
        inventoryItemId: invItem.id,
        name: invItem.name,
        unit: invItem.unit,
        quantity: 10,
        unitCost: Number(invItem.cost || 0),
      }
    ]);
  };

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const updateItemField = (idx, field, val) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, itm) => sum + (Number(itm.quantity || 0) * Number(itm.unitCost || 0)), 0);
  }, [items]);

  const tax = useMemo(() => subtotal * 0.18, [subtotal]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      setError('Seleccione un proveedor para emitir la orden.');
      return;
    }
    if (items.length === 0) {
      setError('Agregue al menos un insumo a la orden de compra.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await suppliersClient.createPurchaseOrder({
        supplierId: selectedSupplierId,
        expectedDeliveryDate: expectedDate ? new Date(expectedDate).toISOString() : null,
        currency,
        notes,
        items: items.map(i => ({
          inventoryItemId: i.inventoryItemId,
          name: i.name,
          unit: i.unit,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost || 0),
        }))
      });

      setCreatedPO(res);
      if (onCreated) onCreated(res);
    } catch (err) {
      setError(err.message || 'Error al generar orden de compra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide={true}
      title={createdPO ? `Orden de Compra ${createdPO.orderNumber}` : 'Generar Orden de Compra Formal (OC)'}
      description={createdPO ? 'Documento formal emitido y registrado en el sistema. Puede imprimirlo o enviarlo al proveedor.' : 'Emita un documento formal con membrete corporativo, cálculo de IGV y registro directo en compras.'}
    >
      {createdPO ? (
        /* PRINTABLE FORMAL PURCHASE ORDER VIEW */
        <div className="supplier-stack">
          <div 
            id="printable-po" 
            className="supplier-card-compact"
          >
            {/* Header / Brand */}
            <div className="supplier-row-muted">
              <div>
                <span className="supplier-text-secondary">
                  HOTEL PARK PLAZA ★★★★★
                </span>
                <h2 className="supplier-text-compact">
                  ORDEN DE COMPRA FORMAL
                </h2>
                <span className="supplier-text-muted">RUC: 20100458923 · Av. El Sol 450, Cusco - Perú</span>
              </div>

              <div className="supplier-card-muted">
                <span className="supplier-text-accent">N° DOCUMENTO</span>
                <strong className="supplier-text-status">{createdPO.orderNumber}</strong>
                <span className="supplier-text-action">
                  Fecha: {new Date(createdPO.createdAt).toLocaleDateString('es-PE')}
                </span>
              </div>
            </div>

            {/* Supplier & Delivery Info Grid */}
            <div className="supplier-grid">
              <div>
                <strong className="supplier-text-field">PROVEEDOR SELECCIONADO</strong>
                <div className="supplier-text-content">{createdPO.supplier?.legalName}</div>
                {createdPO.supplier?.tradeName && <div className="supplier-element">{createdPO.supplier?.tradeName}</div>}
                <div>RUC: <strong className="supplier-element-secondary">{createdPO.supplier?.taxId}</strong></div>
                {createdPO.supplier?.contactName && <div>Contacto: {createdPO.supplier?.contactName}</div>}
                {createdPO.supplier?.email && <div>Email: {createdPO.supplier?.email}</div>}
              </div>

              <div>
                <strong className="supplier-text-field">CONDICIONES DE ENTREGA</strong>
                <div>Fecha Requerida: <strong>{createdPO.expectedDeliveryDate ? new Date(createdPO.expectedDeliveryDate).toLocaleDateString('es-PE') : 'A convenir'}</strong></div>
                <div>Moneda: <strong>{createdPO.currency}</strong></div>
                <div>Lugar: <strong>Almacén Central / Cocina Principal</strong></div>
                <div>Estado: <strong className="supplier-element-compact">EMITIDA / PENDIENTE RECEPCIÓN</strong></div>
              </div>
            </div>

            {/* Items Table */}
            <table className="supplier-table">
              <thead>
                <tr className="supplier-cell">
                  <th className="supplier-bordered">Ítem / Insumo</th>
                  <th className="supplier-spaced">Unidad</th>
                  <th className="supplier-cell-secondary">Cantidad</th>
                  <th className="supplier-cell-secondary">Costo Unit.</th>
                  <th className="supplier-cell-compact">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(createdPO.items || []).map((itm, idx) => (
                  <tr key={idx} className="supplier-surface-secondary">
                    <td className="supplier-text-header">{itm.name}</td>
                    <td className="supplier-spaced-secondary">{itm.unit}</td>
                    <td className="supplier-text-footer">{itm.quantity}</td>
                    <td className="supplier-cell-secondary">S/ {Number(itm.unitCost || 0).toFixed(2)}</td>
                    <td className="supplier-text-variant-k">
                      S/ {Number(itm.totalCost || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals & Notes */}
            <div className="supplier-row-accent">
              <div className="supplier-card-accent">
                <strong className="supplier-element-muted">Instrucciones / Observaciones:</strong>
                {createdPO.notes || 'Sin observaciones adicionales.'}
              </div>

              <div className="supplier-text-variant-l">
                <div className="supplier-row-status">
                  <span>Subtotal:</span>
                  <strong>S/ {Number(createdPO.subtotal || 0).toFixed(2)}</strong>
                </div>
                <div className="supplier-row-action">
                  <span>IGV (18%):</span>
                  <span>S/ {Number(createdPO.tax || 0).toFixed(2)}</span>
                </div>
                <div className="supplier-row-field">
                  <span>Total {createdPO.currency}:</span>
                  <span>S/ {Number(createdPO.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="supplier-grid-secondary">
              <div className="supplier-bordered-secondary">
                <strong>Gerencia de Alimentos & Bebidas / Compras</strong>
                <div>Hotel Park Plaza</div>
              </div>
              <div className="supplier-bordered-secondary">
                <strong>Aceptación & Firma del Proveedor</strong>
                <div>{createdPO.supplier?.legalName}</div>
              </div>
            </div>
          </div>

          <div className="supplier-row-content">
            <button 
              type="button" 
              className="btn btn-outline supplier-text-variant-m"
              onClick={() => window.print()}
            >
              <Printer size={15} /> Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              className="btn btn-primary supplier-text-variant-n"
              onClick={onClose}
            >
              Cerrar y Volver
            </button>
          </div>
        </div>
      ) : (
        /* CREATE PURCHASE ORDER FORM */
        <form onSubmit={handleSubmit} className="supplier-stack-secondary">
          {error && (
            <div className="supplier-row-header">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* Supplier Selector */}
          <div className="supplier-grid-compact">
            <div>
              <label className="supplier-text-variant-o">
                Proveedor Destinatario *
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="supplier-text-variant-p"
                required
              >
                <option value="">-- Seleccionar Proveedor --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.tradeName || s.legalName} {s.isPreferred ? '⭐ VIP' : ''} (RUC: {s.taxId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="supplier-text-variant-o">
                Fecha Requerida de Entrega
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="supplier-text-variant-q"
              />
            </div>

            <div>
              <label className="supplier-text-variant-o">
                Moneda de la Orden
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="supplier-text-variant-p"
              >
                <option value="PEN">Soles (PEN - S/)</option>
                <option value="USD">Dólares (USD - $)</option>
              </select>
            </div>
          </div>

          {/* Add Insumo Selector */}
          <div className="supplier-card-status">
            <div className="supplier-row-footer">
              <span className="supplier-text-variant-r">
                Agregar Insumos de Inventario a la Orden
              </span>
            </div>
            
            <div className="supplier-row-variant-k">
              <select
                id="select-inv-item"
                className="supplier-text-variant-s"
                defaultValue=""
                onChange={(e) => {
                  const itm = inventory.find(i => i.id === e.target.value);
                  if (itm) addItem(itm);
                  e.target.value = '';
                }}
              >
                <option value="" disabled>-- Seleccionar insumo para agregar a la lista --</option>
                {inventory.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.unit}) · Stock: {Number(i.stock || 0).toFixed(1)} · Ref: S/ {Number(i.cost || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Items Table in Editor */}
          <div className="supplier-bordered-compact">
            <table className="supplier-table-secondary">
              <thead>
                <tr className="supplier-cell-muted">
                  <th className="supplier-spaced-compact">Insumo</th>
                  <th className="supplier-spaced-muted">Unidad</th>
                  <th className="supplier-cell-accent">Cantidad</th>
                  <th className="supplier-cell-accent">Costo Unit. (S/)</th>
                  <th className="supplier-cell-accent">Subtotal</th>
                  <th className="supplier-spaced-accent"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="supplier-cell-status">
                      No hay insumos añadidos. Seleccione insumos arriba para agregarlos a la orden de compra.
                    </td>
                  </tr>
                ) : (
                  items.map((itm, idx) => {
                    const lineTotal = Number(itm.quantity || 0) * Number(itm.unitCost || 0);
                    return (
                      <tr key={idx} className="supplier-bordered-muted">
                        <td className="supplier-text-variant-t">{itm.name}</td>
                        <td className="supplier-spaced-status">{itm.unit}</td>
                        <td className="supplier-cell-action">
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={itm.quantity}
                            onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                            className="supplier-text-variant-u"
                          />
                        </td>
                        <td className="supplier-cell-action">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={itm.unitCost}
                            onChange={(e) => updateItemField(idx, 'unitCost', e.target.value)}
                            className="supplier-text-variant-v"
                          />
                        </td>
                        <td className="supplier-text-variant-w">
                          S/ {lineTotal.toFixed(2)}
                        </td>
                        <td className="supplier-cell-field">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="supplier-surface-compact"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Subtotal, IGV and Total Summary Card */}
          <div className="supplier-row-variant-l">
            <div className="supplier-text-variant-x">
              <span>💡 Al recepcionar la OC, el inventario y Kardex se actualizarán automáticamente.</span>
            </div>
            <div className="supplier-row-variant-m">
              <div>
                <span className="supplier-text-variant-y">Subtotal</span>
                <strong>S/ {subtotal.toFixed(2)}</strong>
              </div>
              <div>
                <span className="supplier-text-variant-y">IGV (18%)</span>
                <strong>S/ {tax.toFixed(2)}</strong>
              </div>
              <div>
                <span className="supplier-text-variant-z">Total {currency}</span>
                <strong className="supplier-element-variant-i">S/ {total.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <div>
            <label className="supplier-element-variant-j">
              Instrucciones / Observaciones para el Proveedor
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Entregar en almacén central..."
              className="supplier-element-variant-k"
            />
          </div>

          <div className="supplier-row-variant-n">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button
              type="submit"
               className="btn btn-primary supplier-element-variant-l"
              disabled={loading || items.length === 0}
            >
              <Send size={15} /> {loading ? 'Generando...' : 'Emitir Orden de Compra (OC)'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
