import {
  BarChart3, BedDouble, Bell, Boxes, CalendarCheck, CalendarDays, Car, ClipboardList,
  CreditCard, FileImage, FileSignature, GlassWater, KeyRound, LayoutDashboard, LockKeyhole,
  PawPrint, QrCode, Settings, ShieldCheck, Sparkles, Star, Truck, UserCheck, Users,
  UtensilsCrossed, Waves, Wrench,
} from 'lucide-react';
import { permissionForRoute } from '../../auth/permissions';

export const NAV_SECTIONS = [
  { title: 'Recepción', items: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'habitaciones', label: 'Habitaciones', icon: BedDouble },
    { id: 'reservas', label: 'Reservas', icon: CalendarDays }, { id: 'contratos', label: 'Contratos', icon: FileSignature },
    { id: 'checkin-checkout', label: 'Check-in / out', icon: KeyRound }, { id: 'finanzas', label: 'Pagos y cuentas', icon: CreditCard },
    { id: 'clientes', label: 'Clientes', icon: Users },
  ] },
  { title: 'Operación', items: [
    { id: 'limpieza', label: 'Limpieza', icon: Sparkles }, { id: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
    { id: 'incidencias', label: 'Incidencias', icon: ClipboardList }, { id: 'evidencias', label: 'Evidencias', icon: FileImage },
    { id: 'notificaciones', label: 'Notificaciones', icon: Bell }, { id: 'pedidos-qr', label: 'Pedidos QR', icon: QrCode, badgeKey: 'orders' },
    { id: 'inventario', label: 'Inventario', icon: Boxes }, { id: 'cocina-bar', label: 'Cocina y bar', icon: UtensilsCrossed },
    { id: 'proveedores', label: 'Proveedores', icon: Truck },
  ] },
  { title: 'Servicios', items: [
    { id: 'bar-qr', label: 'QR de barra', icon: GlassWater }, { id: 'terraza-qr', label: 'QR de terraza', icon: QrCode },
    { id: 'cochera', label: 'Cochera', icon: Car }, { id: 'mascotas', label: 'Mascotas', icon: PawPrint },
    { id: 'recreacion', label: 'Piscina y mirador', icon: Waves }, { id: 'eventos', label: 'Eventos', icon: CalendarCheck },
    { id: 'calendario-eventos', label: 'Calendario de eventos', icon: CalendarDays }, { id: 'encuestas', label: 'Encuestas y lealtad', icon: Star },
  ] },
  { title: 'Administración', items: [
    { id: 'personal', label: 'Personal y turnos', icon: UserCheck }, { id: 'caja', label: 'Caja', icon: CreditCard },
    { id: 'reportes', label: 'Reportes', icon: BarChart3 }, { id: 'cuentas-acceso', label: 'Cuentas de acceso', icon: LockKeyhole }, { id: 'roles', label: 'Roles y permisos', icon: ShieldCheck },
    { id: 'auditoria', label: 'Auditoría y seguridad', icon: LockKeyhole }, { id: 'configuracion', label: 'Configuración', icon: Settings },
  ] },
];

export const VALID_ROUTES = new Set(NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.id)));
export const canAccessRoute = (can, route) => can(permissionForRoute(route));
