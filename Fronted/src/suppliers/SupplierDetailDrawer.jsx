import React, { useState, useEffect } from 'react';
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

  const fetchSupplier = async () => {
    if (!supplierId) return;
    try {
      setLoading(true);
      const sup = await suppliersClient.getSupplierDetail(supplierId);
      setSupplier(sup);
      if (sup.inventory && sup.inventory.length > 0 && !restockItemId) {
        setRestockItemId(sup.inventory[0].id);
        setRestockCost(sup.inventory[0].cost ? String(sup.inventory[0].cost) : '');
      }
    } catch (e) {
      setError(e.message || 'Error al obtener el detalle del proveedor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplierId) fetchSupplier();
  }, [supplierId]);

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
        <div style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>Cargando información del proveedor...</div>
      ) : error ? (
        <div className="alert-banner alert-banner-danger">{error}</div>
      ) : supplier ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* Header Card */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <StatusBadge>{supplier.status === 'active' ? 'Activo' : 'Archivado'}</StatusBadge>
              {supplier.isPreferred && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 800,
                    background: '#FEF3C7',
                    color: '#92400E',
                    border: '1px solid #FDE68A',
                  }}
                >
                  <Star size={12} fill="#D97706" color="#D97706" /> Proveedor Preferido 5★
                </span>
              )}
            </div>

            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: '#1E3A8A' }}>
              {supplier.legalName}
            </h3>
            {supplier.tradeName && (
              <div style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>
                {supplier.tradeName}
              </div>
            )}

            {/* RUC Badge with Copy */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <span style={{ fontSize: 11.5, color: '#64748B', fontWeight: 700 }}>RUC / Documento:</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13.5, background: '#FFFFFF', padding: '2px 8px', borderRadius: 6, border: '1px solid #CBD5E1', color: '#0F172A' }}>
                {supplier.taxId}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(supplier.taxId)}
                title="Copiar RUC"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: copiedTaxId ? '#16A34A' : '#64748B',
                }}
              >
                {copiedTaxId ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Quick Action: Restock Insumos Button */}
          {supplier.status === 'active' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowRestockModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                fontWeight: 800,
                fontSize: 13.5,
                background: 'linear-gradient(135deg, #1E3A8A, #1E40AF)',
                color: '#FFF',
                borderRadius: 10,
                boxShadow: '0 4px 6px -1px rgba(30, 58, 138, 0.2)'
              }}
            >
              <ArrowDownToLine size={16} /> Registrar Ingreso / Reabastecimiento de Insumos
            </button>
          )}

          {/* Contact Information */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.05em' }}>
              Contacto Comercial
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155' }}>
                <User size={15} color="#64748B" />
                <span style={{ fontWeight: 600 }}>{supplier.contactName || 'No especificado'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155' }}>
                <Phone size={15} color="#64748B" />
                {supplier.phone ? (
                  <a href={`tel:${supplier.phone}`} style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}>
                    {supplier.phone}
                  </a>
                ) : (
                  <span style={{ color: '#94A3B8' }}>Sin teléfono registrado</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155' }}>
                <Mail size={15} color="#64748B" />
                {supplier.email ? (
                  <a href={`mailto:${supplier.email}`} style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}>
                    {supplier.email}
                  </a>
                ) : (
                  <span style={{ color: '#94A3B8' }}>Sin correo registrado</span>
                )}
              </div>
            </div>
          </div>

          {/* Operational Delivery Condition */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.05em' }}>
              Plazos de Entrega & Categorías
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155', marginBottom: 12 }}>
              <Clock size={15} color="#64748B" />
              <span>
                Tiempo promedio de despacho: <strong>{supplier.averageDeliveryDays || 0} días hábiles</strong>
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {supplier.categories && supplier.categories.length > 0 ? (
                supplier.categories.map((cat) => (
                  <span
                    key={cat}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 16,
                      fontSize: 11.5,
                      fontWeight: 700,
                      background: '#EFF6FF',
                      color: '#1D4ED8',
                      border: '1px solid #BFDBFE',
                    }}
                  >
                    {CATEGORY_LABELS[cat] || cat}
                  </span>
                ))
              ) : (
                <span style={{ fontSize: 12, color: '#94A3B8' }}>Sin categorías asignadas</span>
              )}
            </div>
          </div>

          {/* SECTION: Insumos de Inventario Vinculados */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.05em' }}>
                Insumos Abastecidos ({supplier.inventory ? supplier.inventory.length : 0})
              </h4>
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 700, background: '#D1FAE5', padding: '1px 6px', borderRadius: 4 }}>
                Cocina & Bar
              </span>
            </div>

            {supplier.inventory && supplier.inventory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
                {supplier.inventory.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#F8FAFC', borderRadius: 8, fontSize: 12.5 }}>
                    <div>
                      <strong style={{ color: '#0F172A', display: 'block' }}>{item.name}</strong>
                      <span style={{ fontSize: 11, color: '#64748B' }}>Unidad: {item.unit} · Lote: {item.lot || 'N/A'}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#1E3A8A', display: 'block' }}>
                        Stock: {Number(item.stock || 0).toFixed(1)}
                      </span>
                      <span style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>
                        {formatMoney(Number(item.cost || 0))} / {item.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '14px 0', color: '#94A3B8', fontSize: 12.5 }}>
                Este proveedor no tiene insumos asignados aún. Edite el proveedor para vincular insumos.
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 14, borderTop: '1px solid #E2E8F0' }}>
            {supplier.status === 'active' ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => onEdit(supplier.id)}
                  style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
                  disabled={actionLoading}
                >
                  <Edit2 size={15} /> Editar Proveedor
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleArchive}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  disabled={actionLoading}
                >
                  <Archive size={15} /> Archivar
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleReactivate}
                style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(2,6,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowRestockModal(false)}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 26, width: '100%', maxWidth: 480, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ArrowDownToLine size={22} color="#1E3A8A" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111827' }}>Ingreso de Mercadería / Insumos</h3>
              </div>
              <button type="button" onClick={() => setShowRestockModal(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {restockSuccess ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: '#DCFCE7', borderRadius: 12, color: '#166534', fontWeight: 700 }}>
                <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 8px' }} />
                ¡Reabastecimiento registrado con éxito en inventario y kardex!
              </div>
            ) : (
              <form onSubmit={handleExecuteRestock} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                    Insumo a Recibir *
                  </label>
                  <select
                    value={restockItemId}
                    onChange={(e) => {
                      setRestockItemId(e.target.value);
                      const itm = (supplier.inventory || []).find(i => i.id === e.target.value);
                      if (itm && itm.cost) setRestockCost(String(itm.cost));
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13.5, color: '#0F172A', boxSizing: 'border-box' }}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                      Cantidad Ingresada *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={restockQty}
                      onChange={(e) => setRestockQty(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, fontWeight: 700, boxSizing: 'border-box' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                      Costo Unitario (S/)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ej: 45.00"
                      value={restockCost}
                      onChange={(e) => setRestockCost(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 14, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                      N° Factura / Guía de Remisión
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: F001-002849"
                      value={restockInvoice}
                      onChange={(e) => setRestockInvoice(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                      N° de Lote / Vencimiento
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: LOT-2026-09"
                      value={restockLot}
                      onChange={(e) => setRestockLot(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 6 }}>
                    Observaciones de Recepción
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Ingreso conforme en almacén central"
                    value={restockNotes}
                    onChange={(e) => setRestockNotes(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10 }}>
                  <button type="button" onClick={() => setShowRestockModal(false)} className="btn btn-outline" style={{ padding: '10px 16px' }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '10px 22px', fontWeight: 800 }}>
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
