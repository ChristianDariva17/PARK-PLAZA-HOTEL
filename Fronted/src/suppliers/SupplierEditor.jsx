import React, { useState, useEffect, useMemo } from 'react';
import { Dialog } from '../components/ui/Overlay';
import { suppliersClient } from './suppliersClient';
import { getInventory } from '../restaurant/restaurantClient';
import { 
  Building2, 
  Save, 
  Star, 
  Check, 
  Tag, 
  User, 
  Phone, 
  Mail, 
  Clock, 
  ShieldCheck, 
  UtensilsCrossed, 
  Wine, 
  Sparkles, 
  Wrench, 
  BedDouble, 
  Layers, 
  Search,
  PackageCheck,
  AlertTriangle,
  Info
} from 'lucide-react';

const CATEGORIES = [
  { id: 'food', label: 'Alimentos & Carnes', icon: UtensilsCrossed, color: '#B45309', bg: '#FEF3C7' },
  { id: 'beverage', label: 'Licores & Bebidas', icon: Wine, color: '#7C3AED', bg: '#F3E8FF' },
  { id: 'cleaning', label: 'Limpieza & Higiene', icon: Sparkles, color: '#0284C7', bg: '#E0F2FE' },
  { id: 'maintenance', label: 'Mantenimiento & Técnico', icon: Wrench, color: '#4B5563', bg: '#F3F4F6' },
  { id: 'amenities', label: 'Amenities & Blancos', icon: BedDouble, color: '#059669', bg: '#D1FAE5' },
  { id: 'services', label: 'Servicios Externos', icon: Layers, color: '#D97706', bg: '#FFFBEB' },
  { id: 'other', label: 'Otros Suministros', icon: Tag, color: '#6B7280', bg: '#F9FAFB' },
];

export function SupplierEditor({ open, supplierId, onSaved, onClose }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [expectedVersion, setExpectedVersion] = useState(1);

  // Available Inventory items for selection
  const [allInventoryItems, setAllInventoryItems] = useState([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  const [formData, setFormData] = useState({
    legalName: '',
    taxId: '',
    tradeName: '',
    contactName: '',
    phone: '',
    email: '',
    categories: ['food'],
    averageDeliveryDays: 2,
    isPreferred: false,
  });

  useEffect(() => {
    if (open) {
      setError(null);
      
      // Load all inventory items to allow linking
      getInventory()
        .then((items) => {
          setAllInventoryItems(items || []);
        })
        .catch(console.error);

      if (supplierId) {
        setFetching(true);
        suppliersClient
          .getSupplierDetail(supplierId)
          .then((sup) => {
            setExpectedVersion(sup.version);
            setFormData({
              legalName: sup.legalName || '',
              taxId: sup.taxId || '',
              tradeName: sup.tradeName || '',
              contactName: sup.contactName || '',
              phone: sup.phone || '',
              email: sup.email || '',
              categories: sup.categories || [],
              averageDeliveryDays: sup.averageDeliveryDays || 0,
              isPreferred: Boolean(sup.isPreferred),
            });
            if (sup.inventory && Array.isArray(sup.inventory)) {
              setSelectedItemIds(sup.inventory.map(i => i.id));
            } else {
              setSelectedItemIds([]);
            }
          })
          .catch((err) => setError(err.message || 'Error cargando proveedor'))
          .finally(() => setFetching(false));
      } else {
        setExpectedVersion(1);
        setSelectedItemIds([]);
        setFormData({
          legalName: '',
          taxId: '',
          tradeName: '',
          contactName: '',
          phone: '',
          email: '',
          categories: ['food'],
          averageDeliveryDays: 2,
          isPreferred: false,
        });
      }
    }
  }, [open, supplierId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCategoryToggle = (catId) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(catId)
        ? prev.categories.filter((c) => c !== catId)
        : [...prev.categories, catId],
    }));
  };

  const toggleInventoryItem = (itemId) => {
    setSelectedItemIds(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const filteredInventory = useMemo(() => {
    if (!inventorySearch.trim()) return allInventoryItems;
    const q = inventorySearch.toLowerCase();
    return allInventoryItems.filter(i => 
      (i.name || '').toLowerCase().includes(q) ||
      (i.unit || '').toLowerCase().includes(q)
    );
  }, [allInventoryItems, inventorySearch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        legalName: formData.legalName.trim(),
        taxId: formData.taxId.trim(),
        tradeName: formData.tradeName.trim() || null,
        contactName: formData.contactName.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        categories: formData.categories,
        averageDeliveryDays: parseInt(formData.averageDeliveryDays, 10) || 0,
        isPreferred: Boolean(formData.isPreferred),
        inventoryItemIds: selectedItemIds,
      };

      if (!payload.legalName) throw new Error('La Razón Social es requerida.');
      if (!payload.taxId) throw new Error('El RUC o documento fiscal es requerido.');
      if (payload.taxId.length !== 11) throw new Error('El RUC debe tener exactamente 11 dígitos numéricos.');

      if (supplierId) {
        await suppliersClient.updateSupplier(supplierId, expectedVersion, payload);
      } else {
        await suppliersClient.createSupplier(payload);
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Error guardando proveedor. Verifique que el RUC no esté duplicado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide={true}
      title={supplierId ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
      description={supplierId ? 'Actualice la información fiscal, canales de compra y catálogo de insumos abastecidos.' : 'Complete la ficha técnica y comercial del proveedor para vincularlo a las órdenes de compra e inventario.'}
    >
      {fetching ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', fontSize: 14 }}>
          Cargando datos del proveedor...
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '80vh', overflowY: 'auto', paddingRight: 6 }}>
          
          {error && (
            <div style={{ padding: '12px 16px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 10, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* SECTION 1: Identidad Fiscal */}
          <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid #F3F4F6', paddingBottom: 10 }}>
              <Building2 size={18} color="#D97706" />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Datos Fiscales & Razón Social
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 5 }}>
                  Razón Social (Nombre Legal) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  name="legalName"
                  value={formData.legalName}
                  onChange={handleChange}
                  placeholder="Ej: Distribuidora Gastronómica del Sur S.A.C."
                  required
                  style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 13.5, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 5 }}>
                  RUC / Identificador Fiscal (11 dígitos) <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input
                  type="text"
                  name="taxId"
                  maxLength={11}
                  value={formData.taxId}
                  onChange={(e) => setFormData(p => ({ ...p, taxId: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="Ej: 20601928374"
                  required
                  style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14, fontFamily: 'monospace', fontWeight: 700, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 5 }}>
                Nombre Comercial (Marca / Nombre de Fantasía)
              </label>
              <input
                type="text"
                name="tradeName"
                value={formData.tradeName}
                onChange={handleChange}
                placeholder="Ej: Gastrosur Gourmet & Carnes"
                style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 13.5, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>

          {/* SECTION 2: Contacto Comercial & Canales */}
          <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid #F3F4F6', paddingBottom: 10 }}>
              <User size={18} color="#D97706" />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Contacto Comercial & Canales de Compra
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 5 }}>
                  Nombre del Asesor / Ejecutivo
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  placeholder="Ej: Carlos Mendoza"
                  style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 5 }}>
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Ej: +51 987 654 321"
                  style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 5 }}>
                  Email para Órdenes de Compra
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Ej: pedidos@gastrosur.pe"
                  style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Tiempos de Entrega & Preferencia */}
          <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, borderBottom: '1px solid #F3F4F6', paddingBottom: 10 }}>
              <Clock size={18} color="#D97706" />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                3. Operaciones & Condiciones de Entrega
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#1E3A8A', marginBottom: 5 }}>
                  Plazo Promedio de Entrega (Días)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    name="averageDeliveryDays"
                    value={formData.averageDeliveryDays}
                    onChange={handleChange}
                    min="0"
                    max="90"
                    style={{ width: 100, height: 40, borderRadius: 8, border: '1px solid #CBD5E1', padding: '0 12px', fontSize: 14, fontWeight: 700, outline: 'none' }}
                  />
                  <span style={{ fontSize: 12.5, color: '#6B7280' }}>días hábiles</span>
                </div>
              </div>

              {/* Preferred VIP Supplier Toggle Card */}
              <div 
                onClick={() => setFormData(p => ({ ...p, isPreferred: !p.isPreferred }))}
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: `1.5px solid ${formData.isPreferred ? '#F59E0B' : '#E5E7EB'}`,
                  background: formData.isPreferred ? '#FFFBEB' : '#F9FAFB',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.15s'
                }}
              >
                <input
                  type="checkbox"
                  id="isPreferred"
                  name="isPreferred"
                  checked={formData.isPreferred}
                  onChange={handleChange}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#D97706' }}
                />
                <div>
                  <strong style={{ fontSize: 13, color: formData.isPreferred ? '#92400E' : '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Star size={15} fill={formData.isPreferred ? '#D97706' : 'none'} color="#D97706" />
                    Proveedor Preferido / Calificado VIP
                  </strong>
                  <span style={{ fontSize: 11.5, color: '#6B7280', display: 'block', marginTop: 2 }}>
                    Tendrá prioridad automática al emitir cotizaciones y órdenes de compra.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Categorías de Suministros */}
          <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #F3F4F6', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={18} color="#D97706" />
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  4. Categorías de Suministros que Provee
                </h4>
              </div>
              <span style={{ fontSize: 11.5, color: '#6B7280' }}>Seleccione una o varias</span>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {CATEGORIES.map((cat) => {
                const selected = formData.categories.includes(cat.id);
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryToggle(cat.id)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 20,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: `1.5px solid ${selected ? '#D97706' : '#E5E7EB'}`,
                      background: selected ? 'rgba(212, 175, 55, 0.1)' : '#FFFFFF',
                      color: selected ? '#92400E' : '#4B5563',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      transition: 'all 0.15s ease',
                      boxShadow: selected ? '0 1px 3px rgba(212, 175, 55, 0.2)' : '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    <Icon size={14} color={selected ? '#D97706' : '#6B7280'} />
                    {cat.label}
                    {selected && <Check size={13} color="#D97706" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 5: Insumos de Inventario Abastecidos (Conexión Inventario) */}
          <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottom: '1px solid #F3F4F6', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PackageCheck size={18} color="#D97706" />
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#1E3A8A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  5. Insumos del Hotel que Abastece ({selectedItemIds.length} seleccionados)
                </h4>
              </div>
              <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 700, background: '#D1FAE5', padding: '2px 8px', borderRadius: 6 }}>
                Conectado a Cocina y Bar 5★
              </span>
            </div>

            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '0 0 12px' }}>
              Vincule los insumos y materias primas que este proveedor suministra para actualizar costos y órdenes automáticamente.
            </p>

            {/* Insumos Search Bar */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                type="text"
                placeholder="Buscar insumos (Ej: Lomo fino, Salmón, Pisco, Café, Leche...)"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  paddingLeft: 36,
                  paddingRight: 12,
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  fontSize: 13,
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>

            {/* Insumos Grid */}
            <div style={{ maxHeight: 180, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, padding: 4 }}>
              {filteredInventory.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9CA3AF', padding: '16px 0', fontSize: 12.5 }}>
                  No se encontraron insumos coincidentes en el inventario.
                </div>
              ) : (
                filteredInventory.map(item => {
                  const isChecked = selectedItemIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleInventoryItem(item.id)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: `1.5px solid ${isChecked ? '#D97706' : '#E2E8F0'}`,
                        background: isChecked ? 'rgba(212, 175, 55, 0.08)' : '#F8FAFC',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        transition: 'all 0.12s'
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1E293B', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748B' }}>
                          Unid: <strong>{item.unit}</strong> · Stock: {Number(item.stock || 0).toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', accentColor: '#D97706' }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: 16, marginTop: 4 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading} style={{ padding: '10px 20px', fontSize: 13.5, fontWeight: 700 }}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 26px',
                fontSize: 14,
                fontWeight: 800,
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}
            >
              <Save size={16} /> {loading ? 'Guardando Proveedor...' : supplierId ? 'Actualizar Ficha Proveedor' : 'Crear y Guardar Proveedor'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
