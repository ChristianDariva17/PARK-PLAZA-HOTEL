import React, { useState, useEffect, useCallback } from 'react';
import { Drawer } from '../components/ui/Overlay';
import { StatusBadge } from '../components/views/SharedViewParts';
import { suppliersClient } from './suppliersClient';
import { 
  Building2, 
  Edit2, 
  Archive, 
  RotateCcw, 
  Star, 
  Phone, 
  Mail, 
  Clock, 
  Copy, 
  Check, 
  User, 
  PackageCheck, 
  PlusCircle, 
  CheckCircle2, 
  AlertTriangle,
  ArrowDownToLine,
  Layers,
  FileText
} from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';

const CATEGORY_LABELS = {
  food: 'Alimentos & Carnes',
  beverage: 'Licores & Bebidas',
  cleaning: 'Limpieza & Higiene',
  maintenance: 'Mantenimiento & Técnico',
  amenities: 'Amenities & Blancos',
  services: 'Servicios Externos',
  other: 'Otros Suministros',
};

export function SupplierDetailDrawer({ supplierId, onClose, onEdit, onRefresh }) {
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedTaxId, setCopiedTaxId] = useState(false);

  // Restock Modal
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockItemId, setRestockItemId] = useState('');
  const [restockQty, setRestockQty] = useState(10);
  const [restockCost, setRestockCost] = useState('');
  const [restockLot, setRestockLot] = useState('');
  const [restockInvoice, setRestockInvoice] = useState('');
  const [restockNotes, setRestockNotes] = useState('');
  const [restockSuccess, setRestockSuccess] = useState(false);

  const fetchSupplier = useCallback(async (signal) => {
    if (!supplierId) return;
    try {
      setLoading(true);
      const sup = await suppliersClient.getSupplierDetail(supplierId, signal);
      if (signal?.aborted) return;
      setSupplier(sup);
      if (sup.inventory && sup.inventory.length > 0) {
        const firstInventoryItem = sup.inventory[0];
        setRestockItemId((currentItemId) => {
          if (currentItemId) return currentItemId;
          setRestockCost(firstInventoryItem.cost ? String(firstInventoryItem.cost) : '');
          return firstInventoryItem.id;
        });
      }
    } catch (e) {
      if (signal?.aborted) return;
      setError(e.message || 'Error al obtener el detalle del proveedor');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    const controller = new AbortController();
    setSupplier(null);
    setError(null);
    setLoading(Boolean(supplierId));
    if (supplierId) fetchSupplier(controller.signal);
    return () => controller.abort();
  }, [supplierId, fetchSupplier]);

  const handleArchive = async () => {
    const reason = window.prompt('Indique el motivo por el cual se archiva este proveedor:');
    if (!reason || !reason.trim()) return;

    try {
      setActionLoading(true);
      await suppliersClient.archiveSupplier(supplierId, supplier.version, reason.trim());
      await fetchSupplier();
      onRefresh();
    } catch (e) {
      alert(`Error al archivar: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    const reason = window.prompt('Indique el motivo para reactivar este proveedor:');
    if (!reason || !reason.trim()) return;

    try {
      setActionLoading(true);
      await suppliersClient.reactivateSupplier(supplierId, supplier.version, reason.trim());
      await fetchSupplier();
      onRefresh();
    } catch (e) {
      alert(`Error al reactivar: ${e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteRestock = async (e) => {
    e.preventDefault();
    if (!restockItemId) {
      alert('Seleccione el insumo a reabastecer.');
      return;
    }

    try {
      setActionLoading(true);
      await suppliersClient.restockFromSupplier(supplierId, {
        items: [
          {
            inventoryItemId: restockItemId,
            quantity: Number(restockQty),
            unitCost: restockCost ? Number(restockCost) : undefined,
            lot: restockLot.trim() || undefined,
          }
        ],
        invoiceNumber: restockInvoice.trim() || undefined,
        notes: restockNotes.trim() || undefined,
      });

      setRestockSuccess(true);
      setTimeout(() => {
        setRestockSuccess(false);
        setShowRestockModal(false);
      }, 1500);

      await fetchSupplier();
      onRefresh();
    } catch (err) {
      alert(`Error al registrar reabastecimiento: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedTaxId(true);
    setTimeout(() => setCopiedTaxId(false), 2000);
  };

  if (!supplierId) return null;

  return (
    <Drawer
      open={Boolean(supplierId)}
      onClose={onClose}
      title="Ficha Técnica del Proveedor"
      description="Información comercial, insumos de cocina/bar que abastece y registro de compras."
    >
      {loading ? (
        <div className="supplier-cell-content">Cargando información del proveedor...</div>
      ) : error ? (
        <div className="alert-banner alert-banner-danger">{error}</div>
      ) : supplier ? (
        <div className="supplier-stack-compact">
          
          {/* Header Card */}
          <div className="supplier-card-action">
            <div className="supplier-row-variant-o">
              <StatusBadge>{supplier.status === 'active' ? 'Activo' : 'Archivado'}</StatusBadge>
              {supplier.isPreferred && (
                <span
                  className="supplier-card-field"
                >
                  <Star size={12} fill="#D97706" color="#D97706" /> Proveedor Preferido 5★
                </span>
              )}
            </div>

            <h3 className="supplier-element-variant-m">
              {supplier.legalName}
            </h3>
            {supplier.tradeName && (
              <div className="supplier-element-variant-n">
                {supplier.tradeName}
              </div>
            )}

            {/* RUC Badge with Copy */}
            <div className="supplier-row-variant-p">
              <span className="supplier-element-variant-o">RUC / Documento:</span>
              <span className="supplier-card-content">
                {supplier.taxId}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(supplier.taxId)}
                title="Copiar RUC"
                className={`supplier-surface ${copiedTaxId ? 'is-copied' : ''}`}
              >
                {copiedTaxId ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Quick Action: Restock Insumos Button */}
          {supplier.status === 'active' && (
            <button
              type="button"
              className="btn btn-primary supplier-card-header"
              onClick={() => setShowRestockModal(true)}
            >
              <ArrowDownToLine size={16} /> Registrar Ingreso / Reabastecimiento de Insumos
            </button>
          )}

          {/* Contact Information */}
          <div className="supplier-card-footer">
            <h4 className="supplier-element-variant-p">
              Contacto Comercial
            </h4>
            <div className="supplier-stack-muted">
              <div className="supplier-row-variant-q">
                <User size={15} color="#64748B" />
                <span className="supplier-element-variant-q">{supplier.contactName || 'No especificado'}</span>
              </div>
              <div className="supplier-row-variant-q">
                <Phone size={15} color="#64748B" />
                {supplier.phone ? (
                  <a href={`tel:${supplier.phone}`} className="supplier-element-variant-r">
                    {supplier.phone}
                  </a>
                ) : (
                  <span className="supplier-element-accent">Sin teléfono registrado</span>
                )}
              </div>
              <div className="supplier-row-variant-q">
                <Mail size={15} color="#64748B" />
                {supplier.email ? (
                  <a href={`mailto:${supplier.email}`} className="supplier-element-variant-r">
                    {supplier.email}
                  </a>
                ) : (
                  <span className="supplier-element-accent">Sin correo registrado</span>
                )}
              </div>
            </div>
          </div>

          {/* Operational Delivery Condition */}
          <div className="supplier-card-footer">
            <h4 className="supplier-element-variant-p">
              Plazos de Entrega & Categorías
            </h4>
            <div className="supplier-row-variant-r">
              <Clock size={15} color="#64748B" />
              <span>
                Tiempo promedio de despacho: <strong>{supplier.averageDeliveryDays || 0} días hábiles</strong>
              </span>
            </div>

            <div className="supplier-row-variant-s">
              {supplier.categories && supplier.categories.length > 0 ? (
                supplier.categories.map((cat) => (
                  <span
                    key={cat}
                    className="supplier-card-variant-k"
                  >
                    {CATEGORY_LABELS[cat] || cat}
                  </span>
                ))
              ) : (
                <span className="supplier-element-variant-s">Sin categorías asignadas</span>
              )}
            </div>
          </div>

          {/* SECTION: Insumos de Inventario Vinculados */}
          <div className="supplier-card-footer">
            <div className="supplier-row-variant-t">
              <h4 className="supplier-element-variant-t">
                Insumos Abastecidos ({supplier.inventory ? supplier.inventory.length : 0})
              </h4>
              <span className="supplier-card-variant-l">
                Cocina & Bar
              </span>
            </div>

            {supplier.inventory && supplier.inventory.length > 0 ? (
              <div className="supplier-stack-accent">
                {supplier.inventory.map(item => (
                  <div key={item.id} className="supplier-row-variant-u">
                    <div>
                      <strong className="supplier-element-status">{item.name}</strong>
                      <span className="supplier-element-variant-u">Unidad: {item.unit} · Lote: {item.lot || 'N/A'}</span>
                    </div>
                    <div className="supplier-cell-header">
                      <span className="supplier-element-variant-v">
                        Stock: {Number(item.stock || 0).toFixed(1)}
                      </span>
                      <span className="supplier-element-variant-w">
                        {formatMoney(Number(item.cost || 0))} / {item.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="supplier-element-variant-x">
                Este proveedor no tiene insumos asignados aún. Edite el proveedor para vincular insumos.
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="supplier-row-variant-v">
            {supplier.status === 'active' ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline supplier-element-variant-y"
                  onClick={() => onEdit(supplier.id)}
                  disabled={actionLoading}
                >
                  <Edit2 size={15} /> Editar Proveedor
                </button>
                <button
                  type="button"
                  className="btn btn-danger supplier-element-action"
                  onClick={handleArchive}
                  disabled={actionLoading}
                >
                  <Archive size={15} /> Archivar
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary supplier-element-variant-z"
                onClick={handleReactivate}
                disabled={actionLoading}
              >
                <RotateCcw size={15} /> Reactivar Proveedor
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* MODAL: Registrar Reabastecimiento / Ingreso de Insumos */}
      {showRestockModal && supplier && (
        <div className="supplier-overlay" onClick={() => setShowRestockModal(false)}>
          <div className="supplier-card-variant-m" onClick={e => e.stopPropagation()}>
            <div className="supplier-row-variant-w">
              <div className="supplier-row-variant-x">
                <ArrowDownToLine size={22} color="#1E3A8A" />
                <h3 className="supplier-element-variant-a-extended">Ingreso de Mercadería / Insumos</h3>
              </div>
              <button type="button" onClick={() => setShowRestockModal(false)} className="supplier-element-variant-b-extended">✕</button>
            </div>

            {restockSuccess ? (
              <div className="supplier-card-variant-n">
                <CheckCircle2 size={32} color="#16A34A" className="supplier-element-field" />
                ¡Reabastecimiento registrado con éxito en inventario y kardex!
              </div>
            ) : (
              <form onSubmit={handleExecuteRestock} className="supplier-stack-status">
                <div>
                  <label className="supplier-element-variant-c-extended">
                    Insumo a Recibir *
                  </label>
                  <select
                    value={restockItemId}
                    onChange={(e) => {
                      setRestockItemId(e.target.value);
                      const itm = (supplier.inventory || []).find(i => i.id === e.target.value);
                      if (itm && itm.cost) setRestockCost(String(itm.cost));
                    }}
                    className="supplier-element-variant-d-extended"
                    required
                  >
                    <option value="">-- Seleccionar Insumo --</option>
                    {(supplier.inventory || []).map(itm => (
                      <option key={itm.id} value={itm.id}>
                        {itm.name} (Stock Actual: {Number(itm.stock || 0).toFixed(1)} {itm.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="supplier-grid-muted">
                  <div>
                    <label className="supplier-element-variant-c-extended">
                      Cantidad Ingresada *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={restockQty}
                      onChange={(e) => setRestockQty(e.target.value)}
                      className="supplier-element-variant-e-extended"
                      required
                    />
                  </div>

                  <div>
                    <label className="supplier-element-variant-c-extended">
                      Costo Unitario (S/)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ej: 45.00"
                      value={restockCost}
                      onChange={(e) => setRestockCost(e.target.value)}
                      className="supplier-element-variant-f-extended"
                    />
                  </div>
                </div>

                <div className="supplier-grid-muted">
                  <div>
                    <label className="supplier-element-variant-c-extended">
                      N° Factura / Guía de Remisión
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: F001-002849"
                      value={restockInvoice}
                      onChange={(e) => setRestockInvoice(e.target.value)}
                      className="supplier-element-variant-g-extended"
                    />
                  </div>

                  <div>
                    <label className="supplier-element-variant-c-extended">
                      N° de Lote / Vencimiento
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: LOT-2026-09"
                      value={restockLot}
                      onChange={(e) => setRestockLot(e.target.value)}
                      className="supplier-element-variant-g-extended"
                    />
                  </div>
                </div>

                <div>
                  <label className="supplier-element-variant-c-extended">
                    Observaciones de Recepción
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Ingreso conforme en almacén central"
                    value={restockNotes}
                    onChange={(e) => setRestockNotes(e.target.value)}
                    className="supplier-element-variant-g-extended"
                  />
                </div>

                <div className="supplier-row-variant-y">
                  <button type="button" onClick={() => setShowRestockModal(false)} className="btn btn-outline supplier-spaced-action">
                    Cancelar
                  </button>
                  <button type="submit" disabled={actionLoading} className="btn btn-primary supplier-element-variant-h-extended">
                    {actionLoading ? 'Registrando...' : 'Confirmar Ingreso a Inventario'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
