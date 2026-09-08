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
        <div className="supplier-element-variant-i-extended">
          Cargando datos del proveedor...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="supplier-stack-action">
          
          {error && (
            <div className="supplier-row-header">
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          {/* SECTION 1: Identidad Fiscal */}
          <div className="supplier-card-variant-o">
            <div className="supplier-row-variant-z">
              <Building2 size={18} color="#D97706" />
              <h4 className="supplier-element-variant-j-extended">
                1. Datos Fiscales & Razón Social
              </h4>
            </div>

            <div className="supplier-grid-accent">
              <div>
                <label className="supplier-element-variant-k-extended">
                  Razón Social (Nombre Legal) <span className="supplier-element-content">*</span>
                </label>
                <input
                  type="text"
                  name="legalName"
                  value={formData.legalName}
                  onChange={handleChange}
                  placeholder="Ej: Distribuidora Gastronómica del Sur S.A.C."
                  required
                  className="supplier-element-variant-l-extended"
                />
              </div>

              <div>
                <label className="supplier-element-variant-k-extended">
                  RUC / Identificador Fiscal (11 dígitos) <span className="supplier-element-content">*</span>
                </label>
                <input
                  type="text"
                  name="taxId"
                  maxLength={11}
                  value={formData.taxId}
                  onChange={(e) => setFormData(p => ({ ...p, taxId: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="Ej: 20601928374"
                  required
                  className="supplier-element-variant-m-extended"
                />
              </div>
            </div>

            <div>
              <label className="supplier-element-variant-k-extended">
                Nombre Comercial (Marca / Nombre de Fantasía)
              </label>
              <input
                type="text"
                name="tradeName"
                value={formData.tradeName}
                onChange={handleChange}
                placeholder="Ej: Gastrosur Gourmet & Carnes"
                className="supplier-element-variant-l-extended"
              />
            </div>
          </div>

          {/* SECTION 2: Contacto Comercial & Canales */}
          <div className="supplier-card-variant-o">
            <div className="supplier-row-variant-z">
              <User size={18} color="#D97706" />
              <h4 className="supplier-element-variant-j-extended">
                2. Contacto Comercial & Canales de Compra
              </h4>
            </div>

            <div className="supplier-grid-status">
              <div>
                <label className="supplier-element-variant-k-extended">
                  Nombre del Asesor / Ejecutivo
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  placeholder="Ej: Carlos Mendoza"
                  className="supplier-element-variant-n-extended"
                />
              </div>

              <div>
                <label className="supplier-element-variant-k-extended">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Ej: +51 987 654 321"
                  className="supplier-element-variant-n-extended"
                />
              </div>

              <div>
                <label className="supplier-element-variant-k-extended">
                  Email para Órdenes de Compra
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Ej: pedidos@gastrosur.pe"
                  className="supplier-element-variant-n-extended"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Tiempos de Entrega & Preferencia */}
          <div className="supplier-card-variant-o">
            <div className="supplier-row-variant-z">
              <Clock size={18} color="#D97706" />
              <h4 className="supplier-element-variant-j-extended">
                3. Operaciones & Condiciones de Entrega
              </h4>
            </div>

            <div className="supplier-grid-action">
              <div>
                <label className="supplier-element-variant-k-extended">
                  Plazo Promedio de Entrega (Días)
                </label>
                <div className="supplier-element-variant-o-extended">
                  <input
                    type="number"
                    name="averageDeliveryDays"
                    value={formData.averageDeliveryDays}
                    onChange={handleChange}
                    min="0"
                    max="90"
                    className="supplier-element-variant-p-extended"
                  />
                  <span className="supplier-element-variant-q-extended">días hábiles</span>
                </div>
              </div>

              {/* Preferred VIP Supplier Toggle Card */}
              <div 
                onClick={() => setFormData(p => ({ ...p, isPreferred: !p.isPreferred }))}
                className={`supplier-row ${formData.isPreferred ? 'is-preferred' : ''}`}
              >
                <input
                  type="checkbox"
                  id="isPreferred"
                  name="isPreferred"
                  checked={formData.isPreferred}
                  onChange={handleChange}
                  onClick={(e) => e.stopPropagation()}
                  className="supplier-control"
                />
                <div>
                  <strong className={`supplier-row-secondary ${formData.isPreferred ? 'is-preferred' : ''}`}>
                    <Star size={15} fill={formData.isPreferred ? '#D97706' : 'none'} color="#D97706" />
                    Proveedor Preferido / Calificado VIP
                  </strong>
                  <span className="supplier-element-variant-r-extended">
                    Tendrá prioridad automática al emitir cotizaciones y órdenes de compra.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Categorías de Suministros */}
          <div className="supplier-card-variant-o">
            <div className="supplier-element-variant-s-extended">
              <div className="supplier-element-variant-o-extended">
                <Tag size={18} color="#D97706" />
                <h4 className="supplier-element-variant-j-extended">
                  4. Categorías de Suministros que Provee
                </h4>
              </div>
              <span className="supplier-element-variant-t-extended">Seleccione una o varias</span>
            </div>

            <div className="supplier-element-variant-u-extended">
              {CATEGORIES.map((cat) => {
                const selected = formData.categories.includes(cat.id);
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryToggle(cat.id)}
                    className={`supplier-card ${selected ? 'is-selected' : ''}`}
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
          <div className="supplier-card-variant-o">
            <div className="supplier-element-variant-s-extended">
              <div className="supplier-element-variant-o-extended">
                <PackageCheck size={18} color="#D97706" />
                <h4 className="supplier-element-variant-j-extended">
                  5. Insumos del Hotel que Abastece ({selectedItemIds.length} seleccionados)
                </h4>
              </div>
              <span className="supplier-card-variant-p">
                Conectado a Cocina y Bar 5★
              </span>
            </div>

            <p className="supplier-element-variant-v-extended">
              Vincule los insumos y materias primas que este proveedor suministra para actualizar costos y órdenes automáticamente.
            </p>

            {/* Insumos Search Bar */}
            <div className="supplier-element-header">
              <Search size={15} color="#9CA3AF" className="supplier-overlay-secondary" />
              <input
                type="text"
                placeholder="Buscar insumos (Ej: Lomo fino, Salmón, Pisco, Café, Leche...)"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                className="supplier-text-variant-variant-a"
              />
            </div>

            {/* Insumos Grid */}
            <div className="supplier-grid-field">
              {filteredInventory.length === 0 ? (
                <div className="supplier-text-variant-variant-b">
                  No se encontraron insumos coincidentes en el inventario.
                </div>
              ) : (
                filteredInventory.map(item => {
                  const isChecked = selectedItemIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleInventoryItem(item.id)}
                      className={`supplier-row-compact ${isChecked ? 'is-checked' : ''}`}
                    >
                      <div className="supplier-element-footer">
                        <span className="supplier-text-variant-variant-c">
                          {item.name}
                        </span>
                        <span className="supplier-element-variant-u">
                          Unid: <strong>{item.unit}</strong> · Stock: {Number(item.stock || 0).toFixed(1)}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="supplier-element-variant-k"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="supplier-element-variant-w-extended">
            <button type="button" className="btn btn-outline supplier-text-variant-variant-d" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary supplier-text-variant-variant-e"
              disabled={loading}
            >
              <Save size={16} /> {loading ? 'Guardando Proveedor...' : supplierId ? 'Actualizar Ficha Proveedor' : 'Crear y Guardar Proveedor'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
