import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from '../components/ui/Overlay';
import { suppliersClient } from './suppliersClient';
import { getInventory } from '../restaurant/restaurantClient';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Printer, 
  Send, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  DollarSign, 
  User, 
  Clock, 
  Sparkles,
  AlertTriangle,
  X
} from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';

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
  }, [selectedSupplierId]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div 
            id="printable-po" 
            style={{
              background: '#FFFFFF',
              border: '2px solid #1E3A8A',
              borderRadius: 12,
              padding: 24,
              color: '#0F172A',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
            }}
          >
            {/* Header / Brand */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #1E3A8A', paddingBottom: 14, marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.08em' }}>
                  HOTEL PARK PLAZA ★★★★★
                </span>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1E3A8A', margin: '2px 0' }}>
                  ORDEN DE COMPRA FORMAL
                </h2>
                <span style={{ fontSize: 12, color: '#64748B' }}>RUC: 20100458923 · Av. El Sol 450, Cusco - Perú</span>
              </div>

              <div style={{ textAlign: 'right', background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '8px 14px', borderRadius: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'block' }}>N° DOCUMENTO</span>
                <strong style={{ fontSize: 16, color: '#1E3A8A', fontFamily: 'monospace' }}>{createdPO.orderNumber}</strong>
                <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 2 }}>
                  Fecha: {new Date(createdPO.createdAt).toLocaleDateString('es-PE')}
                </span>
              </div>
            </div>

            {/* Supplier & Delivery Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, background: '#F8FAFC', padding: 14, borderRadius: 8, marginBottom: 16, border: '1px solid #E2E8F0', fontSize: 12.5 }}>
              <div>
                <strong style={{ color: '#1E3A8A', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontSize: 11 }}>PROVEEDOR SELECCIONADO</strong>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{createdPO.supplier?.legalName}</div>
                {createdPO.supplier?.tradeName && <div style={{ color: '#64748B' }}>{createdPO.supplier?.tradeName}</div>}
                <div>RUC: <strong style={{ fontFamily: 'monospace' }}>{createdPO.supplier?.taxId}</strong></div>
                {createdPO.supplier?.contactName && <div>Contacto: {createdPO.supplier?.contactName}</div>}
                {createdPO.supplier?.email && <div>Email: {createdPO.supplier?.email}</div>}
              </div>

              <div>
                <strong style={{ color: '#1E3A8A', display: 'block', marginBottom: 4, textTransform: 'uppercase', fontSize: 11 }}>CONDICIONES DE ENTREGA</strong>
                <div>Fecha Requerida: <strong>{createdPO.expectedDeliveryDate ? new Date(createdPO.expectedDeliveryDate).toLocaleDateString('es-PE') : 'A convenir'}</strong></div>
                <div>Moneda: <strong>{createdPO.currency}</strong></div>
                <div>Lugar: <strong>Almacén Central / Cocina Principal</strong></div>
                <div>Estado: <strong style={{ color: '#D97706' }}>EMITIDA / PENDIENTE RECEPCIÓN</strong></div>
              </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1E3A8A', color: '#FFFFFF', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', borderRadius: '6px 0 0 0' }}>Ítem / Insumo</th>
                  <th style={{ padding: '8px 10px' }}>Unidad</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Cantidad</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Costo Unit.</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderRadius: '0 6px 0 0' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(createdPO.items || []).map((itm, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700 }}>{itm.name}</td>
                    <td style={{ padding: '8px 10px', color: '#64748B' }}>{itm.unit}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>{itm.quantity}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>S/ {Number(itm.unitCost || 0).toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#1E3A8A' }}>
                      S/ {Number(itm.totalCost || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals & Notes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
              <div style={{ flex: 1, fontSize: 12, color: '#64748B', background: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <strong style={{ display: 'block', color: '#1E3A8A', marginBottom: 2 }}>Instrucciones / Observaciones:</strong>
                {createdPO.notes || 'Sin observaciones adicionales.'}
              </div>

              <div style={{ width: 220, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Subtotal:</span>
                  <strong>S/ {Number(createdPO.subtotal || 0).toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748B' }}>
                  <span>IGV (18%):</span>
                  <span>S/ {Number(createdPO.tax || 0).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '2px solid #1E3A8A', fontSize: 15, fontWeight: 900, color: '#1E3A8A', marginTop: 4 }}>
                  <span>Total {createdPO.currency}:</span>
                  <span>S/ {Number(createdPO.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 40, paddingTop: 10, textAlign: 'center', fontSize: 11, color: '#64748B' }}>
              <div style={{ borderTop: '1px solid #94A3B8', paddingTop: 6 }}>
                <strong>Gerencia de Alimentos & Bebidas / Compras</strong>
                <div>Hotel Park Plaza</div>
              </div>
              <div style={{ borderTop: '1px solid #94A3B8', paddingTop: 6 }}>
                <strong>Aceptación & Firma del Proveedor</strong>
                <div>{createdPO.supplier?.legalName}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button 
              type="button" 
              className="btn btn-outline"
              onClick={() => window.print()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <Printer size={15} /> Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              style={{ fontWeight: 800 }}
            >
              Cerrar y Volver
            </button>
          </div>
        </div>
      ) : (
        /* CREATE PURCHASE ORDER FORM */
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '80vh', overflowY: 'auto', paddingRight: 6 }}>
          {error && (
            <div style={{ padding: '12px 16px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* Supplier Selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 4 }}>
                Proveedor Destinatario *
              </label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, color: '#0F172A', outline: 'none' }}
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
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 4 }}>
                Fecha Requerida de Entrega
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 10px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 4 }}>
                Moneda de la Orden
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, color: '#0F172A', outline: 'none' }}
              >
                <option value="PEN">Soles (PEN - S/)</option>
                <option value="USD">Dólares (USD - $)</option>
              </select>
            </div>
          </div>

          {/* Add Insumo Selector */}
          <div style={{ background: '#F8FAFC', padding: 14, borderRadius: 10, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase' }}>
                Agregar Insumos de Inventario a la Orden
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: 10 }}>
              <select
                id="select-inv-item"
                style={{ flex: 1, height: 38, borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, padding: '0 10px', outline: 'none' }}
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
          <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#F1F5F9', color: '#334155', textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '8px 12px' }}>Insumo</th>
                  <th style={{ padding: '8px 12px', width: 70 }}>Unidad</th>
                  <th style={{ padding: '8px 12px', width: 110, textAlign: 'right' }}>Cantidad</th>
                  <th style={{ padding: '8px 12px', width: 110, textAlign: 'right' }}>Costo Unit. (S/)</th>
                  <th style={{ padding: '8px 12px', width: 110, textAlign: 'right' }}>Subtotal</th>
                  <th style={{ padding: '8px 12px', width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#94A3B8' }}>
                      No hay insumos añadidos. Seleccione insumos arriba para agregarlos a la orden de compra.
                    </td>
                  </tr>
                ) : (
                  items.map((itm, idx) => {
                    const lineTotal = Number(itm.quantity || 0) * Number(itm.unitCost || 0);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0F172A' }}>{itm.name}</td>
                        <td style={{ padding: '8px 12px', color: '#64748B' }}>{itm.unit}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={itm.quantity}
                            onChange={(e) => updateItemField(idx, 'quantity', e.target.value)}
                            style={{ width: '100%', height: 32, padding: '0 6px', textAlign: 'right', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12.5, fontWeight: 700 }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={itm.unitCost}
                            onChange={(e) => updateItemField(idx, 'unitCost', e.target.value)}
                            style={{ width: '100%', height: 32, padding: '0 6px', textAlign: 'right', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12.5 }}
                          />
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#1E3A8A' }}>
                          S/ {lineTotal.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: 2 }}
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
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px 18px', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#92400E' }}>
              <span>💡 Al recepcionar la OC, el inventario y Kardex se actualizarán automáticamente.</span>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', gap: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: '#64748B', display: 'block' }}>Subtotal</span>
                <strong>S/ {subtotal.toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#64748B', display: 'block' }}>IGV (18%)</span>
                <strong>S/ {tax.toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: '#92400E', fontWeight: 800, display: 'block' }}>Total {currency}</span>
                <strong style={{ fontSize: 16, color: '#B45309' }}>S/ {total.toFixed(2)}</strong>
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#1E3A8A', marginBottom: 4 }}>
              Instrucciones / Observaciones para el Proveedor
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Entregar en almacén central..."
              style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || items.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, padding: '10px 24px' }}
            >
              <Send size={15} /> {loading ? 'Generando...' : 'Emitir Orden de Compra (OC)'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
