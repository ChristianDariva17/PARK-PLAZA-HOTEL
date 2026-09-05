import React, { useState, useEffect } from 'react';
import { useSuppliersResource } from './useSuppliersResource';
import { suppliersClient } from './suppliersClient';
import { DataTable, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../components/views/SharedViewParts';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import { 
  Building2, 
  Search, 
  Star, 
  Phone, 
  Mail, 
  Clock, 
  Plus, 
  Tag, 
  RefreshCw, 
  PackageCheck,
  FileText,
  AlertTriangle,
  ArrowDownToLine,
  Send,
  CheckCircle2,
  ListOrdered
} from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';

const CATEGORY_LABELS = {
  food: 'Alimentos',
  beverage: 'Bebidas',
  cleaning: 'Limpieza',
  maintenance: 'Mantenimiento',
  amenities: 'Amenities',
  services: 'Servicios',
  other: 'Otros',
};

const PO_STATUS_LABELS = {
  draft: { label: 'Borrador', bg: '#F1F5F9', color: '#475569' },
  sent: { label: 'Enviada al Proveedor', bg: '#EFF6FF', color: '#1D4ED8' },
  received: { label: 'Recibida en Almacén', bg: '#DCFCE7', color: '#15803D' },
  cancelled: { label: 'Cancelada', bg: '#FEE2E2', color: '#B91C1C' },
};

export function SuppliersListView({ onSelectSupplier, onCreateSupplier }) {
  const { suppliers, loading, error, filters, updateFilters, total, refresh } = useSuppliersResource();
  const [searchTerm, setSearchTerm] = useState(filters.q || '');
  const [activeTab, setActiveTab] = useState('suppliers'); // 'suppliers' | 'orders' | 'critical'

  // Reorder Suggestions State
  const [reorderData, setReorderData] = useState({ count: 0, criticalItems: [] });
  const [loadingReorder, setLoadingReorder] = useState(false);

  // Purchase Orders State
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingPOs, setLoadingPOs] = useState(false);

  // Purchase Order Modal State
  const [showPOModal, setShowPOModal] = useState(false);
  const [poPreselectedSupplierId, setPoPreselectedSupplierId] = useState(null);
  const [poPreselectedItems, setPoPreselectedItems] = useState([]);

  // Receive PO Modal
  const [receivingPO, setReceivingPO] = useState(null);
  const [receiveInvoice, setReceiveInvoice] = useState('');
  const [receiveRating, setReceiveRating] = useState(5);
  const [receiveRatingNotes, setReceiveRatingNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchReorderAndPOs = async () => {
    try {
      setLoadingReorder(true);
      const reorder = await suppliersClient.getReorderSuggestions();
      setReorderData(reorder);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReorder(false);
    }

    try {
      setLoadingPOs(true);
      const pos = await suppliersClient.getPurchaseOrders();
      setPurchaseOrders(pos);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPOs(false);
    }
  };

  useEffect(() => {
    fetchReorderAndPOs();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    updateFilters({ q: searchTerm });
  };

  const handleCreatePOFromCritical = (item = null) => {
    if (item) {
      setPoPreselectedSupplierId(item.supplierId || null);
      setPoPreselectedItems([item]);
    } else {
      setPoPreselectedSupplierId(null);
      setPoPreselectedItems(reorderData.criticalItems);
    }
    setShowPOModal(true);
  };

  const handleSendPO = async (poId) => {
    try {
      setActionLoading(true);
      await suppliersClient.sendPurchaseOrder(poId);
      await fetchReorderAndPOs();
    } catch (err) {
      alert(`Error al enviar orden: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteReceivePO = async (e) => {
    e.preventDefault();
    if (!receivingPO) return;
    try {
      setActionLoading(true);
      await suppliersClient.receivePurchaseOrder(receivingPO.id, {
        invoiceNumber: receiveInvoice.trim() || undefined,
        rating: receiveRating,
        ratingNotes: receiveRatingNotes.trim() || undefined,
      });
      setReceivingPO(null);
      await fetchReorderAndPOs();
      refresh();
      alert('¡Orden de compra recibida con éxito! Stock e inventario actualizados.');
    } catch (err) {
      alert(`Error al recibir orden: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const activeCount = suppliers.filter((s) => s.status === 'active').length;
  const preferredCount = suppliers.filter((s) => s.isPreferred && s.status === 'active').length;
  const totalSuppliedItems = suppliers.reduce((sum, s) => sum + (Number(s.suppliedItemsCount) || 0), 0);

  return (
    <div className="view-container" style={{ paddingBottom: 60 }}>
      <PageHeader
        metadata="Cadena de Suministro, Compras & Kardex 5★"
        title="Proveedores & Órdenes de Compra"
        description="Gestión integral de proveedores, plazos de entrega, catálogo de insumos de cocina/bar y emisión de órdenes de compra (OC)."
        actionType="SUPPLIER_CREATE"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setPoPreselectedSupplierId(null);
                setPoPreselectedItems([]);
                setShowPOModal(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <FileText size={16} /> Emitir Orden de Compra (OC)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onCreateSupplier}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <Plus size={16} /> Nuevo Proveedor
            </button>
          </div>
        }
      />

      {/* Critical Stock Alert Banner (Recomendación 2) */}
      {reorderData.count > 0 && (
        <div style={{ background: '#FFFBEB', border: '1.5px solid #F59E0B', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#FEF3C7', padding: 8, borderRadius: 10, border: '1px solid #FDE68A' }}>
              <AlertTriangle size={22} color="#D97706" />
            </div>
            <div>
              <strong style={{ fontSize: 14, color: '#92400E', display: 'block' }}>
                ⚠️ Alerta de Reposición Automática: {reorderData.count} insumo{reorderData.count > 1 ? 's' : ''} en nivel crítico de inventario
              </strong>
              <span style={{ fontSize: 12.5, color: '#B45309' }}>
                Hay materias primas de cocina y bar por debajo o igual a su stock mínimo de seguridad.
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleCreatePOFromCritical()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 13, background: '#D97706', borderColor: '#B45309' }}
          >
            <FileText size={15} /> Generar OC Inmediata con Insumos Críticos
          </button>
        </div>
      )}

      {/* Metrics Strip */}
      <MetricStrip
        items={[
          { label: 'Proveedores Activos', value: activeCount, detail: 'Disponibles para compras' },
          { label: 'Proveedores Preferidos VIP', value: preferredCount, detail: 'Prioridad en cotizaciones' },
          { label: 'Insumos en Catálogo', value: totalSuppliedItems, detail: 'Vinculados a cocina/bar' },
          { label: 'Órdenes de Compra (OC)', value: purchaseOrders.length, detail: `${purchaseOrders.filter(p => p.status === 'sent').length} pendientes de recepción` },
        ]}
      />

      {error && <div className="alert-banner alert-banner-danger" role="alert">{error}</div>}

      {/* View Switcher Tabs */}
      <div style={{ display: 'flex', gap: 8, margin: '18px 0 16px', borderBottom: '2px solid #E5E7EB', paddingBottom: 8 }}>
        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'suppliers' ? '#1E3A8A' : '#F1F5F9',
            color: activeTab === 'suppliers' ? '#FFFFFF' : '#475569',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <Building2 size={15} /> Directorio de Proveedores ({suppliers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'orders' ? '#1E3A8A' : '#F1F5F9',
            color: activeTab === 'orders' ? '#FFFFFF' : '#475569',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <FileText size={15} /> Órdenes de Compra Formales ({purchaseOrders.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('critical')}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'critical' ? '#1E3A8A' : '#F1F5F9',
            color: activeTab === 'critical' ? '#FFFFFF' : '#475569',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <AlertTriangle size={15} color={reorderData.count > 0 ? '#D97706' : undefined} />
          Insumos en Reposición Crítica ({reorderData.count})
        </button>
      </div>

      {/* TAB 1: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <>
          {/* Filter and Search Bar */}
          <div className="filter-bar" style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
            <form onSubmit={handleSearch} style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Buscar por Razón Social, Nombre Comercial o RUC</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, color: '#94A3B8' }} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ej. Distribuidora del Norte, 20601234567..."
                  style={{ width: '100%', paddingLeft: 34, height: 38, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13 }}
                />
              </div>
            </form>

            <div style={{ minWidth: 140, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Estado</label>
              <select
                value={filters.status || ''}
                onChange={(e) => updateFilters({ status: e.target.value })}
                style={{ height: 38, borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 13, background: '#FFFFFF', padding: '0 10px' }}
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="archived">Archivados</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleSearch}
              disabled={loading}
              style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} /> Filtrar
            </button>
          </div>

          {/* Suppliers Table */}
          <DataTable
            caption="Directorio de Proveedores"
            columns={['Proveedor / Razón Social', 'RUC / Fiscal', 'Calificación SLA', 'Insumos que Abastece', 'Plazo Entrega', 'Contacto', 'Estado', 'Acción']}
          >
            {suppliers.map((sup) => (
              <tr key={sup.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div>
                      <strong style={{ fontSize: 14, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {sup.legalName}
                        {sup.isPreferred && (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            background: 'rgba(217, 119, 6, 0.12)',
                            color: '#B45309',
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            border: '1px solid #FCD34D'
                          }}>
                            <Star size={11} fill="#D97706" color="#D97706" /> VIP
                          </span>
                        )}
                      </strong>
                      {sup.tradeName && (
                        <div style={{ fontSize: 11.5, color: '#64748B' }}>Nombre comercial: {sup.tradeName}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#334155' }}>
                    {sup.taxId}
                  </span>
                </td>
                <td>
                  {/* Rating 1-5 Stars (Recomendación 3) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} title={`Calificación: ${sup.rating || 5}/5 estrellas`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={13}
                        fill={s <= (sup.rating || 5) ? '#D97706' : '#E2E8F0'}
                        color={s <= (sup.rating || 5) ? '#D97706' : '#CBD5E1'}
                      />
                    ))}
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#92400E', marginLeft: 4 }}>
                      {(sup.rating || 5).toFixed(1)}
                    </span>
                  </div>
                </td>
                <td>
                  {sup.suppliedItemsCount && Number(sup.suppliedItemsCount) > 0 ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: '#DCFCE7',
                      color: '#15803D',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      border: '1px solid #BBF7D0'
                    }}>
                      <PackageCheck size={13} color="#15803D" /> {sup.suppliedItemsCount} insumos
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>0 vinculados</span>
                  )}
                </td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                    <Clock size={13} color="#64748B" />
                    {sup.averageDeliveryDays ? `${sup.averageDeliveryDays} días` : 'Inmediato'}
                  </span>
                </td>
                <td>
                  <div style={{ fontSize: 12 }}>
                    {sup.contactName && <div style={{ fontWeight: 600, color: '#0F172A' }}>{sup.contactName}</div>}
                    {sup.phone && <div style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} /> {sup.phone}</div>}
                    {sup.email && <div style={{ color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} /> {sup.email}</div>}
                    {!sup.contactName && !sup.phone && !sup.email && <span style={{ color: '#94A3B8' }}>Sin contacto</span>}
                  </div>
                </td>
                <td>
                  <StatusBadge>{sup.status === 'active' ? 'Activo' : 'Archivado'}</StatusBadge>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onSelectSupplier(sup.id)}
                    style={{ fontWeight: 700 }}
                  >
                    Ver Ficha
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      )}

      {/* TAB 2: PURCHASE ORDERS (Órdenes de Compra) */}
      {activeTab === 'orders' && (
        <div>
          {purchaseOrders.length === 0 ? (
            <EmptyState
              title="No hay órdenes de compra emitidas"
              description="Puedes emitir una nueva orden de compra formal seleccionando insumos de inventario y proveedor."
            />
          ) : (
            <DataTable
              caption="Órdenes de Compra Registradas"
              columns={['N° Orden (OC)', 'Proveedor', 'Fecha Emisión', 'Total (S/)', 'Estado', 'Acciones']}
            >
              {purchaseOrders.map(po => {
                const statusCfg = PO_STATUS_LABELS[po.status] || { label: po.status, bg: '#F1F5F9', color: '#334155' };
                return (
                  <tr key={po.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', fontSize: 13.5, color: '#1E3A8A' }}>
                        {po.orderNumber}
                      </strong>
                      <div style={{ fontSize: 11.5, color: '#64748B' }}>
                        {(po.items || []).length} insumo{(po.items || []).length > 1 ? 's' : ''} incluidos
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: '#0F172A', display: 'block' }}>
                        {po.supplier?.tradeName || po.supplier?.legalName || 'Proveedor'}
                      </strong>
                      <span style={{ fontSize: 11, color: '#64748B' }}>RUC: {po.supplier?.taxId || 'N/A'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12.5, color: '#334155' }}>
                        {new Date(po.createdAt).toLocaleDateString('es-PE')}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: 14, color: '#1E3A8A' }}>
                        S/ {Number(po.total || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 20,
                        fontSize: 11.5,
                        fontWeight: 800,
                        background: statusCfg.bg,
                        color: statusCfg.color,
                      }}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {po.status === 'draft' && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleSendPO(po.id)}
                            disabled={actionLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                          >
                            <Send size={13} /> Enviar OC
                          </button>
                        )}
                        {(po.status === 'draft' || po.status === 'sent') && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setReceivingPO(po)}
                            disabled={actionLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800 }}
                          >
                            <ArrowDownToLine size={13} /> Recibir Mercadería
                          </button>
                        )}
                        {po.status === 'received' && (
                          <span style={{ fontSize: 12, color: '#15803D', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={14} /> Recibida
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </div>
      )}

      {/* TAB 3: CRITICAL INVENTORY REORDER */}
      {activeTab === 'critical' && (
        <div>
          {reorderData.criticalItems.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
              <CheckCircle2 size={36} color="#16A34A" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ margin: 0, color: '#166534', fontSize: 16, fontWeight: 800 }}>¡Inventario de Insumos en Niveles Óptimos!</h3>
              <p style={{ margin: '4px 0 0', color: '#64748B', fontSize: 13 }}>
                Todos los insumos de cocina y bar cuentan con stock superior al mínimo de seguridad.
              </p>
            </div>
          ) : (
            <DataTable
              caption="Insumos con Stock Bajo / Crítico"
              columns={['Insumo de Cocina / Bar', 'Stock Actual', 'Stock Mínimo', 'Cantidad Sugerida de Compra', 'Proveedor Asignado', 'Acción']}
            >
              {reorderData.criticalItems.map(item => (
                <tr key={item.id}>
                  <td>
                    <strong style={{ fontSize: 13.5, color: '#0F172A', display: 'block' }}>{item.name}</strong>
                    <span style={{ fontSize: 11.5, color: '#64748B' }}>Unidad de medida: <strong>{item.unit}</strong></span>
                  </td>
                  <td>
                    <strong style={{ color: '#DC2626', fontSize: 14 }}>
                      {Number(item.stock).toFixed(1)} {item.unit}
                    </strong>
                  </td>
                  <td>
                    <span style={{ color: '#64748B', fontSize: 13 }}>
                      {Number(item.minimum).toFixed(1)} {item.unit}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#1E3A8A', fontSize: 13.5 }}>
                      +{item.suggestedQuantity} {item.unit}
                    </strong>
                    <div style={{ fontSize: 11, color: '#64748B' }}>
                      Est. S/ {item.estimatedTotalCost.toFixed(2)}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: item.supplierId ? '#1E3A8A' : '#94A3B8' }}>
                      {item.supplierName} {item.isPreferredSupplier ? '⭐ VIP' : ''}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleCreatePOFromCritical(item)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800 }}
                    >
                      <Plus size={13} /> Generar OC
                    </button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      )}

      {/* PURCHASE ORDER GENERATOR MODAL */}
      <PurchaseOrderModal
        open={showPOModal}
        supplierId={poPreselectedSupplierId}
        initialItems={poPreselectedItems}
        onClose={() => setShowPOModal(false)}
        onCreated={() => {
          fetchReorderAndPOs();
          refresh();
        }}
      />

      {/* RECEIVE PURCHASE ORDER & RATING MODAL (Recomendación 1 y 3) */}
      {receivingPO && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(2,6,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setReceivingPO(null)}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 26, width: '100%', maxWidth: 480, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ArrowDownToLine size={22} color="#1E3A8A" />
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111827' }}>
                  Recepcionar OC: {receivingPO.orderNumber}
                </h3>
              </div>
              <button type="button" onClick={() => setReceivingPO(null)} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <form onSubmit={handleExecuteReceivePO} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#F8FAFC', padding: 12, borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 12.5 }}>
                <div>Proveedor: <strong>{receivingPO.supplier?.tradeName || receivingPO.supplier?.legalName}</strong></div>
                <div>Ítems a ingresar: <strong>{(receivingPO.items || []).length} insumos de cocina/bar</strong></div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 5 }}>
                  N° Factura o Guía de Remisión del Proveedor
                </label>
                <input
                  type="text"
                  placeholder="Ej: F001-0008492"
                  value={receiveInvoice}
                  onChange={(e) => setReceiveInvoice(e.target.value)}
                  style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              {/* Delivery Rating (Recomendación 3) */}
              <div style={{ background: '#FFFBEB', padding: 12, borderRadius: 10, border: '1px solid #FDE68A' }}>
                <label style={{ fontSize: 12.5, fontWeight: 800, color: '#92400E', display: 'block', marginBottom: 6 }}>
                  Calificación de Calidad y Puntualidad (SLA)
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReceiveRating(star)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                    >
                      <Star
                        size={22}
                        fill={star <= receiveRating ? '#D97706' : 'transparent'}
                        color="#D97706"
                      />
                    </button>
                  ))}
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#92400E', marginLeft: 8 }}>
                    {receiveRating === 5 ? '⭐⭐⭐⭐⭐ Excelente' : receiveRating === 4 ? '⭐⭐⭐⭐ Bueno' : receiveRating === 3 ? '⭐⭐⭐ Regular' : '⭐⭐ Con Observaciones'}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', display: 'block', marginBottom: 5 }}>
                  Notas u Observaciones de Calidad
                </label>
                <input
                  type="text"
                  placeholder="Ej: Insumos frescos y entrega dentro de horario"
                  value={receiveRatingNotes}
                  onChange={(e) => setReceiveRatingNotes(e.target.value)}
                  style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10 }}>
                <button type="button" onClick={() => setReceivingPO(null)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  {actionLoading ? 'Ingresando...' : 'Confirmar Recepción e Ingresar Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
