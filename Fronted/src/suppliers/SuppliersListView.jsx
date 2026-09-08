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
    <div className="view-container supplier-spaced-field">
      <PageHeader
        metadata="Cadena de Suministro, Compras & Kardex 5★"
        title="Proveedores & Órdenes de Compra"
        description="Gestión integral de proveedores, plazos de entrega, catálogo de insumos de cocina/bar y emisión de órdenes de compra (OC)."
        actionType="SUPPLIER_CREATE"
        action={
          <div className="supplier-row-variant-k">
            <button
              type="button"
              className="btn btn-outline supplier-text-variant-m"
              onClick={() => {
                setPoPreselectedSupplierId(null);
                setPoPreselectedItems([]);
                setShowPOModal(true);
              }}
            >
              <FileText size={16} /> Emitir Orden de Compra (OC)
            </button>
            <button
              type="button"
              className="btn btn-primary supplier-text-variant-m"
              onClick={onCreateSupplier}
            >
              <Plus size={16} /> Nuevo Proveedor
            </button>
          </div>
        }
      />

      {/* Critical Stock Alert Banner (Recomendación 2) */}
      {reorderData.count > 0 && (
        <div className="supplier-element-variant-x-extended">
          <div className="supplier-element-variant-y-extended">
            <div className="supplier-card-variant-q">
              <AlertTriangle size={22} color="#D97706" />
            </div>
            <div>
              <strong className="supplier-text-variant-variant-f">
                ⚠️ Alerta de Reposición Automática: {reorderData.count} insumo{reorderData.count > 1 ? 's' : ''} en nivel crítico de inventario
              </strong>
              <span className="supplier-text-variant-variant-g">
                Hay materias primas de cocina y bar por debajo o igual a su stock mínimo de seguridad.
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary supplier-text-variant-variant-h"
            onClick={() => handleCreatePOFromCritical()}
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
      <div className="supplier-element-variant-z-extended">
        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`supplier-card-secondary ${activeTab === 'suppliers' ? 'is-active' : ''}`}
        >
          <Building2 size={15} /> Directorio de Proveedores ({suppliers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`supplier-card-secondary ${activeTab === 'orders' ? 'is-active' : ''}`}
        >
          <FileText size={15} /> Órdenes de Compra Formales ({purchaseOrders.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('critical')}
          className={`supplier-card-secondary ${activeTab === 'critical' ? 'is-active' : ''}`}
        >
          <AlertTriangle size={15} color={reorderData.count > 0 ? '#D97706' : undefined} />
          Insumos en Reposición Crítica ({reorderData.count})
        </button>
      </div>

      {/* TAB 1: SUPPLIERS DIRECTORY */}
      {activeTab === 'suppliers' && (
        <>
          {/* Filter and Search Bar */}
          <div className="filter-bar supplier-element-variant-a-extended">
            <form onSubmit={handleSearch} className="supplier-stack-field">
              <label className="supplier-text-variant-variant-i">Buscar por Razón Social, Nombre Comercial o RUC</label>
              <div className="supplier-element-variant-b-extended">
                <Search size={16} className="supplier-overlay-compact" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ej. Distribuidora del Norte, 20601234567..."
                  className="supplier-text-variant-variant-j"
                />
              </div>
            </form>

            <div className="supplier-stack-content">
              <label className="supplier-text-variant-variant-i">Estado</label>
              <select
                value={filters.status || ''}
                onChange={(e) => updateFilters({ status: e.target.value })}
                className="supplier-card-variant-r"
              >
                <option value="">Todos los estados</option>
                <option value="active">Activos</option>
                <option value="archived">Archivados</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-outline supplier-text-variant-variant-k"
              onClick={handleSearch}
              disabled={loading}
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
                  <div className="supplier-element-variant-o-extended">
                    <div>
                      <strong className="supplier-element-variant-c-extended">
                        {sup.legalName}
                        {sup.isPreferred && (
                          <span className="supplier-card-variant-s">
                            <Star size={11} fill="#D97706" color="#D97706" /> VIP
                          </span>
                        )}
                      </strong>
                      {sup.tradeName && (
                        <div className="supplier-text-variant-variant-l">Nombre comercial: {sup.tradeName}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="supplier-text-variant-variant-m">
                    {sup.taxId}
                  </span>
                </td>
                <td>
                  {/* Rating 1-5 Stars (Recomendación 3) */}
                  <div className="supplier-element-variant-d-extended" title={`Calificación: ${sup.rating || 5}/5 estrellas`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={13}
                        fill={s <= (sup.rating || 5) ? '#D97706' : '#E2E8F0'}
                        color={s <= (sup.rating || 5) ? '#D97706' : '#CBD5E1'}
                      />
                    ))}
                    <span className="supplier-text-variant-variant-n">
                      {(sup.rating || 5).toFixed(1)}
                    </span>
                  </div>
                </td>
                <td>
                  {sup.suppliedItemsCount && Number(sup.suppliedItemsCount) > 0 ? (
                    <span className="supplier-card-variant-t">
                      <PackageCheck size={13} color="#15803D" /> {sup.suppliedItemsCount} insumos
                    </span>
                  ) : (
                    <span className="supplier-element-variant-s">0 vinculados</span>
                  )}
                </td>
                <td>
                  <span className="supplier-text-variant-variant-o">
                    <Clock size={13} color="#64748B" />
                    {sup.averageDeliveryDays ? `${sup.averageDeliveryDays} días` : 'Inmediato'}
                  </span>
                </td>
                <td>
                  <div className="supplier-text-variant-variant-p">
                    {sup.contactName && <div className="supplier-text-variant-variant-q">{sup.contactName}</div>}
                    {sup.phone && <div className="supplier-element-variant-e-extended"><Phone size={11} /> {sup.phone}</div>}
                    {sup.email && <div className="supplier-element-variant-e-extended"><Mail size={11} /> {sup.email}</div>}
                    {!sup.contactName && !sup.phone && !sup.email && <span className="supplier-element-accent">Sin contacto</span>}
                  </div>
                </td>
                <td>
                  <StatusBadge>{sup.status === 'active' ? 'Activo' : 'Archivado'}</StatusBadge>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm supplier-text-variant-variant-r"
                    onClick={() => onSelectSupplier(sup.id)}
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
                      <strong className="supplier-text-variant-variant-s">
                        {po.orderNumber}
                      </strong>
                      <div className="supplier-text-variant-variant-l">
                        {(po.items || []).length} insumo{(po.items || []).length > 1 ? 's' : ''} incluidos
                      </div>
                    </td>
                    <td>
                      <strong className="supplier-element-status">
                        {po.supplier?.tradeName || po.supplier?.legalName || 'Proveedor'}
                      </strong>
                      <span className="supplier-element-variant-u">RUC: {po.supplier?.taxId || 'N/A'}</span>
                    </td>
                    <td>
                      <span className="supplier-text-variant-variant-t">
                        {new Date(po.createdAt).toLocaleDateString('es-PE')}
                      </span>
                    </td>
                    <td>
                      <strong className="supplier-text-variant-variant-u">
                        S/ {Number(po.total || 0).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                        <span className={`supplier-text supplier-element-variant-h-extended`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td>
                      <div className="supplier-element-variant-f-extended">
                        {po.status === 'draft' && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm supplier-text-variant-variant-v"
                            onClick={() => handleSendPO(po.id)}
                            disabled={actionLoading}
                          >
                            <Send size={13} /> Enviar OC
                          </button>
                        )}
                        {(po.status === 'draft' || po.status === 'sent') && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm supplier-text-variant-variant-w"
                            onClick={() => setReceivingPO(po)}
                            disabled={actionLoading}
                          >
                            <ArrowDownToLine size={13} /> Recibir Mercadería
                          </button>
                        )}
                        {po.status === 'received' && (
                          <span className="supplier-text-variant-variant-x">
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
            <div className="supplier-card-variant-u">
              <CheckCircle2 size={36} color="#16A34A" className="supplier-element-variant-l" />
              <h3 className="supplier-text-variant-variant-y">¡Inventario de Insumos en Niveles Óptimos!</h3>
              <p className="supplier-text-variant-variant-z">
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
                    <strong className="supplier-text-variant-variant-a-extended">{item.name}</strong>
                    <span className="supplier-text-variant-variant-l">Unidad de medida: <strong>{item.unit}</strong></span>
                  </td>
                  <td>
                    <strong className="supplier-text-variant-variant-b-extended">
                      {Number(item.stock).toFixed(1)} {item.unit}
                    </strong>
                  </td>
                  <td>
                    <span className="supplier-text-variant-variant-c-extended">
                      {Number(item.minimum).toFixed(1)} {item.unit}
                    </span>
                  </td>
                  <td>
                    <strong className="supplier-text-variant-variant-d-extended">
                      +{item.suggestedQuantity} {item.unit}
                    </strong>
                    <div className="supplier-element-variant-u">
                      Est. S/ {item.estimatedTotalCost.toFixed(2)}
                    </div>
                  </td>
                  <td>
                    <div className="supplier-text-variant-variant-e-extended">
                      {item.supplierName} {item.isPreferredSupplier ? '⭐ VIP' : ''}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm supplier-text-variant-variant-w"
                      onClick={() => handleCreatePOFromCritical(item)}
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
        <div className="supplier-overlay" onClick={() => setReceivingPO(null)}>
          <div className="supplier-card-variant-m" onClick={e => e.stopPropagation()}>
            <div className="supplier-row-variant-w">
              <div className="supplier-row-variant-x">
                <ArrowDownToLine size={22} color="#1E3A8A" />
                <h3 className="supplier-element-variant-a-extended">
                  Recepcionar OC: {receivingPO.orderNumber}
                </h3>
              </div>
              <button type="button" onClick={() => setReceivingPO(null)} className="supplier-element-variant-b-extended">✕</button>
            </div>

            <form onSubmit={handleExecuteReceivePO} className="supplier-stack-status">
              <div className="supplier-card-variant-v">
                <div>Proveedor: <strong>{receivingPO.supplier?.tradeName || receivingPO.supplier?.legalName}</strong></div>
                <div>Ítems a ingresar: <strong>{(receivingPO.items || []).length} insumos de cocina/bar</strong></div>
              </div>

              <div>
                <label className="supplier-text-variant-variant-f-extended">
                  N° Factura o Guía de Remisión del Proveedor
                </label>
                <input
                  type="text"
                  placeholder="Ej: F001-0008492"
                  value={receiveInvoice}
                  onChange={(e) => setReceiveInvoice(e.target.value)}
                  className="supplier-element-variant-k"
                />
              </div>

              {/* Delivery Rating (Recomendación 3) */}
              <div className="supplier-card-variant-w">
                <label className="supplier-text-variant-variant-g-extended">
                  Calificación de Calidad y Puntualidad (SLA)
                </label>
                <div className="supplier-element-variant-g-extended">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReceiveRating(star)}
                      className="supplier-surface-muted"
                    >
                      <Star
                        size={22}
                        fill={star <= receiveRating ? '#D97706' : 'transparent'}
                        color="#D97706"
                      />
                    </button>
                  ))}
                  <span className="supplier-text-variant-variant-h-extended">
                    {receiveRating === 5 ? '⭐⭐⭐⭐⭐ Excelente' : receiveRating === 4 ? '⭐⭐⭐⭐ Bueno' : receiveRating === 3 ? '⭐⭐⭐ Regular' : '⭐⭐ Con Observaciones'}
                  </span>
                </div>
              </div>

              <div>
                <label className="supplier-text-variant-variant-f-extended">
                  Notas u Observaciones de Calidad
                </label>
                <input
                  type="text"
                  placeholder="Ej: Insumos frescos y entrega dentro de horario"
                  value={receiveRatingNotes}
                  onChange={(e) => setReceiveRatingNotes(e.target.value)}
                  className="supplier-element-variant-k"
                />
              </div>

              <div className="supplier-row-variant-y">
                <button type="button" onClick={() => setReceivingPO(null)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading} className="btn btn-primary supplier-text-variant-n">
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
