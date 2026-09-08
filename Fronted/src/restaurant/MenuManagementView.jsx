import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  RefreshCw,
  Eye,
  Edit,
  Power,
  Clock,
  ChefHat,
  X,
  Check,
  AlertCircle,
  LayoutGrid,
  List,
  Sparkles,
  Layers,
} from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';
import { useHotel } from '../state/hotelContext.js';
import { useAuth } from '../auth/authContext.js';
import { hasKitchenManagementAccess } from '../auth/permissions.js';
import { Dialog } from '../components/ui/Overlay.jsx';
import { PageHeader, MetricStrip, StatusBadge, EmptyState } from '../components/views/SharedViewParts.jsx';

// ─── Categories & Icon Helper ──────────────────────────────────────────────────
const EMPTY_ITEMS = [];
const EMPTY_INVENTORY = [];

const COMMON_CATEGORIES = [
  'Todas',
  'Los Clásicos del Bar',
  'Entradas',
  'Saltados y Chaufas',
  'Pescados y Mariscos',
  'Pastas',
  'Carnes',
  'Comidas',
  'Bebidas',
  'Gaseosas',
  'Licores y Vinos',
  'Postres',
  'Combos',
  'Otro',
];

const isBarCategory = (category = '') => {
  const cat = (category || '').toLowerCase();
  return (
    cat.includes('bar') ||
    cat.includes('coctel') ||
    cat.includes('trago') ||
    cat.includes('licor') ||
    cat.includes('pisco') ||
    cat.includes('vino') ||
    cat.includes('cerveza') ||
    cat.includes('bebida') ||
    cat.includes('autor') ||
    cat.includes('whisky') ||
    cat.includes('ron') ||
    cat.includes('gin') ||
    cat.includes('frappe')
  );
};

const isDessertCategory = (category = '') => {
  const cat = (category || '').toLowerCase();
  return (
    cat.includes('postre') ||
    cat.includes('café') ||
    cat.includes('cafe') ||
    cat.includes('dulce') ||
    cat.includes('helado') ||
    cat.includes('torta')
  );
};

const CULINARY_TAG_PRESETS = [
  { id: 'especialidad', label: '⭐ Especialidad 5★' },
  { id: 'chef', label: '👨‍🍳 Recomendado del Chef' },
  { id: 'autor', label: '🍸 Cóctel de Autor' },
  { id: 'vegano', label: '🌱 Vegetariano / Vegano' },
  { id: 'glutenfree', label: '🌾 Sin Gluten' },
  { id: 'picante', label: '🌶️ Toque Picante' },
];

function convertIngredientToInventoryUnit(quantity, fromUnit, toUnit) {
  const from = (fromUnit || '').toLowerCase().trim();
  const to = (toUnit || '').toLowerCase().trim();
  if (from === to) return quantity;
  if (from === 'oz' && (to === 'litro' || to === 'l' || to.includes('litro'))) return quantity * 0.0295735;
  if (from === 'ml' && (to === 'litro' || to === 'l' || to.includes('litro'))) return quantity / 1000;
  if (from === 'cl' && (to === 'litro' || to === 'l')) return quantity * 0.01;
  if (from === 'g' && (to === 'kg' || to === 'kilo' || to.includes('kg') || to.includes('kilo'))) return quantity / 1000;
  if ((from === 'kg' || from === 'kilo') && to === 'g') return quantity * 1000;
  if (from === 'dash' && (to === 'litro' || to === 'l')) return quantity * 0.0009;
  return quantity;
}

const getCategoryIcon = (category = '') => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('bar') || cat.includes('coctel') || cat.includes('pisco') || cat.includes('autor')) return '🍸';
  if (cat.includes('cerveza')) return '🍺';
  if (cat.includes('vino') || cat.includes('licor')) return '🍷';
  if (cat.includes('gaseosa') || cat.includes('bebida') || cat.includes('agua')) return '🥤';
  if (cat.includes('pescado') || cat.includes('marisco') || cat.includes('ceviche')) return '🐟';
  if (cat.includes('carne') || cat.includes('parrilla')) return '🥩';
  if (cat.includes('pasta')) return '🍝';
  if (cat.includes('saltado') || cat.includes('chaufa') || cat.includes('arroz')) return '🍳';
  if (cat.includes('entrada') || cat.includes('piqueo') || cat.includes('fritura')) return '🥟';
  if (cat.includes('postre') || cat.includes('dulce')) return '🍰';
  if (cat.includes('café') || cat.includes('cafe')) return '☕';
  if (cat.includes('frappe')) return '🍧';
  return '🍽️';
};

const UNIT_OPTIONS = [
  { value: 'oz', label: 'oz (Onzas líquidas - Bar)', icon: '🍸' },
  { value: 'ml', label: 'ml (Mililitros)', icon: '🧪' },
  { value: 'L', label: 'L (Litros)', icon: '🧃' },
  { value: 'g', label: 'g (Gramos - Cocina)', icon: '⚖️' },
  { value: 'kg', label: 'kg (Kilogramos)', icon: '📦' },
  { value: 'und', label: 'und (Unidades)', icon: '🔢' },
  { value: 'dash', label: 'dash (Gotas / Golpe)', icon: '💧' },
  { value: 'porcion', label: 'porción (Porción)', icon: '🍽️' },
];

// ─── Detail Drawer (Ficha Técnica & Receta de Cocina / Bar) ────────────────────
function MenuItemDetailModal({ item, onClose, onEdit, onToggleStatus, inventory }) {
  if (!item) return null;
  const isArchived = item.status === 'archived';
  const categoryIcon = getCategoryIcon(item.category);
  const isBar = isBarCategory(item.category);

  return (
    <Dialog open={true} onClose={onClose} title={`Ficha Técnica – ${item.name}`} wide>
      <div className="detail-stack">
        {/* Hero Card */}
        <div className="room-hero-card menu-text-secondary5">
          <div className="menu-text-secondary6">
            <div className="menu-text-secondary7">
              {categoryIcon}
            </div>
            <div>
              <div className="menu-text-secondary8">
                <span className="room-hero-category menu-text-secondary9">
                  {item.category || 'General'}
                </span>
                <StatusBadge>{isArchived ? 'No disponible' : 'Disponible'}</StatusBadge>
                {isBar && (
                  <span className="menu-row-secondary0">
                    🍸 Receta en Onzas
                  </span>
                )}
              </div>
              <h2 className="room-hero-number menu-row-secondary1">
                {item.name}
              </h2>
              {item.description && (
                <p className="menu-row-secondary2">
                  {item.description}
                </p>
              )}
            </div>
          </div>
          <div className="room-hero-price">
            <span className="room-hero-price-label">Precio Carta</span>
            <span className="room-hero-price-amount menu-row-secondary3">
              {formatMoney(item.salePrice)}
            </span>
            <span className="room-hero-price-period">
              ⏱️ {item.preparationMinutes || 10} min preparación
            </span>
          </div>
        </div>

        {/* 4-Spec Operational Grid */}
        <div className="drawer-specs-grid menu-row-secondary4">
          <div className="drawer-spec-item">
            <div className="drawer-spec-icon">⏱️</div>
            <div className="drawer-spec-text">
              <span>Tiempo de {isBar ? 'Barra' : 'Cocina'}</span>
              <strong>{item.preparationMinutes || 10} minutos</strong>
            </div>
          </div>
          <div className="drawer-spec-item">
            <div className="drawer-spec-icon">{isBar ? '🍸' : '👨‍🍳'}</div>
            <div className="drawer-spec-text">
              <span>Insumos de Receta</span>
              <strong>{item.ingredients?.length || 0} componentes</strong>
            </div>
          </div>
          <div className="drawer-spec-item">
            <div className="drawer-spec-icon">📊</div>
            <div className="drawer-spec-text">
              <span>Modo de Gestión</span>
              <strong>{item.managementMode === 'imported' ? 'Importado' : 'Receta Manual'}</strong>
            </div>
          </div>
          <div className="drawer-spec-item">
            <div className="drawer-spec-icon">📱</div>
            <div className="drawer-spec-text">
              <span>Visibilidad QR</span>
              <strong>{isArchived ? 'Oculto en Carta' : 'Visible a Huéspedes'}</strong>
            </div>
          </div>
        </div>

        {/* Financial & Profitability Card */}
        {item.costSummary && item.costSummary.recipeCost > 0 && (
          <div className="drawer-section-card menu-row-secondary5">
            <div className="drawer-section-title menu-row-secondary6">
              <span className="menu-row-secondary7">
                💎 Rentabilidad y Escandallo de Costos
              </span>
              <span className="menu-row-secondary8">
                Margen Bruto: {item.costSummary.grossMarginPercent}%
              </span>
            </div>
            <div className="menu-row-secondary9">
              <div className="menu-surface-secondary0">
                <span className="menu-surface-secondary1">Costo de Insumos</span>
                <strong className="menu-surface-secondary2">S/ {item.costSummary.recipeCost.toFixed(2)}</strong>
              </div>
              <div className="menu-surface-secondary3">
                <span className="menu-surface-secondary4">Precio de Venta</span>
                <strong className="menu-surface-secondary5">S/ {Number(item.salePrice || 0).toFixed(2)}</strong>
              </div>
              <div className="menu-surface-secondary6">
                <span className="menu-surface-secondary7">Ganancia por Unidad</span>
                <strong className="menu-surface-secondary8">S/ {item.costSummary.profitPerUnit.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Recipe / Ingredients Table */}
        <div className="drawer-section-card">
          <div className="drawer-section-title">
            <ChefHat size={16} /> Insumos y Dosificación de la Receta ({item.ingredients?.length || 0})
          </div>

          {(!item.ingredients || item.ingredients.length === 0) ? (
            <p className="menu-surface-secondary9">
              Este producto no tiene insumos de almacén vinculados. Se procesa como producto directo de carta.
            </p>
          ) : (
            <div className="table-container menu-surface-secondary0">
              <table className="custom-table menu-surface-secondary1">
                <thead>
                  <tr>
                    <th>Insumo de Almacén</th>
                    <th className="menu-surface-secondary2">Dosificación (Receta)</th>
                    <th>Detalle / Especificación</th>
                    <th className="menu-surface-secondary3">Stock Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {item.ingredients.map((ing, idx) => {
                    const inv = inventory.find(i => i.id === ing.inventoryItemId);
                    const stock = inv ? Number(inv.stock) - Number(inv.reserved || 0) : null;
                    const isLowStock = stock !== null && stock < (Number(ing.quantity) * 5);
                    const isOutOfStock = stock !== null && stock <= 0;
                    return (
                      <tr key={idx}>
                        <td>
                          <strong>📦 {inv?.name || ing.inventoryItemId || 'Insumo'}</strong>
                        </td>
                        <td className="menu-surface-secondary4">
                          <span className="menu-surface-secondary5">
                            {ing.quantity} {ing.unit || inv?.unit || 'und'}
                          </span>
                        </td>
                        <td className="menu-surface-secondary6">
                          {ing.detail ? (
                            <span>✨ {ing.detail}</span>
                          ) : (
                            <span className="menu-surface-secondary7">Estándar</span>
                          )}
                        </td>
                        <td className="menu-surface-secondary8">
                          {stock !== null ? (
                            <span className="menu-surface-secondary9">
                              {stock} {inv?.unit} {isOutOfStock ? '(Agotado)' : isLowStock ? '(Bajo)' : '(OK)'}
                            </span>
                          ) : (
                            <span className="menu-surface-secondary0">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="menu-surface-secondary1">
          <button
            type="button"
            onClick={() => onToggleStatus(item)}
            className={`btn btn-outline menu-surface-secondary2 ${isArchived ? '' : 'btn-danger'}`}
          >
            <Power size={15} /> {isArchived ? 'Activar en Carta' : 'Desactivar de Carta'}
          </button>

          <div className="menu-surface-secondary3">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Cerrar
            </button>
            <button
              type="button"
               className="btn btn-primary menu-surface-secondary4"
              onClick={() => { onClose(); onEdit(item); }}
            >
              <Edit size={15} /> Modificar Receta / Precio
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Add / Edit Modal (Pestañas ergonómicas, Escandallo y Costeo en Tiempo Real) ────
function MenuItemFormModal({ item, onClose, notify }) {
  const { state, menuManagementCommands } = useHotel();
  const activeInventory = state.inventory.filter((inv) => inv.status !== 'Archivado');
  const inventoryMap = useMemo(() => new Map(state.inventory.map((i) => [i.id, i])), [state.inventory]);
  const firstInventory = activeInventory[0]?.id || '';

  const isInitialBar = item ? isBarCategory(item.category) : false;

  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'recipe' | 'service'

  // Extract initial tags from description if present
  const initialTags = useMemo(() => {
    if (!item?.description) return [];
    const found = [];
    CULINARY_TAG_PRESETS.forEach(tag => {
      if (item.description.includes(tag.label)) found.push(tag.label);
    });
    return found;
  }, [item]);

  const [form, setForm] = useState(item ? {
    name: item.name || '',
    category: item.category || 'Comidas',
    salePrice: item.salePrice ? String(item.salePrice) : '',
    description: item.description || '',
    preparationMinutes: item.preparationMinutes || 10,
    tags: initialTags,
    isPublished: item.isPublished !== false,
    ingredients: (item.ingredients || []).map((ing) => ({
      inventoryItemId: ing.inventoryItemId,
      quantity: ing.quantity,
      unit: ing.unit || (isInitialBar ? 'oz' : 'und'),
      detail: ing.detail || ''
    }))
  } : {
    name: '',
    category: 'Comidas',
    salePrice: '',
    description: '',
    preparationMinutes: 10,
    tags: ['⭐ Especialidad 5★'],
    isPublished: true,
    ingredients: []
  });

  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const isCurrentBar = isBarCategory(form.category);

  // ─── Real-Time Cost, Profit & Margin Calculation ──────────────────────────
  const calculatedCost = useMemo(() => {
    let cost = 0;
    for (const ing of form.ingredients) {
      if (!ing.inventoryItemId || !Number(ing.quantity)) continue;
      const inv = inventoryMap.get(ing.inventoryItemId);
      if (!inv) continue;
      const convertedQty = convertIngredientToInventoryUnit(Number(ing.quantity), ing.unit, inv.unit);
      cost += convertedQty * (Number(inv.cost) || 0);
    }
    return Math.round(cost * 100) / 100;
  }, [form.ingredients, inventoryMap]);

  const salePriceNum = Number(form.salePrice) || 0;
  const grossMarginPercent = salePriceNum > 0 ? Math.round(((salePriceNum - calculatedCost) / salePriceNum) * 100) : 0;
  const profitPerUnit = Math.max(0, Math.round((salePriceNum - calculatedCost) * 100) / 100);

  const toggleTag = (tagLabel) => {
    setForm(prev => {
      const exists = prev.tags.includes(tagLabel);
      return {
        ...prev,
        tags: exists ? prev.tags.filter(t => t !== tagLabel) : [...prev.tags, tagLabel]
      };
    });
  };

  const updateIngredient = (index, key, value) => {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) => i === index ? { ...ing, [key]: value } : ing)
    }));
  };

  const addIngredient = () => {
    const defaultUnit = isCurrentBar ? 'oz' : 'und';
    setForm(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { inventoryItemId: firstInventory, quantity: isCurrentBar ? 1.5 : 1, unit: defaultUnit, detail: '' }
      ]
    }));
  };

  const removeIngredient = (index) => {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    const price = Number(form.salePrice);
    if (!Number.isFinite(price) || price <= 0) {
      setActiveTab('info');
      return setError('El precio debe ser un número positivo (ej: 25.00).');
    }
    const preparation = Number(form.preparationMinutes);
    if (!Number.isFinite(preparation) || preparation < 1 || preparation > 180) {
      setActiveTab('info');
      return setError('El tiempo de preparación debe ser entre 1 y 180 minutos.');
    }
    if (!form.name.trim()) {
      setActiveTab('info');
      return setError('El nombre del producto es obligatorio.');
    }

    // Build enhanced description with tags
    let finalDescription = form.description?.trim() || '';
    if (form.tags.length > 0) {
      const tagString = form.tags.join(' · ');
      if (!finalDescription.includes(tagString)) {
        finalDescription = finalDescription ? `${finalDescription}\n[${tagString}]` : tagString;
      }
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || 'Comidas',
      salePrice: price,
      description: finalDescription || null,
      preparationMinutes: preparation,
      ingredients: form.ingredients
        .filter((ing) => ing.inventoryItemId)
        .map((ing) => ({
          inventoryItemId: ing.inventoryItemId,
          quantity: Number(ing.quantity),
          unit: ing.unit?.trim() || (isCurrentBar ? 'oz' : 'und'),
          detail: ing.detail?.trim() || null
        }))
    };

    const ingIds = new Set(payload.ingredients.map(i => i.inventoryItemId));
    if (ingIds.size !== payload.ingredients.length) {
      setActiveTab('recipe');
      return setError('Hay insumos duplicados en la receta. Consolidá las cantidades.');
    }

    setSaving(true);
    try {
      if (item) {
        await menuManagementCommands.updateManual(item.id, payload);
        notify('Producto modificado', `${payload.name} se actualizó correctamente en la carta.`, 'success');
      } else {
        await menuManagementCommands.createManual(payload);
        notify('Producto agregado', `${payload.name} ha sido añadido a la carta.`, 'success');
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={item ? `Modificar Ficha: ${item.name}` : 'Nuevo Plato o Bebida para Carta'}
      wide
    >
      <form onSubmit={submit} className="detail-stack">
        {error && (
          <div className="alert-banner alert-banner-danger" role="alert">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {/* ─── Live Luxury Preview Card Header ─────────────────────────────── */}
        <div className="menu-surface-secondary5">
          <div className="menu-surface-secondary6">
            <div className="menu-surface-secondary7">
              {getCategoryIcon(form.category)}
            </div>
            <div>
              <div className="menu-surface-secondary8">
                <span className="menu-surface-secondary9">
                  {form.category}
                </span>
                {isCurrentBar ? (
                  <span className="menu-surface-secondary10">
                    🍸 Dosificación Bar (oz)
                  </span>
                ) : (
                  <span className="menu-surface-secondary11">
                    👨‍🍳 Cocina Hotelera
                  </span>
                )}
                {form.tags.map(t => (
                  <span key={t} className="menu-surface-secondary12">
                    {t}
                  </span>
                ))}
              </div>
              <h4 className="menu-surface-secondary13">
                {form.name.trim() || 'Nombre del Plato o Cóctel'}
              </h4>
            </div>
          </div>

          <div className="menu-surface-secondary14">
            <div className="menu-surface-secondary15">
              {salePriceNum > 0 ? formatMoney(salePriceNum) : 'S/ 0.00'}
            </div>
            <div className="menu-surface-secondary16">
              <span className="menu-surface-secondary17">
                ⏱️ {form.preparationMinutes || 10} min
              </span>
              {calculatedCost > 0 && (
                <span className="menu-surface-secondary18">
                  Margen: {grossMarginPercent}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ─── Modal Internal Tabs ─────────────────────────────────────────── */}
        <div className="menu-modal-tabs">
          <button
            type="button"
            className={`menu-modal-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <Sparkles size={14} /> Ficha Comercial & Carta
          </button>
          <button
            type="button"
            className={`menu-modal-tab-btn ${activeTab === 'recipe' ? 'active' : ''}`}
            onClick={() => setActiveTab('recipe')}
          >
            <ChefHat size={14} /> Escandallo & Costeo en Vivo ({form.ingredients.length})
          </button>
          <button
            type="button"
            className={`menu-modal-tab-btn ${activeTab === 'service' ? 'active' : ''}`}
            onClick={() => setActiveTab('service')}
          >
            <Layers size={14} /> Carta QR & Servicio
          </button>
        </div>

        {/* ─── TAB 1: INFORMACIÓN COMERCIAL & CARTA ─────────────────────────── */}
        {activeTab === 'info' && (
          <div className="menu-surface-secondary19">
            <div className="form-grid">
              <label>
                Nombre Oficial del Plato o Bebida *
                <input
                  required
                  placeholder="Ej: Lomo Saltado Especial, Pisco Sour Catedral..."
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  disabled={saving}
                  className="menu-surface-secondary20"
                />
              </label>

              <label>
                Categoría Gastronómica *
                <select
                  value={form.category}
                  onChange={e => {
                    const newCat = e.target.value;
                    const becomesBar = isBarCategory(newCat);
                    setForm({
                      ...form,
                      category: newCat,
                      ingredients: form.ingredients.map(ing => ({
                        ...ing,
                        unit: becomesBar && (ing.unit === 'und' || !ing.unit) ? 'oz' : ing.unit
                      }))
                    });
                  }}
                  disabled={saving}
                >
                  {COMMON_CATEGORIES.filter(c => c !== 'Todas').map(cat => (
                    <option key={cat} value={cat}>{getCategoryIcon(cat)} {cat}</option>
                  ))}
                </select>
              </label>

              <label>
                Precio de Venta (S/ PEN) *
                <div className="menu-surface-secondary21">
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    required
                    placeholder="25.00"
                    value={form.salePrice}
                    onChange={e => setForm({ ...form, salePrice: e.target.value })}
                    disabled={saving}
                    className="menu-surface-secondary22"
                  />
                  <span className="menu-surface-secondary23">
                    S/
                  </span>
                </div>
              </label>

              <label>
                Tiempo de Preparación (Minutos) *
                <input
                  type="number"
                  min="1"
                  max="180"
                  required
                  placeholder="15"
                  value={form.preparationMinutes}
                  onChange={e => setForm({ ...form, preparationMinutes: e.target.value })}
                  disabled={saving}
                />
              </label>
            </div>

            {/* Culinary Tag Selector */}
            <div>
              <span className="menu-surface-secondary24">
                Distintivos y Etiquetas Culinarias:
              </span>
              <div className="menu-surface-secondary25">
                {CULINARY_TAG_PRESETS.map(preset => {
                  const isSelected = form.tags.includes(preset.label);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={`menu-tag-pill ${isSelected ? 'active' : ''}`}
                      onClick={() => toggleTag(preset.label)}
                    >
                      {isSelected ? <Check size={12} /> : null}
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label>
              Descripción Gastronómica (visible a comensales y mozos)
              <textarea
                rows={3}
                placeholder="Describe la preparación, guarniciones, tipo de cocción o notas organolépticas para la carta digital..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                disabled={saving}
              />
            </label>
          </div>
        )}

        {/* ─── TAB 2: ESCANDALLO & COSTEO EN TIEMPO REAL ────────────────────── */}
        {activeTab === 'recipe' && (
          <div className="menu-surface-secondary26">
            {/* Live Financial Metrics Banner */}
            <div className="menu-surface-secondary27">
              <div>
                <span className="menu-surface-secondary28">Costo de Insumos</span>
                <strong className="menu-surface-secondary29">
                  S/ {calculatedCost.toFixed(2)}
                </strong>
              </div>
              <div>
                <span className="menu-surface-secondary30">Precio de Venta</span>
                <strong className="menu-surface-secondary31">
                  S/ {salePriceNum.toFixed(2)}
                </strong>
              </div>
              <div>
                <span className="menu-surface-secondary32">Ganancia por Unidad</span>
                <strong className="menu-surface-secondary33">
                  S/ {profitPerUnit.toFixed(2)}
                </strong>
              </div>
              <div>
                <span className="menu-surface-secondary34">Margen Bruto</span>
                <span className="menu-surface-secondary35">
                  {grossMarginPercent}% {grossMarginPercent >= 60 ? '🌟 Óptimo' : grossMarginPercent >= 40 ? '⚠️ Regular' : '🔴 Bajo'}
                </span>
              </div>
            </div>

            {/* Ingredients Header */}
            <div className="menu-surface-secondary36">
              <div>
                <h4 className="menu-surface-secondary37">
                  {isCurrentBar ? '🍸 Insumos de Barra y Coctelería (Onzas)' : '👨‍🍳 Insumos de Cocina y Almacén'}
                </h4>
                <p className="menu-surface-secondary38">
                  {isCurrentBar
                    ? 'Dosifica licores en onzas (oz) o mililitros para rebaja automática de botellas.'
                    : 'Registra ingredientes en gramos, kilos o unidades para control automático de mermas.'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary menu-surface-secondary39"
                onClick={addIngredient}
                disabled={saving || activeInventory.length === 0}
              >
                <Plus size={14} /> Agregar {isCurrentBar ? 'Licor / Insumo' : 'Insumo'}
              </button>
            </div>

            {/* Ingredients List */}
            {form.ingredients.length === 0 ? (
              <div className="menu-surface-secondary40">
                <ChefHat size={32} color="var(--color-muted)" className="menu-surface-secondary41" />
                <p className="menu-surface-secondary42">
                  No has agregado insumos a esta receta.
                </p>
                <p className="menu-surface-secondary43">
                  Si no agregas insumos, el producto se venderá directamente sin rebajar stock del inventario.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={addIngredient}
                  disabled={saving || activeInventory.length === 0}
                >
                  <Plus size={14} /> Agregar Primer Insumo
                </button>
              </div>
            ) : (
              <div className="menu-surface-secondary44">
                {form.ingredients.map((ing, idx) => {
                  const inv = inventoryMap.get(ing.inventoryItemId);
                  const stockNum = inv ? Number(inv.stock) - Number(inv.reserved || 0) : null;
                  const isOutOfStock = stockNum !== null && stockNum <= 0;
                  const convertedQty = inv ? convertIngredientToInventoryUnit(Number(ing.quantity) || 0, ing.unit, inv.unit) : 0;
                  const lineCost = convertedQty * (Number(inv?.cost) || 0);

                  return (
                    <div key={idx} className="menu-ingredient-row">
                      {/* 1. Insumo Selector with Stock Badge */}
                      <div>
                        <select
                          value={ing.inventoryItemId}
                          onChange={e => updateIngredient(idx, 'inventoryItemId', e.target.value)}
                          disabled={saving}
                          className="menu-surface-secondary45"
                        >
                          {activeInventory.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.unit}) · Disp: {item.stock}
                            </option>
                          ))}
                        </select>
                        {isOutOfStock && (
                          <span className="menu-surface-secondary46">
                            ⚠️ Agotado en almacén
                          </span>
                        )}
                      </div>

                      {/* 2. Quantity */}
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="Cant."
                          value={ing.quantity}
                          onChange={e => updateIngredient(idx, 'quantity', e.target.value)}
                          disabled={saving}
                          className="menu-surface-secondary47"
                        />
                      </div>

                      {/* 3. Unit Selector */}
                      <div>
                        <select
                          value={ing.unit || (isCurrentBar ? 'oz' : 'und')}
                          onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                          disabled={saving}
                          className="menu-surface-secondary48"
                        >
                          {UNIT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.icon} {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 4. Specification Detail & Subtotal */}
                      <div className="menu-surface-secondary49">
                        <input
                          type="text"
                          placeholder="Detalle (ej: Pisco 42°, Colado...)"
                          value={ing.detail || ''}
                          onChange={e => updateIngredient(idx, 'detail', e.target.value)}
                          disabled={saving}
                          className="menu-surface-secondary50"
                        />
                        {lineCost > 0 && (
                          <span className="menu-surface-secondary51">
                            S/ {lineCost.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* 5. Delete Button */}
                      <button
                        type="button"
                         className="btn btn-sm btn-danger menu-surface-secondary52"
                        onClick={() => removeIngredient(idx)}
                        disabled={saving}
                        title="Eliminar insumo"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 3: CARTA QR & SERVICIO ───────────────────────────────────── */}
        {activeTab === 'service' && (
          <div className="menu-surface-secondary53">
            <div className="menu-surface-secondary54">
              <label className="menu-surface-secondary55">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={e => setForm({ ...form, isPublished: e.target.checked })}
                  disabled={saving}
                  className="menu-surface-secondary56"
                />
                <div>
                  <strong className="menu-surface-secondary57">
                    Visible en Carta Digital y Códigos QR de Huéspedes
                  </strong>
                  <span className="menu-surface-secondary58">
                    Al marcar esta opción, los huéspedes podrán solicitar este producto desde la habitación y áreas sociales.
                  </span>
                </div>
              </label>
            </div>

            <div className="form-grid">
              <label className="span-2">
                Notas Operativas de Servicio y Alérgenos
                <input
                  placeholder="Ej: Contiene mariscos y lactosa. Servir a 18°C con copa tulipán..."
                  value={form.detailNotes || ''}
                  onChange={e => setForm({ ...form, detailNotes: e.target.value })}
                  disabled={saving}
                />
              </label>
            </div>
          </div>
        )}

        {/* ─── Modal Footer Actions ─────────────────────────────────────────── */}
        <div className="menu-surface-secondary59">
          <div className="menu-surface-secondary60">
            {activeTab === 'info' && 'Paso 1: Completa los datos comerciales y de carta.'}
            {activeTab === 'recipe' && `Paso 2: ${form.ingredients.length} insumo(s) costeados en tiempo real.`}
            {activeTab === 'service' && 'Paso 3: Configura la disponibilidad en carta QR.'}
          </div>

          <div className="menu-surface-secondary61">
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary menu-surface-secondary62"
            >
              {saving ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}
              {saving ? 'Guardando...' : item ? 'Actualizar Producto' : 'Guardar en Carta'}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

// ─── Status Toggle (Desactivar / Activar) Modal ────────────────────────────────
function StatusToggleModal({ item, onClose, notify }) {
  const { menuManagementCommands } = useHotel();
  const [reason, setReason] = useState('Desactivado por administración de carta');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  if (!item) return null;
  const isArchived = item.status === 'archived';

  const onConfirm = async () => {
    setProcessing(true);
    setError(null);
    try {
      if (isArchived) {
        await menuManagementCommands.reactivateManual(item.id);
        notify('Producto activado', `${item.name} ahora está visible y disponible en la carta.`, 'success');
      } else {
        await menuManagementCommands.archiveManual(item.id, { reason });
        notify('Producto desactivado', `${item.name} ha sido ocultado de la carta operativa.`, 'success');
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error al cambiar el estado del producto.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      title={isArchived ? 'Activar Producto en Carta' : 'Desactivar Producto de la Carta'}
    >
      <div className="detail-stack">
        {error && (
          <div className="alert-banner alert-banner-danger" role="alert">
            {error}
          </div>
        )}
        <p className="menu-surface-secondary63">
          {isArchived ? (
            <>¿Deseas reactivar <strong>{item.name}</strong>? Volverá a aparecer en la carta para pedidos de habitaciones, barra y terraza.</>
          ) : (
            <>¿Deseas desactivar <strong>{item.name}</strong>? Se ocultará de la carta digital de huéspedes y comandas. Los pedidos históricos se mantendrán auditados.</>
          )}
        </p>

        {!isArchived && (
          <label className="menu-surface-secondary64">
            Motivo de desactivación
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              disabled={processing}
            />
          </label>
        )}

        <div className="menu-surface-secondary65">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={processing}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className={`menu-surface-secondary66 ${isArchived ? 'btn btn-primary' : 'btn btn-danger'}`}
          >
            {processing ? 'Procesando...' : isArchived ? 'Confirmar Activación' : 'Confirmar Desactivación'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── Main Menu Products View (Carta de Cocina y Bar 5★) ───────────────────────
export function MenuManagementView({ notify }) {
  const { permissions } = useAuth();
  const { state, menuManagementCommands } = useHotel();

  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(undefined);
  const [toggleStatusItem, setToggleStatusItem] = useState(null);

  const [segmentFilter, setSegmentFilter] = useState('all'); // 'all' | 'kitchen' | 'bar' | 'dessert'
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [sortBy, setSortBy] = useState('recommended');
  const [viewMode, setViewMode] = useState('grid');

  const hasAccess = hasKitchenManagementAccess(permissions);

  useEffect(() => {
    if (hasAccess) {
      menuManagementCommands.reload().catch(() => {});
    }
  }, [hasAccess, menuManagementCommands]);

  const items = state.managedMenu ?? EMPTY_ITEMS;
  const inventory = state.inventory ?? EMPTY_INVENTORY;
  const inventoryMap = useMemo(() => new Map(inventory.map((i) => [i.id, i])), [inventory]);
  const isLoading = state.menuManagementRequest?.status === 'loading';

  // Available categories with counts
  const categoryStats = useMemo(() => {
    const stats = { 'Todas': items.length };
    items.forEach(i => {
      const cat = i.category || 'Sin Categoría';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    return stats;
  }, [items]);

  const availableCategories = useMemo(() => {
    const list = Object.keys(categoryStats);
    return list.sort((a, b) => {
      if (a === 'Todas') return -1;
      if (b === 'Todas') return 1;
      return a.localeCompare(b);
    });
  }, [categoryStats]);

  // Segment counts
  const barCount = useMemo(() => items.filter(i => isBarCategory(i.category)).length, [items]);
  const dessertCount = useMemo(() => items.filter(i => isDessertCategory(i.category)).length, [items]);
  const kitchenCount = useMemo(() => items.filter(i => !isBarCategory(i.category) && !isDessertCategory(i.category)).length, [items]);

  // Financial & Operational Metrics
  const activeCount = items.filter(i => i.status !== 'archived').length;
  const archivedCount = items.filter(i => i.status === 'archived').length;
  const activeItems = items.filter(i => i.status !== 'archived');
  const avgPrice = activeItems.length > 0 
    ? Math.round((activeItems.reduce((sum, it) => sum + (Number(it.salePrice) || 0), 0) / activeItems.length) * 10) / 10 
    : 0;
  const withRecipeCount = items.filter(i => (i.ingredients?.length || 0) > 0).length;
  const recipePercent = items.length > 0 ? Math.round((withRecipeCount / items.length) * 100) : 0;

  // Filter & Sort Items
  const processedItems = useMemo(() => {
    let result = items.filter(item => {
      // 1. Status Filter
      if (statusFilter === 'Activos' && item.status === 'archived') return false;
      if (statusFilter === 'Desactivados' && item.status !== 'archived') return false;

      // 2. Segment Filter
      if (segmentFilter === 'kitchen' && (isBarCategory(item.category) || isDessertCategory(item.category))) return false;
      if (segmentFilter === 'bar' && !isBarCategory(item.category)) return false;
      if (segmentFilter === 'dessert' && !isDessertCategory(item.category)) return false;

      // 3. Category Filter
      if (categoryFilter !== 'Todas' && item.category !== categoryFilter) return false;

      // 4. Search Query
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = (item.name || '').toLowerCase().includes(query);
        const matchCat = (item.category || '').toLowerCase().includes(query);
        const matchDesc = (item.description || '').toLowerCase().includes(query);
        if (!matchName && !matchCat && !matchDesc) return false;
      }

      return true;
    });

    return result.sort((a, b) => {
      if (sortBy === 'price_desc') return (Number(b.salePrice) || 0) - (Number(a.salePrice) || 0);
      if (sortBy === 'price_asc') return (Number(a.salePrice) || 0) - (Number(b.salePrice) || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'time_asc') return (a.preparationMinutes || 0) - (b.preparationMinutes || 0);
      return 0;
    });
  }, [items, statusFilter, segmentFilter, categoryFilter, search, sortBy]);

  return (
    <div className="view-container">
      {/* ─── Luxury Page Header ────────────────────────────────────────────── */}
      <PageHeader
        metadata="Carta Gastronómica & Bar 5★"
        title="Cocina y Bar"
        description="Catálogo oficial de productos, recetas de autor, costeo de insumos y precios de venta del hotel."
        action={
          <div className="menu-surface-secondary67">
            <button
              type="button"
              onClick={() => menuManagementCommands.reload()}
              disabled={isLoading}
              className="btn btn-outline"
              title="Recargar catálogo completo"
            >
              <RefreshCw size={15} className={isLoading ? 'spin' : ''} /> Actualizar
            </button>
            <button
              type="button"
              onClick={() => setEditItem(null)}
              className="btn btn-primary menu-surface-secondary68"
            >
              <Plus size={16} /> Agregar Producto
            </button>
          </div>
        }
      />

      {/* ─── Enhanced Luxury Metric Strip ──────────────────────────────────── */}
      <MetricStrip
        items={[
          { label: 'Total en Carta', value: items.length },
          { label: 'Activos para Pedidos', value: activeCount },
          { label: 'Ticket Promedio', value: formatMoney(avgPrice) },
          { label: 'Recetas Costeadas', value: `${withRecipeCount} (${recipePercent}%)` },
          { label: 'Categorías', value: availableCategories.length - 1 },
        ]}
      />

      {/* ─── Quick Segment Pills (Cocina vs Bar vs Postres) ────────────────── */}
      <div className="menu-segments-bar">
        <button
          type="button"
          className={`menu-segment-btn ${segmentFilter === 'all' ? 'active' : ''}`}
          onClick={() => { setSegmentFilter('all'); setCategoryFilter('Todas'); }}
        >
          ✨ Toda la Carta <span className="menu-segment-badge">{items.length}</span>
        </button>
        <button
          type="button"
          className={`menu-segment-btn ${segmentFilter === 'kitchen' ? 'active' : ''}`}
          onClick={() => { setSegmentFilter('kitchen'); setCategoryFilter('Todas'); }}
        >
          👨‍🍳 Cocina & Platos <span className="menu-segment-badge">{kitchenCount}</span>
        </button>
        <button
          type="button"
          className={`menu-segment-btn ${segmentFilter === 'bar' ? 'active' : ''}`}
          onClick={() => { setSegmentFilter('bar'); setCategoryFilter('Todas'); }}
        >
          🍸 Bar & Coctelería <span className="menu-segment-badge">{barCount}</span>
        </button>
        <button
          type="button"
          className={`menu-segment-btn ${segmentFilter === 'dessert' ? 'active' : ''}`}
          onClick={() => { setSegmentFilter('dessert'); setCategoryFilter('Todas'); }}
        >
          🍰 Postres & Cafés <span className="menu-segment-badge">{dessertCount}</span>
        </button>
      </div>

      {/* ─── Detailed Category Filter Chips ─────────────────────────────────── */}
      <div className="menu-category-chips-wrapper">
        {availableCategories.map(cat => {
          const isSelected = categoryFilter === cat;
          const icon = cat === 'Todas' ? '✨' : getCategoryIcon(cat);
          const count = categoryStats[cat] || 0;

          return (
            <button
              key={cat}
              type="button"
              className={`menu-category-chip ${isSelected ? 'active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              <span>{icon}</span>
              <span>{cat}</span>
              <span className="menu-category-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Standard Filter Bar ────────────────────────────────────────────── */}
      <div className="filter-bar menu-surface-secondary69">
        <div className="menu-surface-secondary70">
          <label className="search-label menu-surface-secondary71">
            <Search size={16} />
            <input
              placeholder="Buscar por plato, bebida, ingrediente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <label className="menu-surface-secondary72">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="Todos">Todos los estados ({items.length})</option>
              <option value="Activos">Activos ({activeCount})</option>
              <option value="Desactivados">Desactivados ({archivedCount})</option>
            </select>
          </label>
          <label className="menu-surface-secondary73">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="recommended">Relevancia / Carta</option>
              <option value="price_desc">Precio: Mayor a Menor</option>
              <option value="price_asc">Precio: Menor a Mayor</option>
              <option value="name_asc">Nombre: A - Z</option>
              <option value="time_asc">Tiempo de Preparación</option>
            </select>
          </label>
        </div>

        <div className="menu-surface-secondary74">
          <div className="tabs">
            <button
              type="button"
              className={`menu-surface-secondary75 ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={16} /> Tarjetas
            </button>
            <button
              type="button"
              className={`menu-surface-secondary76 ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <List size={16} /> Lista
            </button>
          </div>
          <span className="filter-result">{processedItems.length} productos</span>
        </div>
      </div>

      {/* ─── Content Render: Grid vs Table ─────────────────────────────────── */}
      {processedItems.length === 0 ? (
        <EmptyState
          title="No se encontraron productos"
          description="No hay platos o bebidas que coincidan con los filtros seleccionados."
        />
      ) : viewMode === 'grid' ? (
        /* ─── GRID MODE ─────────────────────────────────────────────────────── */
        <div className="menu-surface-secondary77">
          {processedItems.map(item => {
            const isArchived = item.status === 'archived';
            const ingCount = item.ingredients?.length || 0;
            const icon = getCategoryIcon(item.category);
            const isBar = isBarCategory(item.category);
            const isDessert = isDessertCategory(item.category);

            // Check if any ingredient is out of stock
            const outOfStockIngs = (item.ingredients || []).filter(ing => {
              const inv = inventoryMap.get(ing.inventoryItemId);
              return inv && (Number(inv.stock) - Number(inv.reserved || 0)) <= 0;
            });
            const hasOutOfStock = outOfStockIngs.length > 0;

            return (
              <article
                key={item.id}
                className={`card operation-card menu-product-card menu-bordered ${isArchived ? 'archived' : isBar ? 'is-bar' : isDessert ? 'is-dessert' : 'is-kitchen'}`}
              >
                {/* Top of Card */}
                <div>
                  <div className="row-between menu-surface-secondary79">
                    <span className="menu-surface-secondary80">
                      <span>{icon}</span> {item.category || 'Carta'}
                    </span>

                    <div className="menu-surface-secondary81">
                      {hasOutOfStock && !isArchived && (
                        <span className="menu-card-stock-alert" title={`${outOfStockIngs.length} insumo(s) sin stock en almacén`}>
                          ⚠️ Insumo agotado
                        </span>
                      )}
                      <StatusBadge>{isArchived ? 'No disponible' : 'Disponible'}</StatusBadge>
                    </div>
                  </div>

                  <h3 className="menu-surface-secondary82">
                    {item.name}
                  </h3>

                  {item.description ? (
                    <p className="menu-surface-secondary83">
                      {item.description}
                    </p>
                  ) : (
                    <div className="menu-surface-secondary84" />
                  )}

                  {/* Metadata Chips & Financial Tags */}
                  <div className="menu-surface-secondary85">
                    <span className="menu-surface-secondary86">
                      <Clock size={13} color="var(--color-gold)" /> {item.preparationMinutes || 10} min
                    </span>

                    <span className="menu-surface-secondary87">
                      <ChefHat size={13} color="var(--color-gold)" /> {ingCount} {ingCount === 1 ? 'insumo' : 'insumos'} {isBar ? '(oz)' : ''}
                    </span>

                    {/* Cost / Profit Margin Badge */}
                    {item.costSummary && item.costSummary.grossMarginPercent > 0 && (
                      <span className="menu-surface-secondary88">
                        Margen {item.costSummary.grossMarginPercent}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom of Card: Price & Quick Actions */}
                <div className="menu-surface-secondary89">
                  <div className="menu-surface-secondary90">
                    <div className="menu-surface-secondary91">
                      Precio Carta
                    </div>
                    <div className="menu-surface-secondary92">
                      {formatMoney(item.salePrice)}
                    </div>
                  </div>

                  {/* Quick Action Buttons with Clear Labels */}
                  <div className="quick-actions-row menu-surface-secondary93">
                    <button
                      type="button"
                      className="quick-action-btn btn-action-view menu-surface-secondary94"
                      data-tooltip="Ver ficha técnica y escandallo"
                      aria-label="Ver ficha técnica"
                      onClick={() => setDetailItem(item)}
                    >
                      <Eye size={14} />
                      <span className="menu-surface-secondary95">Detalle</span>
                    </button>

                    <button
                      type="button"
                      className="quick-action-btn btn-action-edit menu-surface-secondary96"
                      data-tooltip="Modificar receta o precio"
                      aria-label="Modificar producto"
                      onClick={() => setEditItem(item)}
                    >
                      <Edit size={14} />
                      <span className="menu-surface-secondary97">Modificar</span>
                    </button>

                    <button
                      type="button"
                      className={`quick-action-btn menu-surface-secondary98 ${isArchived ? 'btn-action-unlock' : 'btn-action-lock'}`}
                      data-tooltip={isArchived ? 'Activar en carta y QR' : 'Desactivar de la carta'}
                      aria-label={isArchived ? 'Activar producto' : 'Desactivar producto'}
                      onClick={() => setToggleStatusItem(item)}
                    >
                      <Power size={14} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* ─── TABLE MODE (Lista Operativa) ─────────────────────────────────── */
        <section className="card table-container menu-surface-secondary99">
          <table className="custom-table">
            <caption>Directorio gastronómico de cocina y bar</caption>
            <thead>
              <tr>
                <th scope="col">Plato / Bebida</th>
                <th scope="col">Categoría</th>
                <th scope="col" className="menu-surface00">Precio Venta</th>
                <th scope="col" className="menu-surface01">Preparación</th>
                <th scope="col" className="menu-surface02">Insumos / Receta</th>
                <th scope="col" className="menu-surface03">Rentabilidad</th>
                <th scope="col" className="menu-surface04">Estado QR</th>
                <th scope="col" className="menu-surface05">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {processedItems.map(item => {
                const isArchived = item.status === 'archived';
                const ingCount = item.ingredients?.length || 0;
                const icon = getCategoryIcon(item.category);
                const isBar = isBarCategory(item.category);

                const outOfStockIngs = (item.ingredients || []).filter(ing => {
                  const inv = inventoryMap.get(ing.inventoryItemId);
                  return inv && (Number(inv.stock) - Number(inv.reserved || 0)) <= 0;
                });
                const hasOutOfStock = outOfStockIngs.length > 0;

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="menu-surface06">
                        <div className="menu-surface07">
                          {icon}
                        </div>
                        <div>
                          <strong className="menu-surface08">{item.name}</strong>
                          {hasOutOfStock && !isArchived && (
                            <span className="menu-surface09">
                              ⚠️ Insumos agotados en almacén
                            </span>
                          )}
                          {item.description && (
                            <div className="menu-surface10">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="menu-surface11">
                        {item.category || 'Carta'}
                      </span>
                    </td>
                    <td className="menu-surface12">
                      {formatMoney(item.salePrice)}
                    </td>
                    <td className="menu-surface13">
                      ⏱️ {item.preparationMinutes || 10} min
                    </td>
                    <td className="menu-surface14">
                      <span className="menu-surface15">
                        {ingCount} {ingCount === 1 ? 'insumo' : 'insumos'} {isBar ? '(oz)' : ''}
                      </span>
                    </td>
                    <td className="menu-surface16">
                      {item.costSummary && item.costSummary.grossMarginPercent > 0 ? (
                        <span className="menu-surface17">
                          {item.costSummary.grossMarginPercent}%
                        </span>
                      ) : (
                        <span className="menu-surface18">—</span>
                      )}
                    </td>
                    <td className="menu-surface19">
                      <StatusBadge>{isArchived ? 'No disponible' : 'Disponible'}</StatusBadge>
                    </td>
                    <td className="menu-surface20">
                      <div className="quick-actions-row menu-surface21">
                        <button
                          type="button"
                          className="quick-action-btn btn-action-view"
                          data-tooltip="Ver ficha técnica"
                          onClick={() => setDetailItem(item)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="quick-action-btn btn-action-edit"
                          data-tooltip="Modificar producto"
                          onClick={() => setEditItem(item)}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          className={`quick-action-btn ${isArchived ? 'btn-action-unlock' : 'btn-action-lock'}`}
                          data-tooltip={isArchived ? 'Activar en carta' : 'Desactivar de carta'}
                          onClick={() => setToggleStatusItem(item)}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ─── Modals ──────────────────────────────────────────────────────────── */}
      {/* 1. Modal Ficha Técnica y Receta */}
      {detailItem && (
        <MenuItemDetailModal
          item={detailItem}
          inventory={inventory}
          onClose={() => setDetailItem(null)}
          onEdit={(it) => setEditItem(it)}
          onToggleStatus={(it) => { setDetailItem(null); setToggleStatusItem(it); }}
        />
      )}

      {/* 2. Modal Agregar / Modificar Producto con Costeo en Vivo */}
      {editItem !== undefined && (
        <MenuItemFormModal
          item={editItem}
          onClose={() => setEditItem(undefined)}
          notify={notify}
        />
      )}

      {/* 3. Modal Desactivar / Activar */}
      {toggleStatusItem && (
        <StatusToggleModal
          item={toggleStatusItem}
          onClose={() => setToggleStatusItem(null)}
          notify={notify}
        />
      )}
    </div>
  );
}
