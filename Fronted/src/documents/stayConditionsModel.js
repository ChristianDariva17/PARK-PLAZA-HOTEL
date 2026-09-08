export const HOTEL_INFO = {
  name: 'Hotel Park Plaza',
  stars: '★★★★★',
  ruc: '20601234567',
  address: 'Av. Principal 123, Miraflores, Lima - Perú',
  phone: '+51 (01) 555-0199 / +51 987 654 321',
  email: 'recepcion@parkplaza.pe',
  website: 'www.parkplazahotel.pe',
};

export const DEFAULT_CHECKLIST = [
  { id: 'tv', label: 'Televisor Smart TV operativo y pantalla intacta', checked: true },
  { id: 'remote', label: 'Control remoto de TV y AC entregados y con baterías', checked: true },
  { id: 'ac', label: 'Aire acondicionado y calefacción en correcto funcionamiento', checked: true },
  { id: 'lights', label: 'Iluminación y tomas eléctricas operativas', checked: true },
  { id: 'bathroom', label: 'Sanitarios, grifería y agua caliente operativos', checked: true },
  { id: 'towels', label: 'Juego de toallas completo y en perfecto estado', checked: true },
  { id: 'bedding', label: 'Sábanas, almohadas y cobertor limpios e intactos', checked: true },
  { id: 'furniture', label: 'Mobiliario, veladores y closets sin deterioros', checked: true },
  { id: 'key', label: 'Tarjeta de acceso / Llave de habitación entregada', checked: true },
];

export const PENALTY_RATES = [
  { concept: 'Pérdida o daño de tarjeta / llave de acceso', amount: 40.00 },
  { concept: 'Limpieza extraordinaria (manchas graves, olor a tabaco)', amount: 120.00 },
  { concept: 'Pérdida de control remoto (TV o aire acondicionado)', amount: 60.00 },
  { concept: 'Daño en toallas o ropa de cama', amount: 80.00 },
  { concept: 'Daño o rotura de mobiliario / equipos', amount: 'Según valuación técnica' },
  { concept: 'Salida tardía no autorizada (Late check-out > 13:00)', amount: '50% tarifa diaria' },
];
