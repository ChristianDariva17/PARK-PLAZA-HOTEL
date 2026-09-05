export interface MasterAmenity {
  key: string;
  label: string;
  icon: string;
  category: string;
}

export const MASTER_ROOM_AMENITIES: MasterAmenity[] = [
  { key: 'wifi_high_speed', label: 'WiFi 6 de Alta Velocidad', icon: '📶', category: 'Conectividad' },
  { key: 'smart_tv_4k', label: 'Smart TV 55" 4K con Streaming', icon: '📺', category: 'Entretenimiento' },
  { key: 'smart_ac', label: 'Climatización Inteligente Frío/Calor', icon: '❄️', category: 'Confort' },
  { key: 'spanish_shower', label: 'Baño Privado con Ducha Española', icon: '🚿', category: 'Bienestar' },
  { key: 'luxury_amenities', label: 'Set Exclusivo de Amenities 5★', icon: '🧴', category: 'Bienestar' },
  { key: 'jacuzzi_tub', label: 'Tina de Hidromasaje / Jacuzzi', icon: '🛁', category: 'Lujo' },
  { key: 'panoramic_balcony', label: 'Balcón con Vista Panorámica', icon: '🌅', category: 'Lujo' },
  { key: 'nespresso_minibar', label: 'Frigobar y Cafetera Nespresso', icon: '☕', category: 'Gastronomía' },
  { key: 'digital_safe', label: 'Caja Fuerte Digital', icon: '🔐', category: 'Seguridad' },
  { key: 'room_service_24_7', label: 'Room Service 24/7', icon: '🛎️', category: 'Servicio' },
  { key: 'executive_desk', label: 'Escritorio Ergonómico Ejecutivo', icon: '💼', category: 'Trabajo' },
  { key: 'soundproof_windows', label: 'Ventanas con Aislamiento Acústico', icon: '🔇', category: 'Confort' },
  { key: 'bathrobe_slippers', label: 'Batas de Baño y Pantuflas', icon: '🥋', category: 'Bienestar' },
  { key: 'king_bed', label: 'Cama King Size con Sábanas 600 Hilos', icon: '👑', category: 'Confort' },
];
