import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Utensils, ShoppingCart, X, Plus, Minus, AlertTriangle, Clock, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { getCustomerRestaurantActiveStays, getRestaurantMenu, getRestaurantOrders, createRestaurantOrder, cancelRestaurantOrder, getAmenitiesReservations } from '../api';
import { createCheckoutSubmitter, formatRoomServiceError, loadRoomServiceData, retainSelectedStay, startRoomServicePolling } from '../roomServiceData';
import './RoomServiceView.css';

const formatMoney = (amount) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(amount));

const ORDER_STATUS_LABELS = {
  'Pedido recibido': 'Recibido',
  'Confirmado': 'Preparación inminente',
  'En preparacion': 'En preparación',
  'Listo': 'Listo para envío',
  'Entregado': 'Entregado',
  'Pagado': 'Pagado',
  'Cancelado': 'Cancelado',
};

const ORDER_STATUS_CLASSES = {
  'Pedido recibido': 'status-recibido',
  'Confirmado': 'status-preparacion',
  'En preparacion': 'status-preparacion',
  'Listo': 'status-listo',
  'Entregado': 'status-entregado',
  'Pagado': 'status-entregado',
  'Cancelado': 'status-cancelado',
};

const RoomServiceView = () => {
  const { customer } = useAuth();
  const navigate = useNavigate();
  
  const [mainTab, setMainTab] = useState('Menu'); // 'Menu' or 'Mis Pedidos'
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [activeStays, setActiveStays] = useState([]);
  const [selectedStayId, setSelectedStayId] = useState('');
  const [activeAmenities, setActiveAmenities] = useState([]);
  const [selectedAmenityId, setSelectedAmenityId] = useState('');
  const [targetAccountType, setTargetAccountType] = useState('stay'); // 'stay' | 'amenity'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('Todos');
  
  // Persist Cart
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('parkplaza_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  
  // Checkout Options
  const [deliveryMethod, setDeliveryMethod] = useState('Room'); // Room, Terraza, Recojo, Piscina, Mirador
  const [orderComment, setOrderComment] = useState('');
  
  const [selectedVariants, setSelectedVariants] = useState({});
  const idempotencyKey = useRef(null);
  const checkoutSubmitter = useRef(createCheckoutSubmitter()).current;

  // Sync Cart to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('parkplaza_cart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  // Initial Load
  useEffect(() => {
    const fetchMenuAndOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        const [result, amenitiesData] = await Promise.all([
          loadRoomServiceData(customer, getRestaurantMenu, getRestaurantOrders, getCustomerRestaurantActiveStays),
          getAmenitiesReservations().catch(() => []),
        ]);
        setMenu(result.menu);
        setOrders(result.orders);
        setActiveStays(result.stays);
        
        const validAmenities = Array.isArray(amenitiesData)
          ? amenitiesData.filter((a) => a.status === 'confirmed' && a.paymentStatus !== 'paid')
          : [];
        setActiveAmenities(validAmenities);

        if (result.stays.length > 0) {
          setSelectedStayId(result.stays[0].id);
          setTargetAccountType('stay');
        } else if (validAmenities.length > 0) {
          setSelectedAmenityId(validAmenities[0].id);
          setTargetAccountType('amenity');
          setDeliveryMethod(validAmenities[0].amenityType === 'Piscina' ? 'Piscina' : 'Mirador');
        }

        if (result.menuError) setError(result.menuError.message || 'No se pudo cargar el menú.');
        if (result.ordersError) {
          setError(result.ordersError.message || 'No se pudo cargar el historial de pedidos.');
        }
        if (result.staysError) {
          setError(result.staysError.message || 'No se pudieron cargar las estadías activas.');
        }
      } catch (err) {
        setError(err.message || 'No se pudo cargar el menú. Intente nuevamente.');
      } finally {
        setLoading(false);
      }
    };
    fetchMenuAndOrders();
  }, [customer]);

  // Polling Orders when in 'Mis Pedidos'
  useEffect(() => {
    if (!customer || mainTab !== 'Mis Pedidos') return;
    return startRoomServicePolling(getRestaurantOrders, setOrders);
  }, [customer, mainTab]);

  const categories = useMemo(() => {
    const cats = new Set(menu.map(item => item.category));
    return ['Todos', ...Array.from(cats)].sort();
  }, [menu]);

  const filteredMenu = useMemo(() => {
    if (activeCategory === 'Todos') return menu;
    return menu.filter(item => item.category === activeCategory);
  }, [menu, activeCategory]);

  const handleVariantChange = (itemId, variantId) => {
    setSelectedVariants(prev => ({ ...prev, [itemId]: variantId }));
  };

  const getInitialVariant = (item) => {
    if (!item.variants || item.variants.length === 0) return null;
    return selectedVariants[item.id] || item.variants[0].id;
  };

  const addToCart = (item) => {
    if (!customer) {
      navigate('/login');
      return;
    }
    
    const variantId = getInitialVariant(item);
    const variant = variantId ? item.variants.find(v => v.id === variantId) : null;
    
    const price = variant ? Number(variant.price) : Number(item.salePrice);
    if (!price || price <= 0) return;
    
    const cartItemId = variantId ? `${item.id}-${variantId}` : item.id;
    
    setCart(prev => {
      const existing = prev.find(i => i.cartItemId === cartItemId);
      if (existing) {
        return prev.map(i => {
          if (i.cartItemId === cartItemId) {
            const newQ = i.quantity + 1;
            return { ...i, quantity: newQ <= item.maxAvailableQuantity ? newQ : i.quantity };
          }
          return i;
        });
      }
      return [...prev, {
        cartItemId,
        menuItemId: item.id,
        variantId,
        name: item.name,
        variantName: variant?.name,
        price,
        quantity: 1,
        maxQuantity: item.maxAvailableQuantity || 999
      }];
    });
    
    setIsCartOpen(true);
    setCheckoutSuccess(false);
  };

  const updateQuantity = (cartItemId, delta) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.cartItemId === cartItemId) {
          const newQ = item.quantity + delta;
          if (newQ > item.maxQuantity) return { ...item, quantity: item.maxQuantity };
          return newQ > 0 ? { ...item, quantity: newQ } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cart]);

  const cartItemsCount = useMemo(() => {
    return cart.reduce((count, item) => count + item.quantity, 0);
  }, [cart]);

  const handleCheckout = () => {
    if (!customer) return navigate('/login');
    if (cart.length === 0) return;
    const isAmenity = targetAccountType === 'amenity';
    const activeTargetId = isAmenity ? selectedAmenityId : selectedStayId;
    if (!activeTargetId) return;

    return checkoutSubmitter.run(async () => {
      setIsSubmitting(true);
      setCheckoutError(null);
      try {
        if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
        
        const payload = {
          stayId: isAmenity ? null : selectedStayId,
          amenityReservationId: isAmenity ? selectedAmenityId : null,
          deliveryMode: deliveryMethod,
          paymentMode: isAmenity ? 'amenity_tab' : 'room_charge',
          items: cart.map(item => ({
            menuItemId: item.menuItemId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          note: orderComment,
        };
        
        await createRestaurantOrder(payload, idempotencyKey.current);
        
        setCart([]);
        setCheckoutSuccess(true);
        setTimeout(() => {
          setIsCartOpen(false);
          setCheckoutSuccess(false);
          setMainTab('Mis Pedidos');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 2500);
        
        idempotencyKey.current = null;
        setOrderComment('');
        
        const ordersData = await getRestaurantOrders();
        setOrders(ordersData);
      } catch (err) {
        setCheckoutError(formatRoomServiceError(err, 'Hubo un error al procesar tu pedido. Inténtalo de nuevo.'));
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('¿Está seguro de cancelar este pedido?')) return;
    try {
      await cancelRestaurantOrder(orderId, 'changed_mind', crypto.randomUUID());
      const freshOrders = await getRestaurantOrders();
      setOrders(freshOrders);
    } catch (err) {
      alert(formatRoomServiceError(err, 'Error al cancelar el pedido.'));
    }
  };

  if (loading) {
    return (
      <div className="room-service-container loading-container">
        <span className="gold-spinner"></span>
      </div>
    );
  }

  return (
    <div className="room-service-container luxury-theme">
      {/* Hero */}
      <div className="room-service-hero">
        <div className="room-service-hero-content">
          <h1>Gastronomía de Autor</h1>
          <p>Experiencias culinarias excepcionales, llevadas a su puerta.</p>
        </div>
      </div>

      <div className="luxury-tabs-wrapper">
        <button className={`luxury-tab ${mainTab === 'Menu' ? 'active' : ''}`} onClick={() => setMainTab('Menu')}>
          Nuestra Carta
        </button>
        <button className={`luxury-tab ${mainTab === 'Mis Pedidos' ? 'active' : ''}`} onClick={() => setMainTab('Mis Pedidos')}>
          Mis Pedidos {orders.length > 0 && <span className="tab-badge">{orders.length}</span>}
        </button>
      </div>

      {mainTab === 'Mis Pedidos' && (
        <div className="orders-history-container fade-in">
          <div className="orders-tracker">
            <div className="orders-tracker-header">
              <Clock size={20} className="gold-icon" />
              <h2>Historial de Pedidos</h2>
            </div>
            {orders.length === 0 ? (
              <p className="no-orders-msg">Aún no ha realizado pedidos recientes.</p>
            ) : (
              <div className="orders-list">
                {orders.map(order => (
                  <div key={order.id} className="luxury-order-card">
                    <div className="order-tracker-info">
                      <div>
                        <h4 className="order-tracker-id">Ref: {order.id.split('-')[0].toUpperCase()}</h4>
                        <p className="order-tracker-date">{new Date(order.createdAt).toLocaleString('es-PE')}</p>
                      </div>
                      <span className={`order-tracker-status ${ORDER_STATUS_CLASSES[order.status] || ''}`}>
                        {ORDER_STATUS_LABELS[order.status] || order.status}
                      </span>
                    </div>
                    
                    <div className="order-tracker-meta">
                      {order.status !== 'Entregado' && order.status !== 'Pagado' && order.status !== 'Cancelado' && (
                        <div className="order-tracker-eta">
                          ETA Estimado: <strong>{order.estimatedMinutes} min</strong>
                        </div>
                      )}
                      <div className="order-tracker-total">Total: <strong>{formatMoney(order.total)}</strong></div>
                    </div>

                    <div className="order-items-preview">
                      {order.items?.map(i => (
                        <span key={i.id} className="order-item-pill">{i.quantity}x {i.name}</span>
                      ))}
                    </div>

                    {order.status === 'Pedido recibido' && (
                      <button className="luxury-btn-danger" onClick={() => handleCancelOrder(order.id)}>
                        Cancelar Pedido
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {mainTab === 'Menu' && (
        <>
          <div className="menu-category-tabs scroll-x">
            {categories.map(cat => (
              <button 
                key={cat} 
                className={activeCategory === cat ? 'active' : ''}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="menu-grid-container fade-in">
            {error && (
              <div className="alert-banner alert-banner-danger">
                <AlertTriangle size={18} />
                {error}
              </div>
            )}
            <div className="menu-items-grid">
                {filteredMenu.map(item => {
                  const hasVariants = item.variants && item.variants.length > 0;
                  const currentVariantId = getInitialVariant(item);
                  const currentVariant = currentVariantId ? item.variants.find(v => v.id === currentVariantId) : null;
                  const currentPrice = currentVariant ? currentVariant.price : item.salePrice;
                  
                  if (!currentPrice || Number(currentPrice) <= 0) return null;
                  const itemImg = item.imageUrl || (item.category.includes('Bebidas') ? `/dining.png` : `/hero.png`);
                  
                  return (
                    <div key={item.id} className={`menu-card glass-card ${item.stockAvailable === false ? 'out-of-stock' : ''}`}>
                      <div className="menu-card-img" style={{ backgroundImage: `url(${itemImg})` }}>
                        <div className="menu-card-price-tag">{formatMoney(currentPrice)}</div>
                        {item.stockAvailable === false && (
                          <div className="out-of-stock-overlay">
                            <span>Agotado</span>
                          </div>
                        )}
                      </div>
                      <div className="menu-card-body">
                        <h3 className="menu-card-title">{item.name}</h3>
                        <p className="menu-card-desc">{item.description || 'Exquisita preparación exclusiva.'}</p>
                        
                        <div className="menu-card-actions">
                          {hasVariants ? (
                            <select 
                              className="luxury-select"
                              value={currentVariantId || ''} 
                              onChange={(e) => handleVariantChange(item.id, e.target.value)}
                              disabled={item.stockAvailable === false}
                            >
                              {item.variants.map(v => (
                                <option key={v.id} value={v.id}>
                                  {v.name} (+{formatMoney(v.price)})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div style={{ flex: 1 }}></div>
                          )}
                          
                          <button 
                            className="menu-add-btn gold-btn" 
                            onClick={() => addToCart(item)}
                            title="Agregar al pedido"
                            disabled={item.stockAvailable === false}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </>
      )}

      {cartItemsCount > 0 && (
        <button className="floating-cart-btn pulse-glow" onClick={() => setIsCartOpen(true)}>
          <ShoppingCart size={20} />
          <span>Ver Mi Orden</span>
          <div className="cart-badge">{cartItemsCount}</div>
        </button>
      )}

      {isCartOpen && (
        <div className="cart-drawer-overlay fade-in" onClick={(e) => e.target === e.currentTarget && setIsCartOpen(false)}>
          <div className="cart-drawer luxury-drawer slide-in-right">
            {checkoutSuccess ? (
              <div className="cart-success-view fade-in">
                <div className="success-icon-wrap"><Check size={48} /></div>
                <h2>Pedido Confirmado</h2>
                <p>El restaurante ha recibido tu pedido. El total oficial devuelto por el sistema es el mostrado en tu historial.</p>
              </div>
            ) : (
              <>
                <div className="cart-header">
                  <h2><Utensils size={20} className="gold-icon" /> Mi Orden</h2>
                  <button className="close-cart-btn" onClick={() => setIsCartOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
                
                <div className="cart-items">
                  {cart.length === 0 ? (
                    <div className="cart-empty">
                      <ShoppingCart size={48} opacity={0.3} />
                      <p>Su orden está vacía.</p>
                    </div>
                  ) : (
                    cart.map(item => (
                      <div key={item.cartItemId} className="cart-item">
                        <div className="cart-item-info">
                          <div className="cart-item-name">{item.name}</div>
                          {item.variantName && <div className="cart-item-variant">{item.variantName}</div>}
                          <div className="cart-item-price">{formatMoney(item.price * item.quantity)}</div>
                        </div>
                        <div className="cart-item-actions">
                          <button onClick={() => updateQuantity(item.cartItemId, -1)}><Minus size={14} /></button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.cartItemId, 1)}><Plus size={14} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {cart.length > 0 && (
                  <div className="cart-footer">
                    {checkoutError && (
                      <div className="alert-banner alert-banner-danger">
                        <AlertTriangle size={16} />
                        {checkoutError}
                      </div>
                    )}

                    <div className="checkout-options">
                      <label>Cargar pedido a:</label>
                      <select 
                        className="luxury-select full-width" 
                        value={targetAccountType === 'stay' ? `stay:${selectedStayId}` : `amenity:${selectedAmenityId}`}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('stay:')) {
                            const id = val.replace('stay:', '');
                            setTargetAccountType('stay');
                            setSelectedStayId(id);
                            setDeliveryMethod('Room');
                          } else if (val.startsWith('amenity:')) {
                            const id = val.replace('amenity:', '');
                            setTargetAccountType('amenity');
                            setSelectedAmenityId(id);
                            const amen = activeAmenities.find((a) => a.id === id);
                            setDeliveryMethod(amen?.amenityType === 'Piscina' ? 'Piscina' : 'Mirador');
                          }
                        }}
                      >
                        {activeStays.length === 0 && activeAmenities.length === 0 && (
                          <option value="">Sin estadía ni reserva activa de zona</option>
                        )}
                        {activeStays.length > 0 && (
                          <optgroup label="Estadías de Habitación">
                            {activeStays.map((stay) => (
                              <option key={stay.id} value={`stay:${stay.id}`}>
                                Habitación {stay.roomNumber} (Cargo a folio)
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {activeAmenities.length > 0 && (
                          <optgroup label="Zonas y Amenidades (Cuenta Temporal)">
                            {activeAmenities.map((amenity) => (
                              <option key={amenity.id} value={`amenity:${amenity.id}`}>
                                {amenity.amenityType} · DNI {amenity.documentNumber || 'Registrado'} (Pagar al salir)
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>

                      <label>Modalidad de Entrega:</label>
                      <select className="luxury-select full-width" value={deliveryMethod} onChange={(e) => setDeliveryMethod(e.target.value)}>
                        {targetAccountType === 'stay' ? (
                          <>
                            <option value="Room">Llevar a Habitación</option>
                            <option value="Terraza">Llevar a Terraza</option>
                            <option value="Recojo">Recojo en Barra</option>
                          </>
                        ) : (
                          <>
                            <option value={activeAmenities.find((a) => a.id === selectedAmenityId)?.amenityType || 'Piscina'}>
                              Llevar a {activeAmenities.find((a) => a.id === selectedAmenityId)?.amenityType || 'Zona Reservada'}
                            </option>
                            <option value="Recojo">Recojo en Barra</option>
                            <option value="Terraza">Llevar a Terraza</option>
                          </>
                        )}
                      </select>
                      
                      <label>Método de Pago:</label>
                      <input 
                        className="luxury-input full-width" 
                        readOnly 
                        value={targetAccountType === 'stay' ? 'Cargo a Folio de Habitación' : 'Cuenta Temporal de Amenidad (Liquidación en recepción)'} 
                        style={{ opacity: 0.85, background: 'rgba(255,255,255,0.05)', fontSize: '13px' }} 
                      />

                      <input 
                        className="luxury-input full-width" 
                        placeholder="Notas para cocina o barra (ej. sin hielo, salsas aparte)"
                        value={orderComment}
                        onChange={(e) => setOrderComment(e.target.value)}
                        maxLength={400}
                      />
                    </div>
                    
                    <div className="cart-summary-total">
                      <span>Total Estimado</span>
                      <span className="gold-text">{formatMoney(cartTotal)}</span>
                    </div>
                    
                    <button 
                      className="checkout-btn gold-btn-solid" 
                      onClick={handleCheckout}
                      disabled={isSubmitting || (targetAccountType === 'stay' ? !selectedStayId : !selectedAmenityId)}
                    >
                      {isSubmitting ? (
                        <><span className="gold-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> Confirmando...</>
                      ) : (
                        <>Procesar Orden <ChevronRight size={18} /></>
                      )}
                    </button>
                    <p className="cart-footer-note">
                      El monto final exacto se calculará en el servidor y aparecerá en su historial.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomServiceView;
