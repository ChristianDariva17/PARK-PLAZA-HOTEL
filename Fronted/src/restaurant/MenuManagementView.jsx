import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  RefreshCw,
  Eye,
  Edit,
  Power,
  UtensilsCrossed,
  Clock,
  ChefHat,
  X,
  Check,
  AlertCircle,
  LayoutGrid,
  List,
  Package,
  Sparkles,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Layers,
  Tag,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';
import { useHotel } from '../state/hotelContext.js';
import { useAuth } from '../auth/authContext.js';
import { hasKitchenManagementAccess } from '../auth/permissions.js';
import { Dialog } from '../components/ui/Overlay.jsx';
import { PageHeader, MetricStrip, StatusBadge, EmptyState } from '../components/views/SharedViewParts.jsx';

// ─── Categories & Icon Helper ──────────────────────────────────────────────────
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

export const isBarCategory = (category = '') => {
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

export const isDessertCategory = (category = '') => {
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

export const CULINARY_TAG_PRESETS = [
  { id: 'especialidad', label: '⭐ Especialidad 5★' },
  { id: 'chef', label: '👨‍🍳 Recomendado del Chef' },
  { id: 'autor', label: '🍸 Cóctel de Autor' },
  { id: 'vegano', label: '🌱 Vegetariano / Vegano' },
  { id: 'glutenfree', label: '🌾 Sin Gluten' },
  { id: 'picante', label: '🌶️ Toque Picante' },
];

export function convertIngredientToInventoryUnit(quantity, fromUnit, toUnit) {
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

export const getCategoryIcon = (category = '') => {
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

export const UNIT_OPTIONS = [
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
        <div className="room-hero-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: 'var(--color-navy)',
              border: '1px solid var(--color-gold-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              boxShadow: 'var(--shadow-sm)'
            }}>
              {categoryIcon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="room-hero-category" style={{ fontSize: 11 }}>
                  {item.category || 'General'}
                </span>
                <StatusBadge>{isArchived ? 'No disponible' : 'Disponible'}</StatusBadge>
                {isBar && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: 'rgba(212, 175, 55, 0.2)',
                    color: 'var(--color-gold)',
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    🍸 Receta en Onzas
                  </span>
                )}
              </div>
              <h2 className="room-hero-number" style={{ fontSize: 22, margin: 0 }}>
                {item.name}
              </h2>
              {item.description && (
                <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1.4 }}>
                  {item.description}
                </p>
              )}
            </div>
          </div>
          <div className="room-hero-price">
            <span className="room-hero-price-label">Precio Carta</span>
            <span className="room-hero-price-amount" style={{ fontSize: 26 }}>
              {formatMoney(item.salePrice)}
            </span>
            <span className="room-hero-price-period">
              ⏱️ {item.preparationMinutes || 10} min preparación
            </span>
          </div>
        </div>

        {/* 4-Spec Operational Grid */}
        <div className="drawer-specs-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
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
          <div className="drawer-section-card" style={{ background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(15, 60, 44, 0.04))', border: '1px solid rgba(212, 175, 55, 0.25)' }}>
            <div className="drawer-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
                💎 Rentabilidad y Escandallo de Costos
              </span>
              <span style={{
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 800,
                background: item.costSummary.grossMarginPercent >= 60 ? 'rgba(34, 197, 94, 0.15)' : item.costSummary.grossMarginPercent >= 40 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: item.costSummary.grossMarginPercent >= 60 ? '#15803d' : item.costSummary.grossMarginPercent >= 40 ? '#b45309' : '#b91c1c',
                border: `1px solid ${item.costSummary.grossMarginPercent >= 60 ? '#86efac' : item.costSummary.grossMarginPercent >= 40 ? '#fde047' : '#fca5a5'}`
              }}>
                Margen Bruto: {item.costSummary.grossMarginPercent}%
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ background: 'var(--color-surface)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 600 }}>Costo de Insumos</span>
                <strong style={{ fontSize: 15, color: 'var(--color-text)', fontWeight: 800 }}>S/ {item.costSummary.recipeCost.toFixed(2)}</strong>
              </div>
              <div style={{ background: 'var(--color-surface)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 600 }}>Precio de Venta</span>
                <strong style={{ fontSize: 15, color: 'var(--color-navy)', fontWeight: 800 }}>S/ {Number(item.salePrice || 0).toFixed(2)}</strong>
              </div>
              <div style={{ background: 'var(--color-surface)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 600 }}>Ganancia por Unidad</span>
                <strong style={{ fontSize: 15, color: '#15803d', fontWeight: 800 }}>S/ {item.costSummary.profitPerUnit.toFixed(2)}</strong>
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
            <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 13, fontStyle: 'italic' }}>
              Este producto no tiene insumos de almacén vinculados. Se procesa como producto directo de carta.
            </p>
          ) : (
            <div className="table-container" style={{ margin: 0, border: '1px solid var(--color-border)' }}>
              <table className="custom-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Insumo de Almacén</th>
                    <th style={{ textAlign: 'right' }}>Dosificación (Receta)</th>
                    <th>Detalle / Especificación</th>
                    <th style={{ textAlign: 'right' }}>Stock Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {item.ingredients.map((ing, idx) => {
                    const inv = inventory.find(i => i.id === ing.inventoryItemId);
                    const stock = inv ? Number(inv.stock) - Number(inv.reserved || 0) : null;
                    const isLowStock = stock !== null && stock < (Number(ing.quantity) * 5);
                    const isOutOfStock = stock !== null && stock <= 0;
                    const isOz = (ing.unit || '').toLowerCase() === 'oz';

                    return (
                      <tr key={idx}>
                        <td>
                          <strong>📦 {inv?.name || ing.inventoryItemId || 'Insumo'}</strong>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            padding: '3px 9px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 800,
                            background: isOz ? 'rgba(212, 175, 55, 0.15)' : 'var(--color-surface-soft)',
                            color: isOz ? 'var(--color-navy)' : 'var(--color-navy)',
                            border: isOz ? '1px solid var(--color-gold-soft)' : '1px solid var(--color-border)'
                          }}>
                            {ing.quantity} {ing.unit || inv?.unit || 'und'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-muted)', fontSize: 12.5 }}>
                          {ing.detail ? (
                            <span>✨ {ing.detail}</span>
                          ) : (
                            <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>Estándar</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {stock !== null ? (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: isOutOfStock ? 'var(--color-danger-soft)' : isLowStock ? 'var(--color-warning-soft)' : 'var(--color-success-soft)',
                              color: isOutOfStock ? 'var(--color-danger)' : isLowStock ? '#b45309' : 'var(--color-success)'
                            }}>
                              {stock} {inv?.unit} {isOutOfStock ? '(Agotado)' : isLowStock ? '(Bajo)' : '(OK)'}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-muted)' }}>—</span>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            onClick={() => onToggleStatus(item)}
            className={`btn btn-outline ${isArchived ? '' : 'btn-danger'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Power size={15} /> {isArchived ? 'Activar en Carta' : 'Desactivar de Carta'}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { onClose(); onEdit(item); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
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
        <div style={{
          background: 'linear-gradient(135deg, var(--color-navy, #0f2942) 0%, #1e3a5f 100%)',
          borderRadius: 12,
          padding: '16px 20px',
          border: '1px solid rgba(212, 175, 55, 0.4)',
          boxShadow: '0 4px 20px rgba(15, 41, 66, 0.25)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(212, 175, 55, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              {getCategoryIcon(form.category)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--color-gold, #c59d5f)'
                }}>
                  {form.category}
                </span>
                {isCurrentBar ? (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'rgba(212, 175, 55, 0.2)',
                    color: '#fef08a',
                    padding: '2px 8px',
                    borderRadius: 10,
                    border: '1px solid rgba(212, 175, 55, 0.4)'
                  }}>
                    🍸 Dosificación Bar (oz)
                  </span>
                ) : (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#e2e8f0',
                    padding: '2px 8px',
                    borderRadius: 10
                  }}>
                    👨‍🍳 Cocina Hotelera
                  </span>
                )}
                {form.tags.map(t => (
                  <span key={t} style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: 10
                  }}>
                    {t}
                  </span>
                ))}
              </div>
              <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                {form.name.trim() || 'Nombre del Plato o Cóctel'}
              </h4>
            </div>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--color-gold, #c59d5f)', letterSpacing: '-0.02em' }}>
              {salePriceNum > 0 ? formatMoney(salePriceNum) : 'S/ 0.00'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                ⏱️ {form.preparationMinutes || 10} min
              </span>
              {calculatedCost > 0 && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 6,
                  background: grossMarginPercent >= 60 ? 'rgba(34, 197, 94, 0.25)' : grossMarginPercent >= 40 ? 'rgba(234, 179, 8, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                  color: grossMarginPercent >= 60 ? '#86efac' : grossMarginPercent >= 40 ? '#fde047' : '#fca5a5',
                  border: `1px solid ${grossMarginPercent >= 60 ? 'rgba(134, 239, 172, 0.4)' : 'rgba(253, 224, 71, 0.4)'}`
                }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-grid">
              <label>
                Nombre Oficial del Plato o Bebida *
                <input
                  required
                  placeholder="Ej: Lomo Saltado Especial, Pisco Sour Catedral..."
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  disabled={saving}
                  style={{ fontSize: 14, fontWeight: 600 }}
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
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
                    required
                    placeholder="25.00"
                    value={form.salePrice}
                    onChange={e => setForm({ ...form, salePrice: e.target.value })}
                    disabled={saving}
                    style={{ fontSize: 15, fontWeight: 700, paddingLeft: '32px' }}
                  />
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--color-navy)' }}>
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
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-body)', display: 'block', marginBottom: 6 }}>
                Distintivos y Etiquetas Culinarias:
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Live Financial Metrics Banner */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.08), rgba(15, 60, 44, 0.04))',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: 10,
              padding: '12px 16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 12,
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 600 }}>Costo de Insumos</span>
                <strong style={{ fontSize: 16, color: 'var(--color-text)', fontWeight: 800 }}>
                  S/ {calculatedCost.toFixed(2)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 600 }}>Precio de Venta</span>
                <strong style={{ fontSize: 16, color: 'var(--color-navy)', fontWeight: 800 }}>
                  S/ {salePriceNum.toFixed(2)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 600 }}>Ganancia por Unidad</span>
                <strong style={{ fontSize: 16, color: profitPerUnit > 0 ? '#15803d' : 'var(--color-muted)', fontWeight: 800 }}>
                  S/ {profitPerUnit.toFixed(2)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', fontWeight: 600 }}>Margen Bruto</span>
                <span style={{
                  display: 'inline-block',
                  marginTop: 2,
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  background: grossMarginPercent >= 60 ? 'rgba(34, 197, 94, 0.15)' : grossMarginPercent >= 40 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: grossMarginPercent >= 60 ? '#15803d' : grossMarginPercent >= 40 ? '#b45309' : '#b91c1c',
                  border: `1px solid ${grossMarginPercent >= 60 ? '#86efac' : grossMarginPercent >= 40 ? '#fde047' : '#fca5a5'}`
                }}>
                  {grossMarginPercent}% {grossMarginPercent >= 60 ? '🌟 Óptimo' : grossMarginPercent >= 40 ? '⚠️ Regular' : '🔴 Bajo'}
                </span>
              </div>
            </div>

            {/* Ingredients Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-navy)' }}>
                  {isCurrentBar ? '🍸 Insumos de Barra y Coctelería (Onzas)' : '👨‍🍳 Insumos de Cocina y Almacén'}
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
                  {isCurrentBar
                    ? 'Dosifica licores en onzas (oz) o mililitros para rebaja automática de botellas.'
                    : 'Registra ingredientes en gramos, kilos o unidades para control automático de mermas.'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={addIngredient}
                disabled={saving || activeInventory.length === 0}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={14} /> Agregar {isCurrentBar ? 'Licor / Insumo' : 'Insumo'}
              </button>
            </div>

            {/* Ingredients List */}
            {form.ingredients.length === 0 ? (
              <div style={{
                background: 'var(--color-surface-soft)',
                border: '1px dashed var(--color-border)',
                borderRadius: 8,
                padding: '24px',
                textAlign: 'center'
              }}>
                <ChefHat size={32} color="var(--color-muted)" style={{ margin: '0 auto 8px', display: 'block' }} />
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)', fontWeight: 600 }}>
                  No has agregado insumos a esta receta.
                </p>
                <p style={{ margin: '4px 0 12px', fontSize: 12, color: 'var(--color-muted)' }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                          style={{ fontSize: 12.5, width: '100%' }}
                        >
                          {activeInventory.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.unit}) · Disp: {item.stock}
                            </option>
                          ))}
                        </select>
                        {isOutOfStock && (
                          <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, display: 'block', marginTop: 2 }}>
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
                          style={{ fontSize: 12.5, textAlign: 'right', fontWeight: 700 }}
                        />
                      </div>

                      {/* 3. Unit Selector */}
                      <div>
                        <select
                          value={ing.unit || (isCurrentBar ? 'oz' : 'und')}
                          onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                          disabled={saving}
                          style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-navy)' }}
                        >
                          {UNIT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.icon} {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* 4. Specification Detail & Subtotal */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Detalle (ej: Pisco 42°, Colado...)"
                          value={ing.detail || ''}
                          onChange={e => updateIngredient(idx, 'detail', e.target.value)}
                          disabled={saving}
                          style={{ fontSize: 12, flex: 1 }}
                        />
                        {lineCost > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                            S/ {lineCost.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* 5. Delete Button */}
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => removeIngredient(idx)}
                        disabled={saving}
                        style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              background: 'var(--color-surface-soft)',
              padding: '16px',
              borderRadius: 10,
              border: '1px solid var(--color-border)'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={e => setForm({ ...form, isPublished: e.target.checked })}
                  disabled={saving}
                  style={{ width: 18, height: 18 }}
                />
                <div>
                  <strong style={{ fontSize: 13.5, color: 'var(--color-text)', display: 'block' }}>
                    Visible en Carta Digital y Códigos QR de Huéspedes
                  </strong>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            {activeTab === 'info' && 'Paso 1: Completa los datos comerciales y de carta.'}
            {activeTab === 'recipe' && `Paso 2: ${form.ingredients.length} insumo(s) costeados en tiempo real.`}
            {activeTab === 'service' && 'Paso 3: Configura la disponibilidad en carta QR.'}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
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
              className="btn btn-primary"
              style={{
                padding: '10px 24px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}
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
        <p style={{ margin: 0, color: 'var(--color-body)', fontSize: 14, lineHeight: 1.5 }}>
          {isArchived ? (
            <>¿Deseas reactivar <strong>{item.name}</strong>? Volverá a aparecer en la carta para pedidos de habitaciones, barra y terraza.</>
          ) : (
            <>¿Deseas desactivar <strong>{item.name}</strong>? Se ocultará de la carta digital de huéspedes y comandas. Los pedidos históricos se mantendrán auditados.</>
          )}
        </p>

        {!isArchived && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-muted)' }}>
            Motivo de desactivación
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              disabled={processing}
            />
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={processing}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={processing}
            className={isArchived ? 'btn btn-primary' : 'btn btn-danger'}
            style={{
              padding: '10px 20px',
              fontWeight: 700,
              cursor: processing ? 'not-allowed' : 'pointer'
            }}
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

  const items = state.managedMenu || [];
  const inventory = state.inventory || [];
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(15, 41, 66, 0.2)'
              }}
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
      <div className="filter-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '280px' }}>
          <label className="search-label" style={{ flex: '1' }}>
            <Search size={16} />
            <input
              placeholder="Buscar por plato, bebida, ingrediente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </label>
          <label style={{ margin: 0 }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="Todos">Todos los estados ({items.length})</option>
              <option value="Activos">Activos ({activeCount})</option>
              <option value="Desactivados">Desactivados ({archivedCount})</option>
            </select>
          </label>
          <label style={{ margin: 0 }}>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="recommended">Relevancia / Carta</option>
              <option value="price_desc">Precio: Mayor a Menor</option>
              <option value="price_asc">Precio: Menor a Mayor</option>
              <option value="name_asc">Nombre: A - Z</option>
              <option value="time_asc">Tiempo de Preparación</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="tabs">
            <button
              type="button"
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LayoutGrid size={16} /> Tarjetas
            </button>
            <button
              type="button"
              className={viewMode === 'table' ? 'active' : ''}
              onClick={() => setViewMode('table')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 18
        }}>
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
                className={`card operation-card menu-product-card ${isArchived ? 'archived' : ''}`}
                style={{
                  padding: '20px',
                  borderRadius: '14px',
                  borderLeft: isArchived
                    ? '4px solid #cbd5e1'
                    : isBar
                    ? '4px solid var(--color-gold, #c59d5f)'
                    : isDessert
                    ? '4px solid #f472b6'
                    : '4px solid #10b981'
                }}
              >
                {/* Top of Card */}
                <div>
                  <div className="row-between" style={{ marginBottom: 10, alignItems: 'center' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--color-surface-soft)',
                      color: 'var(--color-navy)',
                      padding: '4px 10px',
                      borderRadius: 20,
                      fontSize: 11.5,
                      fontWeight: 700,
                      border: '1px solid var(--color-border)'
                    }}>
                      <span>{icon}</span> {item.category || 'Carta'}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {hasOutOfStock && !isArchived && (
                        <span className="menu-card-stock-alert" title={`${outOfStockIngs.length} insumo(s) sin stock en almacén`}>
                          ⚠️ Insumo agotado
                        </span>
                      )}
                      <StatusBadge>{isArchived ? 'No disponible' : 'Disponible'}</StatusBadge>
                    </div>
                  </div>

                  <h3 style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    margin: '0 0 6px',
                    lineHeight: 1.3
                  }}>
                    {item.name}
                  </h3>

                  {item.description ? (
                    <p style={{
                      fontSize: 13,
                      color: 'var(--color-muted)',
                      margin: '0 0 12px',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {item.description}
                    </p>
                  ) : (
                    <div style={{ height: 8 }} />
                  )}

                  {/* Metadata Chips & Financial Tags */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-muted)', marginBottom: 12 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'var(--color-surface-soft)',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontWeight: 500
                    }}>
                      <Clock size={13} color="var(--color-gold)" /> {item.preparationMinutes || 10} min
                    </span>

                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: isBar ? 'rgba(212, 175, 55, 0.1)' : 'var(--color-surface-soft)',
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontWeight: 600,
                      color: isBar ? 'var(--color-navy)' : 'var(--color-muted)',
                      border: isBar ? '1px solid var(--color-gold-soft)' : 'none'
                    }}>
                      <ChefHat size={13} color="var(--color-gold)" /> {ingCount} {ingCount === 1 ? 'insumo' : 'insumos'} {isBar ? '(oz)' : ''}
                    </span>

                    {/* Cost / Profit Margin Badge */}
                    {item.costSummary && item.costSummary.grossMarginPercent > 0 && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: item.costSummary.grossMarginPercent >= 60 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                        color: item.costSummary.grossMarginPercent >= 60 ? '#15803d' : '#b45309',
                        border: `1px solid ${item.costSummary.grossMarginPercent >= 60 ? 'rgba(134, 239, 172, 0.6)' : 'rgba(253, 224, 71, 0.6)'}`
                      }}>
                        Margen {item.costSummary.grossMarginPercent}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom of Card: Price & Quick Actions */}
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Precio Carta
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--color-navy)' }}>
                      {formatMoney(item.salePrice)}
                    </div>
                  </div>

                  {/* Quick Action Buttons with Clear Labels */}
                  <div className="quick-actions-row" style={{ width: '100%', justifyContent: 'space-between', gap: 6 }}>
                    <button
                      type="button"
                      className="quick-action-btn btn-action-view"
                      data-tooltip="Ver ficha técnica y escandallo"
                      aria-label="Ver ficha técnica"
                      style={{ flex: 1, padding: '7px 10px', gap: 6, justifyContent: 'center' }}
                      onClick={() => setDetailItem(item)}
                    >
                      <Eye size={14} />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>Detalle</span>
                    </button>

                    <button
                      type="button"
                      className="quick-action-btn btn-action-edit"
                      data-tooltip="Modificar receta o precio"
                      aria-label="Modificar producto"
                      style={{ flex: 1, padding: '7px 10px', gap: 6, justifyContent: 'center' }}
                      onClick={() => setEditItem(item)}
                    >
                      <Edit size={14} />
                      <span style={{ fontSize: 12, fontWeight: 700 }}>Modificar</span>
                    </button>

                    <button
                      type="button"
                      className={`quick-action-btn ${isArchived ? 'btn-action-unlock' : 'btn-action-lock'}`}
                      data-tooltip={isArchived ? 'Activar en carta y QR' : 'Desactivar de la carta'}
                      aria-label={isArchived ? 'Activar producto' : 'Desactivar producto'}
                      style={{ width: 38, padding: 0, justifyContent: 'center' }}
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
        <section className="card table-container" style={{ padding: 0 }}>
          <table className="custom-table">
            <caption>Directorio gastronómico de cocina y bar</caption>
            <thead>
              <tr>
                <th scope="col">Plato / Bebida</th>
                <th scope="col">Categoría</th>
                <th scope="col" style={{ textAlign: 'right' }}>Precio Venta</th>
                <th scope="col" style={{ textAlign: 'center' }}>Preparación</th>
                <th scope="col" style={{ textAlign: 'center' }}>Insumos / Receta</th>
                <th scope="col" style={{ textAlign: 'center' }}>Rentabilidad</th>
                <th scope="col" style={{ textAlign: 'center' }}>Estado QR</th>
                <th scope="col" style={{ textAlign: 'center' }}>Acciones</th>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background: 'var(--color-navy)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                          border: '1px solid var(--color-gold-soft)'
                        }}>
                          {icon}
                        </div>
                        <div>
                          <strong style={{ color: 'var(--color-text)', fontSize: 13.5 }}>{item.name}</strong>
                          {hasOutOfStock && !isArchived && (
                            <span style={{ display: 'block', fontSize: 10.5, color: '#dc2626', fontWeight: 700 }}>
                              ⚠️ Insumos agotados en almacén
                            </span>
                          )}
                          {item.description && (
                            <div style={{ fontSize: 11.5, color: 'var(--color-muted)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ padding: '2px 8px', borderRadius: 6, background: 'var(--color-surface-soft)', fontSize: 12, fontWeight: 600, color: 'var(--color-navy)' }}>
                        {item.category || 'Carta'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-navy)', fontSize: 14.5 }}>
                      {formatMoney(item.salePrice)}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 12.5 }}>
                      ⏱️ {item.preparationMinutes || 10} min
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background: ingCount > 0 ? (isBar ? 'rgba(212, 175, 55, 0.2)' : 'var(--color-gold-soft)') : 'var(--color-surface-soft)',
                        color: 'var(--color-navy)'
                      }}>
                        {ingCount} {ingCount === 1 ? 'insumo' : 'insumos'} {isBar ? '(oz)' : ''}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.costSummary && item.costSummary.grossMarginPercent > 0 ? (
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 800,
                          background: item.costSummary.grossMarginPercent >= 60 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                          color: item.costSummary.grossMarginPercent >= 60 ? '#15803d' : '#b45309'
                        }}>
                          {item.costSummary.grossMarginPercent}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <StatusBadge>{isArchived ? 'No disponible' : 'Disponible'}</StatusBadge>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="quick-actions-row" style={{ justifyContent: 'center' }}>
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
