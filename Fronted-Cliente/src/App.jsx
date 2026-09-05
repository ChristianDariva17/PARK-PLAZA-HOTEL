import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Phone, CheckCircle2, X, LogIn, LogOut, Menu, Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, AlertTriangle, ChevronRight, Copy, Check, Bed, MapPin, User, Search, Calendar } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { createBooking, getAvailability, getCustomerRoomAmenities, createAmenityReservation, getAmenityConfigs } from './api';
import { useCustomerSocket } from './hooks/useCustomerSocket.js';
import HeroCarousel from './components/HeroCarousel';
import RoomsAccordion from './components/RoomsAccordion';
import AmenityView from './components/AmenityView';
import EventBookingModal from './components/EventBookingModal';
import Background3D from './components/Background3D';
import RoomServiceView from './components/RoomServiceView';
import { CUSTOMER_ROUTES, isCustomerContractAdmitted } from './contractAdmission.js';
import './index.css';

const CLIENT_AMENITY_LABELS = {
  wifi_high_speed: '📶 WiFi 6',
  smart_tv_4k: '📺 Smart TV 55" 4K',
  smart_ac: '❄️ Climatización',
  spanish_shower: '🚿 Ducha Española',
  luxury_amenities: '🧴 Amenities 5★',
  jacuzzi_tub: '🛁 Jacuzzi Privado',
  panoramic_balcony: '🌅 Balcón Panorámico',
  nespresso_minibar: '☕ Nespresso & Bar',
  digital_safe: '🔐 Caja Fuerte',
  room_service_24_7: '🛎️ Room Service 24/7',
  executive_desk: '💼 Escritorio',
  soundproof_windows: '🔇 Aislamiento Acústico',
  bathrobe_slippers: '🥋 Batas de Lujo',
  king_bed: '👑 Cama King Size',
};

const CLIENT_EXTRA_SERVICES = [
  { id: 'breakfast', name: 'Desayuno Buffet Ejecutivo', icon: '🥐', price: 35, type: 'per_night', desc: 'Acceso diario al restaurante gourmet' },
  { id: 'parking', name: 'Estacionamiento Privado Techado', icon: '🚗', price: 25, type: 'per_night', desc: 'Espacio exclusivo con vigilancia 24/7' },
  { id: 'late_checkout', name: 'Late Check-out (hasta 17:00)', icon: '⏰', price: 60, type: 'fixed', desc: 'Salida extendida garantizada' },
];

const ROOM_MARKETING = {
  SIMPLE: { title: 'Habitación Simple', desc: 'Confort sereno y funcional para una estadía individual.', img: '/community.png' },
  MATRIMONIAL: { title: 'Habitación Matrimonial', desc: 'Un refugio cálido para dos, con detalles elegantes y descanso premium.', img: '/dining.png' },
  DOBLE: { title: 'Habitación Doble', desc: 'Dos camas y espacio equilibrado para compartir la experiencia Park Plaza.', img: '/spa.png' },
  TRIPLE: { title: 'Habitación Triple', desc: 'Comodidad flexible para familias o grupos pequeños.', img: '/community.png' },
  SUITE: { title: 'Suite Park Plaza', desc: 'Nuestra categoría más amplia, con ambientes exclusivos y atención refinada.', img: '/hero.png' },
};

const COUNTRY_OPTIONS = [
  ['PE', 'Perú'], ['AR', 'Argentina'], ['BO', 'Bolivia'], ['BR', 'Brasil'], ['CA', 'Canadá'],
  ['CL', 'Chile'], ['CN', 'China'], ['CO', 'Colombia'], ['DE', 'Alemania'], ['EC', 'Ecuador'],
  ['ES', 'España'], ['FR', 'Francia'], ['GB', 'Reino Unido'], ['IT', 'Italia'], ['JP', 'Japón'],
  ['MX', 'México'], ['PY', 'Paraguay'], ['US', 'Estados Unidos'], ['UY', 'Uruguay'], ['VE', 'Venezuela'],
];

const formatMoney = (amount, currency = 'PEN') => {
  const validCurrency = (currency && typeof currency === 'string') ? currency.toUpperCase() : 'PEN';
  try {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: validCurrency }).format(Number(amount || 0));
  } catch {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(amount || 0));
  }
};

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { currentUser, customer, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const isSolid = scrolled || location.pathname !== '/';

  return (
    <nav className={`top-navbar ${isSolid ? 'scrolled' : ''}`}>
      <div className="nav-logo">
        <div className="nav-crest">P</div>
        <div className="nav-brand-text">
          <h2>Park Plaza</h2>
          <p>LUXURY RESORT</p>
        </div>
      </div>

      <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
        {mobileMenuOpen ? <X size={24} color={isSolid ? "#fff" : "#fff"} /> : <Menu size={24} color={isSolid ? "#fff" : "#fff"} />}
      </button>

      <div className={`nav-menu-container ${mobileMenuOpen ? 'open' : ''}`}>
        <ul className="nav-links">
          <li className={location.pathname === '/' ? 'active' : ''}><Link to="/">Inicio</Link></li>
          <li className={location.pathname === '/habitaciones' ? 'active' : ''}><Link to="/habitaciones">Habitaciones</Link></li>
          <li className={location.pathname === '/room-service' ? 'active' : ''}><Link to="/room-service">Room Service</Link></li>
          <li className={location.pathname === '/terraza' ? 'active' : ''}><Link to="/terraza">Terraza</Link></li>
          <li className={location.pathname === '/bar' ? 'active' : ''}><Link to="/bar">Bar</Link></li>
          <li className={location.pathname === '/piscina' ? 'active' : ''}><Link to="/piscina">Piscina</Link></li>
          <li className={location.pathname === '/eventos' ? 'active' : ''}><Link to="/eventos">Eventos</Link></li>
          <li className={location.pathname === '/mirador' ? 'active' : ''}><Link to="/mirador">Mirador</Link></li>
        </ul>
        
        <div className="nav-actions" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <a href="tel:+1800LUXURY" style={{ color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
            <Phone size={14} color="var(--color-gold)"/> +1 800 LUXURY
          </a>
          
          {customer ? (
            <div className="user-profile-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '1.2' }}>
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{currentUser?.displayName || customer.displayName || customer.email}</span>
                <span style={{ color: 'var(--color-gold)', fontSize: '10px', textTransform: 'uppercase' }}>Miembro</span>
              </div>
              {(currentUser?.photoURL || customer.photoUrl) ? (
                <img src={currentUser?.photoURL || customer.photoUrl} alt="Profile" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--color-gold)' }} />
              ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                  {(currentUser?.displayName || customer.displayName || customer.email)[0].toUpperCase()}
                </div>
              )}
              <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '8px' }} title="Cerrar Sesión">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button className="btn btn-gold btn-sm" onClick={() => navigate('/login')} style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogIn size={16} /> Iniciar Sesión
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

const BookingBar = () => {
  const navigate = useNavigate();
  const [destination, setDestination] = useState('Hotel Unu, Huancayo, Perú');
  const [dates, setDates] = useState({ checkIn: '', checkOut: '', guests: '2', rooms: '1' });
  const [noDates, setNoDates] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!noDates && (!dates.checkIn || !dates.checkOut)) {
      alert("Por favor seleccione fechas de llegada y salida o active 'Aún no definí la fecha'.");
      return;
    }
    if (!noDates && dates.checkOut <= dates.checkIn) {
      alert('La salida debe ser posterior a la llegada.');
      return;
    }
    const query = new URLSearchParams();
    if (destination) query.set('destination', destination);
    if (!noDates && dates.checkIn) query.set('checkIn', dates.checkIn);
    if (!noDates && dates.checkOut) query.set('checkOut', dates.checkOut);
    if (dates.guests) query.set('guests', dates.guests);
    if (dates.rooms) query.set('rooms', dates.rooms);

    navigate(`/habitaciones?${query.toString()}`);
  };

  return (
    <div className="alojamientos-search-wrapper">
      <h2 className="alojamientos-title">Alojamientos</h2>
      <form onSubmit={handleSearch}>
        <div className="alojamientos-form-row">
          {/* Destino */}
          <div className="alojamientos-field-card">
            <div className="alojamientos-field-icon">
              <MapPin size={20} />
            </div>
            <div className="alojamientos-field-content">
              <span className="alojamientos-field-label">Destino</span>
              <input
                type="text"
                className="alojamientos-field-input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Hotel o destino"
              />
            </div>
          </div>

          {/* Fechas Entrada / Salida */}
          <div className="alojamientos-dates-card" style={{ opacity: noDates ? 0.6 : 1 }}>
            <div className="alojamientos-field-icon">
              <Calendar size={20} />
            </div>
            <div className="alojamientos-dates-split">
              <div className="alojamientos-date-half">
                <span className="alojamientos-field-label">Entrada</span>
                <input
                  type="date"
                  disabled={noDates}
                  required={!noDates}
                  className="alojamientos-field-input"
                  value={dates.checkIn}
                  onChange={(e) => setDates({ ...dates, checkIn: e.target.value })}
                />
              </div>
              <div className="alojamientos-date-divider" />
              <div className="alojamientos-date-half">
                <span className="alojamientos-field-label">Salida</span>
                <input
                  type="date"
                  disabled={noDates}
                  required={!noDates}
                  className="alojamientos-field-input"
                  value={dates.checkOut}
                  onChange={(e) => setDates({ ...dates, checkOut: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Pasajeros y habitaciones */}
          <div className="alojamientos-field-card">
            <div className="alojamientos-field-icon">
              <User size={20} />
            </div>
            <div className="alojamientos-field-content">
              <span className="alojamientos-field-label">Pasajeros y habitaciones</span>
              <select
                className="alojamientos-field-input"
                style={{ cursor: 'pointer' }}
                value={`${dates.guests}-${dates.rooms}`}
                onChange={(e) => {
                  const [g, r] = e.target.value.split('-');
                  setDates({ ...dates, guests: g, rooms: r });
                }}
              >
                <option value="1-1">1 persona, 1 habitación</option>
                <option value="2-1">2 personas, 1 habitación</option>
                <option value="3-1">3 personas, 1 habitación</option>
                <option value="4-2">4 personas, 2 habitaciones</option>
              </select>
            </div>
          </div>

          {/* Botón Buscar */}
          <button type="submit" className="alojamientos-search-btn">
            <Search size={18} />
            <span>Buscar</span>
          </button>
        </div>

        {/* Toggle Aún no definí la fecha */}
        <div className="alojamientos-toggle-row">
          <label className="alojamientos-toggle-switch">
            <input
              type="checkbox"
              checked={noDates}
              onChange={(e) => setNoDates(e.target.checked)}
            />
            <span className="alojamientos-slider" />
          </label>
          <span className="alojamientos-toggle-label">Aún no definí la fecha</span>
        </div>
      </form>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await login(email, password);
      navigate('/');
    } catch {
      setError('Fallo al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/');
    } catch {
      setError('Fallo al iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page web-main">
      {/* Left — image panel */}
      <div className="auth-side-img" style={{ backgroundImage: "url('/hero.png')" }}>
        <div className="auth-side-brand">
          <div className="auth-side-crest">P</div>
          <div className="auth-side-brand-text">
            <h3>Park Plaza</h3>
            <p>Luxury Resort</p>
          </div>
        </div>
        <div className="auth-side-img-content">
          <p className="auth-side-quote">"La excelencia no es un destino, es un estilo de vida."</p>
          <p className="auth-side-quote-sub">Park Plaza · Luxury Resort</p>
          <div className="auth-side-img-dots">
            <span className="dot-active"></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="auth-form-side">
        <Link to="/" className="auth-form-back">
          <ArrowLeft size={14} /> Volver al inicio
        </Link>

        <span className="auth-eyebrow">Portal de Huéspedes</span>
        <h1 className="auth-title">Bienvenido de nuevo</h1>
        <p className="auth-subtitle">
          ¿No tiene una cuenta?{' '}
          <Link to="/registro">Regístrese gratis</Link>
        </p>

        {error && (
          <div className="auth-error">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <button className="auth-social-btn" onClick={handleGoogleSignIn} disabled={loading}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
          Continuar con Google
        </button>

        <div className="auth-divider"><span>o ingrese con su correo</span></div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="login-email">Correo Electrónico</label>
            <div className="auth-input-wrap">
              <Mail size={16} />
              <input
                id="login-email"
                type="email"
                required
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="login-pass">Contraseña</label>
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input
                id="login-pass"
                type={showPass ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 14, background: 'transparent', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex' }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <><span className="gold-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> Iniciando...</> : <><LogIn size={16} /> Iniciar Sesión</>}
          </button>
        </form>
      </div>
    </div>
  );
};

const getPasswordStrength = (pw) => {
  if (!pw) return null;
  if (pw.length < 6) return 'weak';
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasNum   = /\d/.test(pw);
  const hasSpec  = /[^a-zA-Z0-9]/.test(pw);
  const score = [hasLower, hasUpper, hasNum, hasSpec].filter(Boolean).length;
  if (pw.length >= 10 && score >= 3) return 'strong';
  if (pw.length >= 6 && score >= 2) return 'fair';
  return 'weak';
};

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const strength = getPasswordStrength(password);
  const strengthLabel = { weak: 'Débil', fair: 'Media', strong: 'Fuerte' };
  const passwordsMatch = passwordConfirm && password === passwordConfirm;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      return setError('Las contraseñas no coinciden');
    }
    try {
      setError('');
      setLoading(true);
      await signup(email, password);
    } catch {
      setError('Fallo al crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      navigate('/');
    } catch {
      setError('Fallo al registrar con Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page web-main">
      {/* Left — image panel */}
      <div className="auth-side-img" style={{ backgroundImage: "url('/community.png')" }}>
        <div className="auth-side-brand">
          <div className="auth-side-crest">P</div>
          <div className="auth-side-brand-text">
            <h3>Park Plaza</h3>
            <p>Luxury Resort</p>
          </div>
        </div>
        <div className="auth-side-img-content">
          <p className="auth-side-quote">"Únase a la familia Park Plaza y viva experiencias únicas."</p>
           <p className="auth-side-quote-sub">Atención personalizada para cada huésped</p>
          <div className="auth-side-img-dots">
            <span></span>
            <span className="dot-active"></span>
            <span></span>
          </div>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="auth-form-side">
        <Link to="/login" className="auth-form-back">
          <ArrowLeft size={14} /> Iniciar Sesión
        </Link>

        <span className="auth-eyebrow">Cuenta de huésped</span>
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-subtitle">
          ¿Ya tiene cuenta?{' '}
          <Link to="/login">Inicie sesión aquí</Link>
        </p>

        {error && (
          <div className="auth-error">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <button className="auth-social-btn" onClick={handleGoogleSignIn} disabled={loading}>
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
          Registrarse con Google
        </button>

        <div className="auth-divider"><span>o regístrese con su correo</span></div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="reg-email">Correo Electrónico</label>
            <div className="auth-input-wrap">
              <Mail size={16} />
              <input
                id="reg-email"
                type="email"
                required
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="reg-pass">Contraseña</label>
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input
                id="reg-pass"
                type={showPass ? 'text' : 'password'}
                required
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 14, background: 'transparent', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', display: 'flex' }}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {strength && (
              <div className={`strength-${strength}`}>
                <div className="password-strength-bar"><div className="password-strength-fill"></div></div>
                <div className="password-strength-label">Contraseña {strengthLabel[strength]}</div>
              </div>
            )}
          </div>
          <div className="auth-field">
            <label htmlFor="reg-pass-confirm">Confirmar Contraseña</label>
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input
                id="reg-pass-confirm"
                type="password"
                required
                placeholder="Repita su contraseña"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                style={{ paddingRight: '44px' }}
              />
              {passwordsMatch && (
                <Check size={16} style={{ position: 'absolute', right: 14, color: '#16a34a' }} />
              )}
            </div>
          </div>
          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <><span className="gold-spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span> Creando...</> : <>Crear Cuenta Gratis <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

const Home = () => {
  return (
    <div className="web-main">
      <HeroCarousel />
      <BookingBar />
    </div>
  );
};

const Rooms = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { customer } = useAuth();
  const search = new URLSearchParams(location.search);
  const criteria = {
    checkIn: search.get('checkIn') || '',
    checkOut: search.get('checkOut') || '',
    guests: Number(search.get('guests') || 2),
  };
  const [availability, setAvailability] = useState(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [bookingModal, setBookingModal] = useState({ open: false, room: null });
  const [step, setStep] = useState(1); // 1 = guest data, 2 = review & confirm
  const [formData, setFormData] = useState({ firstName: '', lastName: '', nationality: '', email: '', phone: '', documentType: 'dni', issuingCountry: 'PE', documentNumber: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [reservation, setReservation] = useState(null);
  const [copied, setCopied] = useState(false);
  const [amenitiesCatalog, setAmenitiesCatalog] = useState({});
  const [selectedExtras, setSelectedExtras] = useState(new Set());
  const bookingKey = useRef(null);

  const fetchAmenities = useCallback(() => {
    getCustomerRoomAmenities()
      .then((data) => {
        if (data?.categoryAmenities) {
          setAmenitiesCatalog(data.categoryAmenities);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchAmenities();
  }, [fetchAmenities]);

  useCustomerSocket('', '', 'room:amenities_updated', (payload) => {
    console.log('[Customer WebSocket] Amenities actualizadas:', payload);
    if (payload?.categoryAmenities) {
      setAmenitiesCatalog(payload.categoryAmenities);
    } else {
      fetchAmenities();
    }
  });

  useEffect(() => {
    if (!criteria.checkIn || !criteria.checkOut) {
      setAvailability(null);
      return;
    }
    let active = true;
    setLoadingAvailability(true);
    setAvailabilityError('');
    if (criteria.checkOut <= criteria.checkIn || !Number.isInteger(criteria.guests) || criteria.guests < 1) {
      setLoadingAvailability(false);
      setAvailability(null);
      setAvailabilityError('Los criterios de disponibilidad no son válidos.');
      return;
    }
    getAvailability({
      checkInDate: criteria.checkIn,
      checkOutDate: criteria.checkOut,
      guestCount: criteria.guests,
    }).then((result) => {
      if (active) setAvailability(result);
    }).catch((error) => {
      if (active) {
        setAvailability(null);
        setAvailabilityError(error.message || 'No se pudo consultar la disponibilidad.');
      }
    }).finally(() => {
      if (active) setLoadingAvailability(false);
    });
    return () => { active = false; };
  }, [criteria.checkIn, criteria.checkOut, criteria.guests]);

  // Real-time synchronization via WebSocket
  useCustomerSocket('', '', 'room:category_updated', (payload) => {
    console.log('[Customer WebSocket] Tarifas o categorías actualizadas:', payload);
    if (criteria.checkIn && criteria.checkOut) {
      getAvailability({
        checkInDate: criteria.checkIn,
        checkOutDate: criteria.checkOut,
        guestCount: criteria.guests,
      }).then((result) => {
        setAvailability(result);
        if (bookingModal.open && bookingModal.room && payload?.category) {
          const updatedCat = result?.categories?.find((c) => (c.code || c.categoryCode) === bookingModal.room.code);
          if (updatedCat) {
            setBookingModal((current) => ({
              ...current,
              room: {
                ...current.room,
                price: `${formatMoney(updatedCat.totalAmount, result?.currency)} total`,
                rawPrice: formatMoney(updatedCat.totalAmount, result?.currency),
              },
            }));
          }
        }
      }).catch(() => {});
    }
  });

  useCustomerSocket('', '', 'room:status_changed', (payload) => {
    console.log('[Customer WebSocket] Disponibilidad de habitación actualizada:', payload);
    if (criteria.checkIn && criteria.checkOut) {
      getAvailability({
        checkInDate: criteria.checkIn,
        checkOutDate: criteria.checkOut,
        guestCount: criteria.guests,
      }).then((result) => {
        setAvailability(result);
      }).catch(() => {});
    }
  });

  const rooms = (availability?.categories || []).map((category) => {
    const code = category.code || category.categoryCode;
    const name = category.name || category.categoryName;
    const catId = category.id || category.categoryId;
    const assignedKeys = (catId && amenitiesCatalog[catId]) || [];
    const amenityBadges = assignedKeys.map((k) => CLIENT_AMENITY_LABELS[k] || k);
    const defaultBadges = ['📶 WiFi 6', '📺 Smart TV 55"', '❄️ Climatización', '🛎️ Room Service 24/7'];

    const marketing = ROOM_MARKETING[code] || { title: name, desc: 'Una categoría Park Plaza preparada para su estadía.', img: '/community.png' };
    return {
      ...marketing,
      title: marketing.title || name,
      code,
      name,
      capacity: category.capacity,
      totalAmount: category.totalAmount,
      price: `${formatMoney(category.totalAmount, availability?.currency)} total`,
      rawPrice: formatMoney(category.totalAmount, availability?.currency),
      amenities: amenityBadges.length > 0 ? amenityBadges : defaultBadges,
    };
  });

  const openBooking = (room) => {
    if (!customer) { navigate('/login'); return; }
    setBookingError('');
    setSelectedExtras(new Set());
    setStep(1);
    setBookingModal({ open: true, room });
  };

  const showsIssuingCountry = formData.documentType === 'passport' || formData.documentType === 'other';
  const showsNationality = formData.documentType === 'passport';
  const changeDocumentType = (documentType) => setFormData((current) => {
    const isLocalDocument = documentType === 'dni' || documentType === 'foreign_id';
    const wasLocalDocument = current.documentType === 'dni' || current.documentType === 'foreign_id';
    let issuingCountry = current.issuingCountry;
    if (isLocalDocument) issuingCountry = 'PE';
    else if (wasLocalDocument) issuingCountry = '';
    return {
      ...current,
      documentType,
      nationality: documentType === 'passport' && current.documentType === 'passport' ? current.nationality : '',
      issuingCountry,
    };
  });

  const handleBook = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setBookingError('');
    try {
      bookingKey.current ??= crypto.randomUUID();
      const issuingCountry = (formData.documentType === 'dni' || formData.documentType === 'foreign_id')
        ? (formData.issuingCountry || 'PE')
        : (formData.issuingCountry || 'PE');
      const created = await createBooking({
        categoryCode: bookingModal.room.code,
        checkInDate: criteria.checkIn,
        checkOutDate: criteria.checkOut,
        guestCount: criteria.guests,
        guest: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          ...(formData.nationality ? { nationality: formData.nationality } : {}),
          ...(formData.email ? { email: formData.email } : {}),
          ...(formData.phone ? { phone: formData.phone } : {}),
          primaryDocument: {
            type: formData.documentType,
            issuingCountry,
            documentNumber: formData.documentNumber,
          },
        },
      }, bookingKey.current);
      setReservation(created.reservation);
      bookingKey.current = null;
    } catch (err) {
      setBookingError(err.message || 'No se pudo crear la reserva. Verifique la disponibilidad e intente nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeAndReset = () => {
    setBookingModal({ open: false, room: null });
    setReservation(null);
    setStep(1);
    setCopied(false);
    bookingKey.current = null;
    setBookingError('');
    setFormData({ firstName: '', lastName: '', nationality: '', email: '', phone: '', documentType: 'dni', issuingCountry: 'PE', documentNumber: '' });
  };

  const handleCopy = () => {
    if (reservation?.id) {
      navigator.clipboard.writeText(reservation.id).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="web-main" style={{ position: 'relative', overflow: 'hidden' }}>
      {rooms.length > 0 ? <RoomsAccordion rooms={rooms} onBook={openBooking} /> : (
        <div className="page-container" style={{ minHeight: '100vh', paddingTop: '100px', position: 'relative', zIndex: 50 }}>
          <div className="rooms-empty-state">
            <div className="rooms-empty-icon">
              <Bed size={48} />
            </div>
            {availabilityError && (
              <div className="rooms-error-banner">
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                {availabilityError}
              </div>
            )}
            <h2 className="rooms-empty-title">
              {loadingAvailability ? 'Consultando disponibilidad…' : 'Busque su próxima estadía'}
            </h2>
            <p className="rooms-empty-text">
              {!availabilityError && (availability ? 'No hay categorías disponibles para las fechas seleccionadas. Pruebe con otras fechas.' : 'Seleccione llegada, salida y huéspedes desde la página de inicio para ver habitaciones disponibles.')}
            </p>
            <button className="portal-btn-gold" onClick={() => navigate('/')}>Volver al buscador</button>
          </div>
        </div>
      )}

      {/* — RESERVATION MODAL — */}
      {bookingModal.open && (
        <div className="reservation-overlay">
          <div className="reservation-modal">
            {/* Header with room image */}
            <div
              className="reservation-modal-header"
              style={{ backgroundImage: `url(${bookingModal.room.img})` }}
            >
              <button className="reservation-modal-close" onClick={closeAndReset}>
                <X size={16} />
              </button>
              <div className="reservation-header-content">
                <div>
                  <h2 className="reservation-header-title">{bookingModal.room.title}</h2>
                  <p className="reservation-header-sub">{criteria.checkIn} → {criteria.checkOut} · {criteria.guests} huésped(es)</p>
                </div>
                <div className="reservation-header-price">
                  <div className="reservation-price-amount">{bookingModal.room.rawPrice}</div>
                  <div className="reservation-price-label">Total</div>
                </div>
              </div>
            </div>

            {/* 5-star amenities strip */}
            {bookingModal.room.amenities && bookingModal.room.amenities.length > 0 && !reservation && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '12px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a', width: '100%', marginBottom: '2px' }}>
                  ✨ Comodidades 5★ Incluidas en su estadía:
                </span>
                {bookingModal.room.amenities.map((am, idx) => (
                  <span key={idx} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '12px', background: '#fff', border: '1px solid #cbd5e1', color: '#334155', fontWeight: '500', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    {am}
                  </span>
                ))}
              </div>
            )}

            {/* Success screen */}
            {reservation ? (
              <div className="booking-success">
                <svg className="success-checkmark" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="40" cy="40" r="38" stroke="#16a34a" strokeWidth="3" fill="none" />
                  <path d="M22 40 L34 52 L58 28" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <h2>¡Reserva Confirmada!</h2>
                <p>
                  Su reserva para <strong>{reservation.category?.name || bookingModal.room.title}</strong> ha sido creada exitosamente con estado <strong>{reservation.status}</strong>.
                </p>
                <div className="booking-success-code">
                  <div className="code-text">
                    <span className="code-label">Código de Reserva</span>
                    <span className="code-value">{reservation.id}</span>
                  </div>
                  <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
                    {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                  </button>
                </div>
                <div className="booking-success-details">
                  <div className="booking-detail-pill">
                    <span>Check-In</span>
                    <strong>{criteria.checkIn}</strong>
                  </div>
                  <div className="booking-detail-pill">
                    <span>Check-Out</span>
                    <strong>{criteria.checkOut}</strong>
                  </div>
                  <div className="booking-detail-pill">
                    <span>Huéspedes</span>
                    <strong>{criteria.guests}</strong>
                  </div>
                </div>
                <button className="portal-btn-gold" onClick={closeAndReset}>Cerrar</button>
              </div>
            ) : (
              <>
                {/* Stepper */}
                <div className="reservation-stepper">
                  <div className={`stepper-step ${step >= 1 ? (step > 1 ? 'complete' : 'active') : ''}`}>
                    <div className="stepper-bubble">{step > 1 ? <Check size={14} /> : '1'}</div>
                    <div className="stepper-label">
                      <span className="stepper-label-title">Datos del Huésped</span>
                      <span className="stepper-label-sub">Información personal</span>
                    </div>
                  </div>
                  <div className={`stepper-connector ${step > 1 ? 'done' : ''}`}></div>
                  <div className={`stepper-step ${step === 2 ? 'active' : ''}`}>
                    <div className="stepper-bubble">2</div>
                    <div className="stepper-label">
                      <span className="stepper-label-title">Confirmar Reserva</span>
                      <span className="stepper-label-sub">Revisar y confirmar</span>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <form className="reservation-modal-form" onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : handleBook}>
                  <div className="reservation-modal-body">
                    {bookingError && (
                      <div className="reservation-error">
                        <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                        {bookingError}
                      </div>
                    )}

                    {step === 1 && (
                      <>
                        <p className="reservation-section-title">Datos Personales</p>
                        <div className="reservation-form-grid">
                          <div className="reservation-field">
                            <label>Nombres *</label>
                            <input type="text" required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} placeholder="Juan" />
                          </div>
                          <div className="reservation-field">
                            <label>Apellidos *</label>
                            <input type="text" required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="García" />
                          </div>
                          <div className="reservation-field">
                            <label>Correo</label>
                            <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="correo@ejemplo.com" />
                          </div>
                          <div className="reservation-field">
                            <label>Teléfono</label>
                            <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="+51 999 999 999" />
                          </div>
                        </div>

                        <p className="reservation-section-title">Documento de Identidad</p>
                        <div className="reservation-form-grid">
                          <div className="reservation-field">
                            <label>Tipo *</label>
                            <select value={formData.documentType} onChange={e => changeDocumentType(e.target.value)}>
                              <option value="dni">DNI</option>
                              <option value="passport">Pasaporte</option>
                              <option value="foreign_id">Carnet de extranjería</option>
                              <option value="other">Otro</option>
                            </select>
                          </div>
                          <div className="reservation-field">
                            <label>Número *</label>
                            <input type="text" required value={formData.documentNumber} onChange={e => setFormData({...formData, documentNumber: e.target.value})} placeholder="12345678" />
                          </div>
                          {showsIssuingCountry && (
                            <div className="reservation-field">
                              <label>País Emisor *</label>
                              <select required value={formData.issuingCountry} onChange={e => setFormData({...formData, issuingCountry: e.target.value})}>
                                <option value="">Seleccione un país</option>
                                {COUNTRY_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                              </select>
                            </div>
                          )}
                          {showsNationality && (
                            <div className="reservation-field">
                              <label>Nacionalidad *</label>
                              <select required value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})}>
                                <option value="">Seleccione una nacionalidad</option>
                                {COUNTRY_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {step === 2 && (() => {
                      const nights = Math.max(1, Math.round((new Date(criteria.checkOut) - new Date(criteria.checkIn)) / (1000 * 60 * 60 * 24))) || 1;
                      const extrasTotal = Array.from(selectedExtras).reduce((sum, id) => {
                        const s = CLIENT_EXTRA_SERVICES.find((item) => item.id === id);
                        if (!s) return sum;
                        return sum + (s.type === 'per_night' ? s.price * nights : s.price);
                      }, 0);
                      const roomNumeric = Number(bookingModal.room?.totalAmount || 0);
                      const finalTotal = roomNumeric + extrasTotal;

                      return (
                        <>
                          <p className="reservation-section-title">✨ Amenidades Incluidas en su Habitación</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                            {(bookingModal.room?.amenities || []).map((amenity, idx) => (
                              <span key={idx} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', color: '#334155', fontWeight: '600' }}>
                                {amenity}
                              </span>
                            ))}
                          </div>

                          <p className="reservation-section-title">Servicios Adicionales para su Estadía</p>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px', marginBottom: '14px' }}>
                            {CLIENT_EXTRA_SERVICES.map((s) => {
                              const checked = selectedExtras.has(s.id);
                              const itemPrice = s.type === 'per_night' ? s.price * nights : s.price;
                              return (
                                <label
                                  key={s.id}
                                  onClick={() => {
                                    setSelectedExtras((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(s.id)) next.delete(s.id);
                                      else next.add(s.id);
                                      return next;
                                    });
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    border: checked ? '1.5px solid #d4af37' : '1px solid #e2e8f0',
                                    background: checked ? '#fefce8' : '#f8fafc',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input type="checkbox" checked={checked} onChange={() => {}} />
                                    <div>
                                      <strong style={{ fontSize: '12.5px', color: '#0f172a', display: 'block' }}>{s.icon} {s.name}</strong>
                                      <span style={{ fontSize: '11px', color: '#64748b' }}>{s.desc}</span>
                                    </div>
                                  </div>
                                  <strong style={{ fontSize: '12.5px', color: checked ? '#059669' : '#0f172a' }}>
                                    +S/ {itemPrice.toFixed(2)}
                                  </strong>
                                </label>
                              );
                            })}
                          </div>

                          <p className="reservation-section-title">Resumen de Liquidación</p>
                          <div className="reservation-review-card">
                            <div className="reservation-review-row">
                              <span>Habitación</span>
                              <strong>{bookingModal.room.title}</strong>
                            </div>
                            <div className="reservation-review-row">
                              <span>Check-In / Check-Out</span>
                              <strong>{criteria.checkIn} al {criteria.checkOut} ({nights} {nights === 1 ? 'noche' : 'noches'})</strong>
                            </div>
                            <div className="reservation-review-row">
                              <span>Huéspedes</span>
                              <strong>{criteria.guests} persona(s)</strong>
                            </div>
                            <div className="reservation-review-row">
                              <span>Tarifa Habitación</span>
                              <strong>{formatMoney(roomNumeric, availability?.currency)}</strong>
                            </div>
                            {selectedExtras.size > 0 ? (
                              <div className="reservation-review-row">
                                <span style={{ color: '#059669', fontWeight: '600' }}>Servicios Adicionales</span>
                                <strong style={{ color: '#059669' }}>+S/ {extrasTotal.toFixed(2)}</strong>
                              </div>
                            ) : null}
                            <div className="reservation-review-total">
                              <span>Total Liquidación</span>
                              <strong style={{ color: '#059669', fontSize: '16px' }}>S/ {finalTotal.toFixed(2)}</strong>
                            </div>
                          </div>

                          <p className="reservation-section-title">Huésped Principal</p>
                          <div className="reservation-guest-review">
                            <div className="reservation-guest-review-name">{formData.firstName} {formData.lastName}</div>
                            <div className="reservation-guest-review-meta">
                              {formData.documentType.toUpperCase()}: {formData.documentNumber}
                              {formData.email && ` · ${formData.email}`}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Footer */}
                  <div className="reservation-modal-footer">
                    {step === 2 ? (
                      <button type="button" className="reservation-back-btn" onClick={() => setStep(1)}>
                        <ArrowLeft size={14} /> Atrás
                      </button>
                    ) : (
                      <button type="button" className="reservation-back-btn" onClick={closeAndReset}>
                        <X size={14} /> Cancelar
                      </button>
                    )}
                    {step === 1 ? (
                      <button type="submit" className="reservation-next-btn">
                        Continuar <ArrowRight size={14} />
                      </button>
                    ) : (
                      <button type="submit" className="reservation-submit-btn" disabled={isSubmitting}>
                        {isSubmitting ? <><span className="gold-spinner" style={{ width: 16, height: 16, borderWidth: 2 }}></span> Procesando...</> : <>Confirmar Reserva <ChevronRight size={14} /></>}
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AmenityPage = ({ data }) => {
  const { customer } = useAuth();
  const navigate = useNavigate();
  const [modal, setModal] = useState({ open: false, type: null, service: null });
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState('10:00');
  const [pax, setPax] = useState(1);
  const [documentNumber, setDocumentNumber] = useState('');
  const [customerName, setCustomerName] = useState(customer?.name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [dynamicConfig, setDynamicConfig] = useState(null);

  const amenityKey = (data.id || '').toLowerCase().includes('mirador') ? 'mirador' : 'piscina';

  const loadConfig = useCallback(async () => {
    try {
      const configs = await getAmenityConfigs();
      if (Array.isArray(configs)) {
        const found = configs.find((c) => c.amenityKey === amenityKey);
        if (found) setDynamicConfig(found);
      }
    } catch (e) {
      console.warn('Error al sincronizar tarifas de amenidad:', e);
    }
  }, [amenityKey]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Real-time synchronization via WebSocket
  useCustomerSocket('', '', 'amenity:config_updated', (updated) => {
    if (updated && updated.amenityKey === amenityKey) {
      setDynamicConfig(updated);
    }
  });

  const isReservable = data.type === 'reservation';
  const price = dynamicConfig
    ? (customer ? Number(dynamicConfig.priceGuest || 0) : Number(dynamicConfig.priceExternal || 0))
    : Number(data.price || 0);

  const durationMinutes = dynamicConfig?.durationMinutes || data.durationMinutes || 90;
  const maxPax = dynamicConfig?.maxPax || data.maxPax || 4;
  const isActive = dynamicConfig ? dynamicConfig.isActive : true;

  const close = () => {
    setModal({ open: false, type: null, service: null });
    setSuccess(false);
    setError(null);
  };

  useEffect(() => {
    setSelectedTime(data.timeSlots?.[0] || '10:00');
    setPax(1);
    if (customer?.name && !customerName) {
      setCustomerName(customer.name);
    }
  }, [data.id, data.timeSlots, customer]);

  const handleBook = async () => {
    if (!isReservable) return;
    if (!isActive) {
      setError(`La zona ${data.title} se encuentra en mantenimiento o pausada en este momento.`);
      return;
    }
    if (!customer) {
      navigate('/login');
      return;
    }
    if (!documentNumber.trim()) {
      setError('Por favor ingrese su número de DNI o documento de identidad para el registro en recepción.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
      
      await createAmenityReservation({
        amenityType: data.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        pax,
        documentNumber: documentNumber.trim(),
        customerName: customerName.trim() || customer?.name || 'Visitante',
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Error al procesar la reserva.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="web-main" style={{ position: 'relative', overflow: 'hidden' }}>
      <AmenityView data={data} onBook={(type, service) => setModal({ open: true, type, service })} />

      {modal.open && data.id === 'eventos' && (
        <EventBookingModal data={data} onClose={close} />
      )}

      {modal.open && data.id !== 'eventos' && (
        <div className="amenity-modal-overlay" onClick={close}>
          <div className="amenity-modal" onClick={e => e.stopPropagation()}>
            <div className="amenity-modal-top" style={{ backgroundImage: `url(${data.image})` }}>
              <button className="amenity-modal-close" onClick={close}><X size={14} /></button>
              <div className="amenity-modal-top-content">
                <span className="amenity-modal-tag">{data.place}</span>
                <h2 className="amenity-modal-title">{data.title}</h2>
              </div>
            </div>
            
            <div className="amenity-modal-body">
              {success ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <CheckCircle2 size={48} color="var(--color-gold)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', marginBottom: '8px' }}>¡Reserva Confirmada!</h3>
                  <p style={{ color: 'var(--color-muted)', fontSize: '14px', marginBottom: '16px' }}>
                    Su reserva en {data.title} ha sido agendada con éxito.
                    Al llegar, presente su <strong>DNI ({documentNumber})</strong> en recepción para su pase de acceso.
                  </p>
                  <div style={{ background: 'rgba(212, 175, 55, 0.1)', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '13px', textAlign: 'left', color: 'var(--color-text)' }}>
                    💳 <strong>Cuenta de Consumo Abierta:</strong> Durante su estadía en {data.title} podrá solicitar cócteles, snacks y platos desde este portal cargándolos a su cuenta temporal y liquidar el total en recepción al finalizar.
                  </div>
                  <button className="gold-btn-solid full-width" style={{ padding: '12px', borderRadius: 'var(--radius-full)' }} onClick={close}>Entendido</button>
                </div>
              ) : (
                <>
                  {!isReservable ? (
                    <div className="amenity-modal-notice">Las reservas en línea están disponibles actualmente para Piscina y Mirador. Para esta zona, comuníquese con recepción.</div>
                  ) : !isActive ? (
                    <div className="amenity-modal-notice" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444' }}>
                      La zona {data.title} se encuentra temporalmente inactiva para nuevas reservas. Por favor consulte en recepción.
                    </div>
                  ) : !customer ? (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ marginBottom: '16px', color: 'var(--color-muted)' }}>Para reservar {data.title}, debe iniciar sesión en el portal.</p>
                      <button className="gold-btn-solid full-width" style={{ padding: '12px', borderRadius: 'var(--radius-full)' }} onClick={() => navigate('/login')}>
                        <LogIn size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} /> Iniciar Sesión
                      </button>
                    </div>
                  ) : (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                       {error && <div style={{ color: 'var(--color-danger)', fontSize: '13px', background: 'rgba(220,53,69,0.1)', padding: '8px', borderRadius: '4px' }}>{error}</div>}
                       <section className="amenity-rules" aria-label={`Condiciones de ${data.title}`}>
                         <div><span>Costo</span><strong>{price === 0 ? 'Gratis (Incluido)' : `${formatMoney(price)} por persona`}</strong></div>
                         <div><span>Duración</span><strong>{durationMinutes} min</strong></div>
                         <div><span>Máximo</span><strong>{maxPax} personas</strong></div>
                         <ul>
                           <li><CheckCircle2 size={14} />Reserva disponible para visitantes y huéspedes.</li>
                           <li><CheckCircle2 size={14} />Máximo {maxPax} personas por turno.</li>
                           <li><CheckCircle2 size={14} />Turno de estadía válido por {durationMinutes} minutos.</li>
                           {dynamicConfig?.openingHour ? <li><CheckCircle2 size={14} />Horario de atención: {dynamicConfig.openingHour} a {dynamicConfig.closingHour}</li> : null}
                         </ul>
                       </section>
                      
                       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                         <div>
                           <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '4px' }}>DNI / Doc. Identidad *:</label>
                           <input 
                             className="luxury-input full-width" 
                             required 
                             placeholder="Ej. 74859632" 
                             value={documentNumber} 
                             onChange={e => setDocumentNumber(e.target.value)} 
                           />
                         </div>
                         <div>
                           <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '4px' }}>Nombre Titular:</label>
                           <input 
                             className="luxury-input full-width" 
                             placeholder="Nombre completo" 
                             value={customerName} 
                             onChange={e => setCustomerName(e.target.value)} 
                           />
                         </div>
                       </div>

                       <div style={{ display: 'flex', gap: '10px' }}>
                         <div style={{ flex: 1 }}>
                           <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '4px' }}>Fecha:</label>
                           <input className="luxury-select full-width" type="date" min={new Date().toISOString().split('T')[0]} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                         </div>
                         <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '4px' }}>Horario:</label>
                           <select className="luxury-select full-width" value={selectedTime} onChange={e => setSelectedTime(e.target.value)}>
                             {data.timeSlots.map((time) => <option key={time} value={time}>{time}</option>)}
                          </select>
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-muted)', marginBottom: '4px' }}>Personas:</label>
                           <select className="luxury-select full-width" value={pax} onChange={e => setPax(Number(e.target.value))}>
                             {Array.from({ length: maxPax }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} persona(s)</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>Costo Total</div>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--color-gold)' }}>
                             {formatMoney(price * pax)}
                          </div>
                        </div>
                        <button className="gold-btn-solid" style={{ padding: '12px 24px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer' }} onClick={handleBook} disabled={isSubmitting}>
                          {isSubmitting ? 'Procesando...' : 'Confirmar Reserva'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const amenityData = {
  bar: {
    place: 'Bebidas', title: 'BAR', type: 'inquiry', ctaText: 'Consultar', image: '/images/bar.png',
    description: 'Disfrute de coctelería de autor en un ambiente elegante. Nuestro equipo le sorprenderá con sabores únicos mientras se relaja al final del día.'
  },
  terraza: {
    place: 'Exteriores', title: 'TERRAZA', type: 'inquiry', ctaText: 'Consultar', image: '/images/terraza.png',
    description: 'Contemple los atardeceres desde nuestra terraza. Un espacio diseñado para la relajación con vistas ininterrumpidas y servicio personalizado.'
  },
  mirador: {
    id: 'mirador', place: 'Vistas 360°', title: 'MIRADOR', type: 'reservation', ctaText: 'Reservar', image: '/images/mirador.png', price: 30, durationMinutes: 90, maxPax: 4, timeSlots: ['17:00', '19:30'],
    description: 'El punto más alto de nuestro resort le ofrece una vista espectacular. Sienta la inmensidad del paisaje en un entorno tranquilo y sublime.',
    restrictions: ['Reserva disponible para visitantes externos.', 'Máximo 4 personas por reserva.', 'Reserva válida por 90 minutos.']
  },
  piscina: {
    id: 'piscina', place: 'Relajación', title: 'PISCINA', type: 'reservation', ctaText: 'Reservar', image: '/images/piscina.png', price: 50, durationMinutes: 120, maxPax: 6, timeSlots: ['10:00', '14:00', '18:00'],
    description: 'Sumérjase en nuestra piscina de borde infinito que se funde con el horizonte. Rodeada de cómodas reposeras y con servicio de bar directo a su lugar.',
    restrictions: ['Reserva disponible para visitantes externos.', 'Máximo 6 personas por reserva.', 'Reserva válida por 2 horas.']
  },
  eventos: {
    id: 'eventos', place: 'Celebraciones', title: 'ZONA DE EVENTOS', type: 'event_reservation', ctaText: 'Reservar', image: '/images/zona_eventos.png',
    description: 'Celebre sus momentos en nuestros majestuosos salones. Equipados con tecnología y diseño versátil, garantizamos que su evento será inolvidable.'
  }
};

function Portal() {
  const auth = useAuth();

  if (auth.status === 'loading') return (
    <div className="portal-state-page web-main">
      <div className="portal-state-card">
        <div className="portal-state-icon loading-icon">
          <div className="gold-spinner"></div>
        </div>
        <h2 className="portal-state-title">Verificando sesión</h2>
        <p className="portal-state-text">Estamos conectando su cuenta con el portal Park Plaza. Esto tomará solo un momento.</p>
      </div>
    </div>
  );

  if (auth.status === 'error') return (
    <div className="portal-state-page web-main">
      <div className="portal-state-card">
        <div className="portal-state-icon error-icon">
          <AlertTriangle size={32} color="#dc2626" />
        </div>
        <h2 className="portal-state-title">Error de Conexión</h2>
        <p className="portal-state-text">{auth.error || 'No se pudo verificar la sesión. Por favor intente nuevamente.'}</p>
        <div className="portal-state-actions">
          <button className="portal-btn-gold" onClick={() => void auth.retry().catch(() => undefined)}>Reintentar</button>
        </div>
      </div>
    </div>
  );

  if (auth.status === 'verification-required') return (
    <div className="portal-state-page web-main">
      <div className="portal-state-card">
        <div className="portal-state-icon verify-icon">
          <Mail size={32} color="var(--color-gold)" />
        </div>
        <h2 className="portal-state-title">Verifique su Correo</h2>
        <p className="portal-state-text">Enviamos un enlace de verificación a su correo electrónico. Revise su bandeja de entrada y haga clic en el enlace para activar su cuenta.</p>
        <div className="portal-state-actions">
          <button className="portal-btn-gold" onClick={() => void auth.retry().catch(() => undefined)}>Ya verifiqué mi correo</button>
          <button className="portal-btn-ghost" onClick={() => void auth.logout().catch(() => undefined)}>Usar otra cuenta</button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Background3D />
      <div className="web-layout">
        <Navbar />
        <Routes>{CUSTOMER_ROUTES.map((route) => <Route key={route} path={route} element={isCustomerContractAdmitted(route) ? <CustomerContractRoute route={route} /> : <CustomerContractBlockedView route={route} />} />)}</Routes>
      </div>
    </>
  );
}

function CustomerContractRoute({ route }) {
  const routes = {
    '/': <Home />,
    '/habitaciones': <Rooms />,
    '/room-service': <RoomServiceView />,
    '/terraza': <AmenityPage data={amenityData.terraza} />,
    '/bar': <AmenityPage data={amenityData.bar} />,
    '/piscina': <AmenityPage data={amenityData.piscina} />,
    '/eventos': <AmenityPage data={amenityData.eventos} />,
    '/mirador': <AmenityPage data={amenityData.mirador} />,
    '/login': <Login />,
    '/registro': <Register />,
  };
  return routes[route] || <CustomerContractBlockedView route={route} />;
}

function CustomerContractBlockedView({ route }) {
  return <main className="portal-state-page web-main" role="status" aria-live="polite"><section className="portal-state-card"><h2 className="portal-state-title">Backend contract not verified</h2><p className="portal-state-text">The {route} route is visible but has no data or actions until its customer-session Backend contract is approved and verified.</p></section></main>;
}

function App() {
  return <AuthProvider><Router><Portal /></Router></AuthProvider>;
}

export default App;
