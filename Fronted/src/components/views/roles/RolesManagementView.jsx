import { useState, useEffect, useMemo } from 'react';
import { getRoles, getPermissions, createRole, updateRole, deleteRole } from '../../../auth/rolesClient';
import { getAccounts } from '../../../auth/accountsClient';
import { 
  Shield, Plus, Edit2, Trash2, Check, Search, Users, 
  Lock, CheckSquare, Square, RefreshCw, Layers, Grid, Table as TableIcon
} from 'lucide-react';
import { Dialog } from '../../ui/Overlay';
import { MetricStrip, PageHeader, SectionHeader, StatusBadge, EmptyState } from '../SharedViewParts';

export const PERMISSION_MODULES = [
  {
    id: 'reception',
    name: 'Recepción y Habitaciones',
    icon: '🏨',
    description: 'Reservas, check-in/out, huéspedes, habitaciones y contratos',
    prefixes: ['rooms.', 'reservations.', 'stays.', 'guests.', 'contracts.'],
    permissions: [
      { key: 'rooms.read', label: 'Ver habitaciones', desc: 'Consultar estado e inventario de habitaciones' },
      { key: 'rooms.manage', label: 'Gestionar habitaciones', desc: 'Crear y administrar habitaciones' },
      { key: 'rooms.update', label: 'Modificar habitaciones', desc: 'Editar categorías y datos de habitaciones' },
      { key: 'rooms.block', label: 'Bloquear habitaciones', desc: 'Bloquear y desbloquear habitaciones por mantenimiento' },
      { key: 'reservations.read', label: 'Ver reservas', desc: 'Consultar reservas confirmadas y fechas' },
      { key: 'reservations.create', label: 'Crear reservas', desc: 'Registrar nuevas reservas en el sistema' },
      { key: 'reservations.update', label: 'Modificar reservas', desc: 'Editar datos o fechas de reservas' },
      { key: 'reservations.cancel', label: 'Cancelar reservas', desc: 'Anular o expirar reservas' },
      { key: 'stays.read', label: 'Ver estadías', desc: 'Monitorear huéspedes alojados' },
      { key: 'stays.check_in', label: 'Realizar Check-in', desc: 'Registrar ingreso y entrega de llaves' },
      { key: 'stays.check_out', label: 'Realizar Check-out', desc: 'Completar salida y cierre de estadía' },
      { key: 'guests.read', label: 'Ver huéspedes', desc: 'Consultar perfiles y documentos de huéspedes' },
      { key: 'guests.create', label: 'Registrar huéspedes', desc: 'Crear fichas de clientes y huéspedes' },
      { key: 'guests.update', label: 'Modificar huéspedes', desc: 'Actualizar datos de clientes' },
      { key: 'contracts.read', label: 'Ver contratos', desc: 'Visualizar contratos de hospedaje y firmas' },
      { key: 'contracts.amend', label: 'Adendas de contrato', desc: 'Generar modificaciones y adendas' },
    ],
  },
  {
    id: 'restaurant',
    name: 'Restaurante, Cocina y Bar',
    icon: '🍽️',
    description: 'Comandas de salón y room service, recetas, insumos y compras',
    prefixes: ['orders.', 'kitchen.', 'inventory.', 'suppliers.'],
    permissions: [
      { key: 'orders.read', label: 'Ver comandas', desc: 'Visualizar comandas activas e históricas' },
      { key: 'orders.create', label: 'Crear pedidos', desc: 'Registrar órdenes de restaurante o room service' },
      { key: 'orders.update', label: 'Modificar pedidos', desc: 'Editar ítems o notas de comanda' },
      { key: 'orders.advance', label: 'Avanzar comanda', desc: 'Preparar, despachar y liquidar pedidos' },
      { key: 'orders.cancel', label: 'Cancelar pedidos', desc: 'Anular comandas de cocina o bar' },
      { key: 'kitchen.read', label: 'Ver recetas', desc: 'Consultar recetas, costos y cartas' },
      { key: 'kitchen.create', label: 'Crear recetas', desc: 'Registrar nuevos platos y cócteles' },
      { key: 'kitchen.update', label: 'Editar recetas', desc: 'Modificar ingredientes y precios de venta' },
      { key: 'inventory.read', label: 'Ver inventario', desc: 'Consultar stock e insumos disponibles' },
      { key: 'inventory.create', label: 'Registrar ingresos', desc: 'Crear lotes y registrar existencias' },
      { key: 'inventory.update', label: 'Ajustar inventario', desc: 'Modificar existencias y mermas' },
      { key: 'suppliers.read', label: 'Ver proveedores', desc: 'Consultar directorio de proveedores' },
      { key: 'suppliers.create', label: 'Crear proveedores', desc: 'Registrar nuevos proveedores' },
      { key: 'suppliers.update', label: 'Modificar proveedores', desc: 'Editar datos de contacto y entrega' },
    ],
  },
  {
    id: 'cleaning_maintenance',
    name: 'Limpieza y Mantenimiento',
    icon: '🧹',
    description: 'Asignación de camareras, inspección de habitaciones, tickets e incidencias',
    prefixes: ['cleaning.', 'maintenance.', 'incidents.', 'evidence.'],
    permissions: [
      { key: 'cleaning.read', label: 'Ver limpieza', desc: 'Consultar tablero de habitaciones y tareas' },
      { key: 'cleaning.assign', label: 'Asignar limpieza', desc: 'Asignar camareras a pisos y habitaciones' },
      { key: 'cleaning.progress', label: 'Aprobar limpieza', desc: 'Avanzar y liberar habitación limpia' },
      { key: 'cleaning.report_incident', label: 'Reportar daños', desc: 'Generar incidencia desde limpieza' },
      { key: 'maintenance.read', label: 'Ver mantenimiento', desc: 'Consultar tickets técnicos y reparaciones' },
      { key: 'maintenance.create', label: 'Crear tickets', desc: 'Abrir solicitudes de mantenimiento' },
      { key: 'maintenance.update', label: 'Gestionar tickets', desc: 'Asignar técnicos y registrar soluciones' },
      { key: 'incidents.read', label: 'Ver incidencias', desc: 'Consultar libro de novedades y problemas' },
      { key: 'incidents.create', label: 'Reportar incidencias', desc: 'Registrar novedades o reclamos' },
      { key: 'incidents.update', label: 'Resolver incidencias', desc: 'Asignar y cerrar incidencias' },
      { key: 'evidence.read', label: 'Galería de evidencias', desc: 'Auditar fotos y registros de inspección' },
    ],
  },
  {
    id: 'recreation_amenities',
    name: 'Zonas Recreativas y Amenidades',
    icon: '🏊',
    description: 'Piscina, Mirador, salones para eventos, cochera y mascotas',
    prefixes: ['recreation.', 'events.', 'parking.', 'pets.'],
    permissions: [
      { key: 'recreation.read', label: 'Ver reservas amenidades', desc: 'Consultar reservas de piscina y mirador' },
      { key: 'recreation.sell', label: 'Cobrar amenidades', desc: 'Vender y liquidar cuentas de piscina/mirador' },
      { key: 'recreation.scan', label: 'Escanear QR acceso', desc: 'Validar entradas y salidas en zonas' },
      { key: 'events.read', label: 'Ver eventos', desc: 'Consultar reservas de salones de eventos' },
      { key: 'events.create', label: 'Crear eventos', desc: 'Registrar cotizaciones y reservas de salón' },
      { key: 'events.confirm', label: 'Confirmar eventos', desc: 'Aprobar contratos de salones' },
      { key: 'parking.read', label: 'Ver cochera', desc: 'Consultar espacios y vehículos estacionados' },
      { key: 'parking.create', label: 'Registrar vehículo', desc: 'Registrar ingreso de autos a la cochera' },
      { key: 'parking.exit', label: 'Salida de vehículo', desc: 'Registrar salida y cobro de cochera' },
      { key: 'pets.read', label: 'Ver mascotas', desc: 'Consultar registro de mascotas autorizadas' },
      { key: 'pets.create', label: 'Registrar mascotas', desc: 'Ingresar mascotas y cargos de estadía' },
    ],
  },
  {
    id: 'cash_finance',
    name: 'Caja y Finanzas',
    icon: '💵',
    description: 'Arqueos de caja, cobro de folios, auditoría y reportes operacionales',
    prefixes: ['cash.', 'finance.', 'reports.'],
    permissions: [
      { key: 'cash.read', label: 'Ver caja', desc: 'Consultar sesiones de caja y arqueos' },
      { key: 'cash.open', label: 'Aperturar caja', desc: 'Abrir turno de caja con monto inicial' },
      { key: 'cash.move', label: 'Movimientos de caja', desc: 'Insertar ingresos y egresos extraordinarios' },
      { key: 'cash.count', label: 'Arqueo de caja', desc: 'Realizar conteo físico de billetes y monedas' },
      { key: 'cash.close', label: 'Cerrar caja', desc: 'Finalizar turno y liquidar sesión de caja' },
      { key: 'finance.read', label: 'Ver folios y cuentas', desc: 'Consultar estado de cuenta de huéspedes' },
      { key: 'finance.charge', label: 'Cargar consumos', desc: 'Imputar consumos y penalidades a folios' },
      { key: 'finance.payment', label: 'Registrar cobros', desc: 'Procesar pagos y liquidar saldos' },
      { key: 'reports.read', label: 'Ver reportes', desc: 'Consultar reportes operacionales y métricas' },
    ],
  },
  {
    id: 'admin_security',
    name: 'Administración y Seguridad',
    icon: '🔐',
    description: 'Usuarios, roles, directorio de personal, bitácora y configuración',
    prefixes: ['staff.', 'accounts.', 'roles.', 'audit.', 'settings.', 'dashboard.'],
    permissions: [
      { key: 'dashboard.read', label: 'Ver dashboard', desc: 'Acceso a métricas y resumen general' },
      { key: 'staff.read', label: 'Ver personal', desc: 'Consultar directorio de colaboradores' },
      { key: 'staff.create', label: 'Crear personal', desc: 'Registrar nuevos colaboradores' },
      { key: 'staff.update', label: 'Modificar personal', desc: 'Editar cargos y datos de colaboradores' },
      { key: 'staff.attendance', label: 'Asistencia y turnos', desc: 'Registrar marcaciones y horarios' },
      { key: 'accounts.read', label: 'Ver cuentas de acceso', desc: 'Consultar usuarios y credenciales' },
      { key: 'accounts.manage', label: 'Gestionar cuentas', desc: 'Crear usuarios y resetear contraseñas' },
      { key: 'roles.read', label: 'Ver roles y permisos', desc: 'Consultar matriz de permisos' },
      { key: 'roles.manage', label: 'Gestionar roles', desc: 'Crear roles y modificar permisos' },
      { key: 'audit.read', label: 'Bitácora de auditoría', desc: 'Revisar registro de actividades de seguridad' },
      { key: 'settings.read', label: 'Ver configuración', desc: 'Consultar parámetros generales del hotel' },
    ],
  },
];

const ALL_SYSTEM_PERMS = PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.key));

function RoleEditorModal({ role, onClose, onSave, saving }) {
  const [name, setName] = useState(role?.name || '');
  const [selectedPerms, setSelectedPerms] = useState(() => new Set(role?.permissions || []));
  const [search, setSearch] = useState('');
  const [expandedModules, setExpandedModules] = useState(() => new Set(PERMISSION_MODULES.map(m => m.id)));

  const toggleModuleAccordion = (modId) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  };

  const togglePermission = (permKey) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(permKey)) next.delete(permKey);
      else next.add(permKey);
      return next;
    });
  };

  const toggleModuleAll = (module) => {
    const modPermKeys = module.permissions.map((p) => p.key);
    const allSelected = modPermKeys.every((k) => selectedPerms.has(k));
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        modPermKeys.forEach((k) => next.delete(k));
      } else {
        modPermKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const selectAllSystem = () => {
    setSelectedPerms(new Set(ALL_SYSTEM_PERMS));
  };

  const clearAll = () => {
    setSelectedPerms(new Set());
  };

  const filteredModules = useMemo(() => {
    if (!search.trim()) return PERMISSION_MODULES;
    const term = search.toLowerCase();
    return PERMISSION_MODULES.map((m) => {
      const matchingPerms = m.permissions.filter(
        (p) => p.key.toLowerCase().includes(term) || p.label.toLowerCase().includes(term) || p.desc.toLowerCase().includes(term)
      );
      return { ...m, permissions: matchingPerms };
    }).filter((m) => m.permissions.length > 0);
  }, [search]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      permissions: Array.from(selectedPerms),
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Cabecera del Rol */}
      <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1, marginRight: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            Nombre del Rol
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Supervisor de Alojamiento"
            style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '14px', fontWeight: '600' }}
          />
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Identificador</span>
          <code style={{ background: '#e2e8f0', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
            {role.key}
          </code>
        </div>
      </div>

      {/* Buscador y Controles Rápidos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            placeholder="Buscar permiso específico (ej. check_in, compras, caja)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', height: '38px', borderRadius: '10px', border: '1px solid #cbd5e1', paddingLeft: '34px', fontSize: '13px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-sm btn-outline" onClick={selectAllSystem}>
            Seleccionar Todos ({ALL_SYSTEM_PERMS.length})
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={clearAll}>
            Desmarcar Todos
          </button>
        </div>
      </div>

      {/* Lista de Módulos y Permisos */}
      <div style={{ maxHeight: '52vh', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredModules.map((module) => {
          const modPermKeys = module.permissions.map((p) => p.key);
          const selectedInMod = modPermKeys.filter((k) => selectedPerms.has(k)).length;
          const allModSelected = modPermKeys.length > 0 && selectedInMod === modPermKeys.length;
          const isExpanded = expandedModules.has(module.id);

          return (
            <div key={module.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
              {/* Header del Módulo */}
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '10px 14px', 
                  background: selectedInMod > 0 ? '#f0fdf4' : '#f8fafc',
                  borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                  cursor: 'pointer',
                }}
                onClick={() => toggleModuleAccordion(module.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>{module.icon}</span>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{module.name}</strong>
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
                      ({selectedInMod} de {modPermKeys.length} asignados)
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => toggleModuleAll(module)}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: '600',
                      background: allModSelected ? '#0f172a' : '#fff',
                      color: allModSelected ? '#fff' : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {allModSelected ? '✓ Todo asignado' : 'Seleccionar módulo'}
                  </button>
                </div>
              </div>

              {/* Grid de Permisos del Módulo */}
              {isExpanded && (
                <div style={{ padding: '12px 14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px', background: '#fff' }}>
                  {module.permissions.map((perm) => {
                    const isChecked = selectedPerms.has(perm.key);
                    return (
                      <div
                        key={perm.key}
                        onClick={() => togglePermission(perm.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: isChecked ? '1px solid #10b981' : '1px solid #f1f5f9',
                          background: isChecked ? '#f0fdf4' : '#fafafa',
                          cursor: 'pointer',
                          transition: 'all 120ms ease',
                        }}
                      >
                        <div style={{ marginTop: '2px', color: isChecked ? '#10b981' : '#94a3b8' }}>
                          {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: '700', color: isChecked ? '#065f46' : '#1e293b' }}>
                            {perm.label}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', lineHeight: 1.2 }}>
                            {perm.desc}
                          </div>
                          <code style={{ fontSize: '9.5px', color: '#94a3b8', marginTop: '2px', display: 'inline-block' }}>
                            {perm.key}
                          </code>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barra de Acciones Final */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
        <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700' }}>
          Total seleccionados: <span className="badge badge-green" style={{ marginLeft: '4px' }}>{selectedPerms.size} permisos</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando cambios...' : 'Guardar Permisos del Rol'}
          </button>
        </div>
      </div>
    </form>
  );
}

function RoleCreateModal({ onClose, onCreated, notify, existingRoles }) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [selectedPerms, setSelectedPerms] = useState(new Set());
  const [templateRole, setTemplateRole] = useState('');
  const [saving, setSaving] = useState(false);

  const handleNameChange = (val) => {
    setName(val);
    const autoKey = val.toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    setKey(autoKey);
  };

  const handleTemplateChange = (roleKey) => {
    setTemplateRole(roleKey);
    if (!roleKey) return;
    const found = existingRoles.find((r) => r.key === roleKey);
    if (found?.permissions) {
      setSelectedPerms(new Set(found.permissions));
    }
  };

  const togglePermission = (permKey) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(permKey)) next.delete(permKey);
      else next.add(permKey);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const newRole = await createRole({
        name: name.trim(),
        key: key.trim() || undefined,
        permissions: Array.from(selectedPerms),
      });
      notify('Rol creado con éxito', `El rol "${newRole.name}" quedó registrado y listo para asignar a usuarios.`, 'success');
      onCreated(newRole);
      onClose();
    } catch (err) {
      notify('Error al crear rol', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
            Nombre del Nuevo Rol *
          </label>
          <input
            required
            autoFocus
            placeholder="Ej. Seguridad Nocturna"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13.5px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
            Clave del Rol (código)
          </label>
          <input
            placeholder="ej. seguridad_nocturna"
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            style={{ width: '100%', height: '40px', borderRadius: '10px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '13px', fontFamily: 'monospace' }}
          />
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: '600' }}>
          💡 Copiar permisos base desde otro rol:
        </span>
        <select 
          value={templateRole} 
          onChange={(e) => handleTemplateChange(e.target.value)}
          style={{ height: '34px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12.5px', background: '#fff' }}
        >
          <option value="">(En blanco / Personalizado)</option>
          {existingRoles.map((r) => (
            <option key={r.key} value={r.key}>
              Copiar de {r.name} ({r.permissions?.length || 0} permisos)
            </option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: '#475569' }}>
            Selección Inicial de Permisos ({selectedPerms.size} marcados)
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setSelectedPerms(new Set(ALL_SYSTEM_PERMS))}
          >
            Marcar Todos
          </button>
        </div>

        <div style={{ maxHeight: '40vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px', background: '#fff' }}>
          {PERMISSION_MODULES.map((mod) => (
            <div key={mod.id} style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{mod.icon}</span> {mod.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
                {mod.permissions.map((p) => {
                  const isChecked = selectedPerms.has(p.key);
                  return (
                    <label
                      key={p.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11.5px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: isChecked ? '#f0fdf4' : '#fafafa',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePermission(p.key)}
                      />
                      <span>{p.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
          {saving ? 'Creando rol...' : 'Crear y Guardar Rol'}
        </button>
      </div>
    </form>
  );
}

export function RolesManagementView({ notify }) {
  const [rolesList, setRolesList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'matrix'
  const [editingRole, setEditingRole] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingRole, setDeletingRole] = useState(null);

  const loadData = async () => {
    try {
      setStatus('loading');
      setError(null);
      const [rolesRes, accountsRes] = await Promise.all([getRoles(), getAccounts()]);
      const rolesArr = Array.isArray(rolesRes) ? rolesRes : [];
      const accountsArr = Array.isArray(accountsRes?.accounts) ? accountsRes.accounts : [];

      const enriched = rolesArr.map((r) => ({
        ...r,
        permissions: Array.isArray(r.permissions) ? r.permissions : [],
        usersCount: accountsArr.filter((a) => a.role?.key === r.key).length,
      }));

      setRolesList(enriched);
      setAccountsList(accountsArr);
      setStatus('ready');
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los roles y permisos.');
      setStatus('error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateRole = async (updatedData) => {
    if (!editingRole) return;
    setSaving(true);
    try {
      await updateRole(editingRole.id, updatedData);
      notify('Rol actualizado', `Se actualizaron los permisos y datos del rol "${updatedData.name || editingRole.name}".`, 'success');
      setEditingRole(null);
      await loadData();
    } catch (err) {
      notify('Error al actualizar rol', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    setSaving(true);
    try {
      await deleteRole(deletingRole.id);
      notify('Rol eliminado', `El rol "${deletingRole.name}" fue eliminado del sistema.`, 'success');
      setDeletingRole(null);
      await loadData();
    } catch (err) {
      notify('Error al eliminar rol', err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const totalPermissionsCount = ALL_SYSTEM_PERMS.length;

  return (
    <div className="view-container">
      <PageHeader
        metadata="Administración dinámica de accesos y seguridad"
        title="Roles y permisos"
        description="Configure los roles de los colaboradores, cree perfiles personalizados y gestione qué acciones y módulos están permitidos."
        actionType="ROLE_CREATE"
        action={
          <button className="btn btn-primary" onClick={() => setIsCreating(true)}>
            <Plus size={16} /> Crear Nuevo Rol
          </button>
        }
      />

      <MetricStrip
        items={[
          { label: 'Roles Configurados', value: rolesList.length },
          { label: 'Roles del Sistema', value: rolesList.filter((r) => r.isSystem).length },
          { label: 'Roles Personalizados', value: rolesList.filter((r) => !r.isSystem).length },
          { label: 'Cuentas con Rol', value: accountsList.length },
          { label: 'Permisos en Catálogo', value: totalPermissionsCount },
        ]}
      />

      {status === 'loading' ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ display: 'inline-block', width: '30px', height: '30px', border: '3px solid #cbd5e1', borderTopColor: '#0f172a', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '12px' }}></div>
          <p style={{ margin: 0, fontSize: '13.5px' }}>Cargando matriz de roles y permisos...</p>
        </div>
      ) : status === 'error' ? (
        <div className="alert-banner alert-banner-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button className="btn btn-sm btn-outline" onClick={loadData}>Reintentar</button>
        </div>
      ) : (
        <>
          {/* Selector de Modo de Vista */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('cards')}
              >
                <Grid size={15} /> Tarjetas de Roles
              </button>
              <button
                type="button"
                className={`btn btn-sm ${viewMode === 'matrix' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('matrix')}
              >
                <TableIcon size={15} /> Matriz Comparativa
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => setIsCreating(true)}
              >
                <Plus size={14} /> Crear Nuevo Rol
              </button>
              <button className="btn btn-sm btn-outline" onClick={loadData}>
                <RefreshCw size={14} /> Refrescar
              </button>
            </div>
          </div>

          {/* VISTA 1: TARJETAS DE ROLES */}
          {viewMode === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {rolesList.map((role) => {
                const permsCount = role.permissions?.length || 0;
                const pct = Math.round((permsCount / totalPermissionsCount) * 100);

                // Módulos que tienen al menos 1 permiso concedido
                const activeModules = PERMISSION_MODULES.filter((m) =>
                  m.permissions.some((p) => role.permissions?.includes(p.key) || role.permissions?.includes('*'))
                );

                return (
                  <article 
                    key={role.id} 
                    className="card"
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'space-between', 
                      padding: '20px', 
                      borderRadius: '16px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                      background: '#fff'
                    }}
                  >
                    <div>
                      {/* Top Row: Icon, Name & Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={20} color="#0f172a" />
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                              {role.name}
                            </h3>
                          </div>
                          <code style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'inline-block' }}>
                            {role.key}
                          </code>
                        </div>

                        {role.isSystem ? (
                          <span className="badge badge-gray" title="Rol predefinido del sistema">
                            <Lock size={10} /> Sistema
                          </span>
                        ) : (
                          <span className="badge badge-gold" title="Rol personalizado creado por el hotel">
                            Personalizado
                          </span>
                        )}
                      </div>

                      {/* Info Strip */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: '#f8fafc', borderRadius: '10px', marginBottom: '14px', fontSize: '12px' }}>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Usuarios Asignados</span>
                          <strong style={{ color: '#0f172a', fontSize: '14px' }}>{role.usersCount}</strong> cuenta(s)
                        </div>
                        <div>
                          <span style={{ color: '#64748b', display: 'block', fontSize: '10.5px' }}>Cobertura Permisos</span>
                          <strong style={{ color: '#10b981', fontSize: '14px' }}>{permsCount}</strong> / {totalPermissionsCount} ({pct}%)
                        </div>
                      </div>

                      {/* Módulos Habilitados */}
                      <div style={{ marginBottom: '16px' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                          Módulos Habilitados
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {activeModules.length > 0 ? (
                            activeModules.map((m) => (
                              <span 
                                key={m.id} 
                                style={{ 
                                  fontSize: '11px', 
                                  padding: '3px 8px', 
                                  borderRadius: '6px', 
                                  background: '#f1f5f9', 
                                  color: '#334155', 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '4px' 
                                }}
                              >
                                {m.icon} {m.name.split(' ')[0]}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                              Sin permisos asignados
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => setEditingRole(role)}
                        style={{ flex: 1 }}
                      >
                        <Edit2 size={13} /> Modificar Permisos
                      </button>
                      {!role.isSystem && role.usersCount === 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => setDeletingRole(role)}
                          title="Eliminar rol personalizado"
                          style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* VISTA 2: MATRIZ COMPARATIVA DE PERMISOS */}
          {viewMode === 'matrix' && (
            <div className="table-container card" style={{ borderRadius: '16px', overflow: 'hidden' }}>
              <table className="custom-table permission-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th scope="col" style={{ minWidth: '220px' }}>Módulo o Alcance</th>
                    {rolesList.map((role) => (
                      <th scope="col" key={role.id} style={{ textAlign: 'center', minWidth: '130px' }}>
                        <div style={{ fontWeight: '800', color: '#0f172a' }}>{role.name}</div>
                        <small style={{ color: '#64748b' }}>{role.usersCount} usuario(s)</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MODULES.map((module) => (
                    <tr key={module.id}>
                      <th scope="row" style={{ background: '#fafafa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '18px' }}>{module.icon}</span>
                          <div>
                            <strong>{module.name}</strong>
                            <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 'normal' }}>
                              {module.permissions.length} permisos
                            </div>
                          </div>
                        </div>
                      </th>
                      {rolesList.map((role) => {
                        const modPermKeys = module.permissions.map((p) => p.key);
                        const assignedInMod = modPermKeys.filter((k) => role.permissions?.includes(k) || role.permissions?.includes('*')).length;
                        const isFull = assignedInMod === modPermKeys.length;
                        const isNone = assignedInMod === 0;

                        return (
                          <td key={role.id} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <button
                              type="button"
                              onClick={() => setEditingRole(role)}
                              title={`Editar permisos de ${role.name}`}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '12px',
                              }}
                            >
                              <span
                                className={`badge ${
                                  isFull ? 'badge-green' : isNone ? 'badge-gray' : 'badge-yellow'
                                }`}
                                style={{ fontSize: '11px', padding: '4px 10px' }}
                              >
                                {isFull ? '✓ Completo' : isNone ? 'No asignado' : `${assignedInMod} / ${modPermKeys.length}`}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal de Edición de Permisos y Rol */}
      <Dialog
        open={Boolean(editingRole)}
        onClose={() => setEditingRole(null)}
        title={editingRole ? `Gestión de Permisos: ${editingRole.name}` : 'Editar Rol'}
        description="Active o desactive los permisos por módulo funcional para este rol."
        wide
      >
        {editingRole && (
          <RoleEditorModal
            role={editingRole}
            onClose={() => setEditingRole(null)}
            onSave={handleUpdateRole}
            saving={saving}
          />
        )}
      </Dialog>

      {/* Modal de Creación de Nuevo Rol */}
      <Dialog
        open={isCreating}
        onClose={() => setIsCreating(false)}
        title="Crear Nuevo Rol de Usuario"
        description="Defina el nombre del rol y configure los permisos iniciales que tendrán los usuarios asociados."
        wide
      >
        <RoleCreateModal
          onClose={() => setIsCreating(false)}
          onCreated={() => loadData()}
          notify={notify}
          existingRoles={rolesList}
        />
      </Dialog>

      {/* Modal de Confirmación de Eliminación */}
      <Dialog
        open={Boolean(deletingRole)}
        onClose={() => setDeletingRole(null)}
        title={`¿Eliminar el rol "${deletingRole?.name}"?`}
      >
        {deletingRole && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#475569' }}>
              Esta acción eliminará de forma permanente el rol personalizado <strong>{deletingRole.name}</strong> ({deletingRole.key}) y todas sus asignaciones de permisos.
            </p>
            <div className="alert-banner alert-banner-warning">
              Solo se pueden eliminar roles personalizados que no tengan ninguna cuenta de usuario asignada actualmente.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setDeletingRole(null)} disabled={saving}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteRole} disabled={saving}>
                {saving ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default RolesManagementView;
