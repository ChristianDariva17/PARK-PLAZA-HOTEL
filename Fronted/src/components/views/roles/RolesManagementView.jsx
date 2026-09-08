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
    <form onSubmit={handleSubmit} className="roles-form">
      {/* Cabecera del Rol */}
      <div className="roles-editor-header">
        <div className="roles-editor-name">
          <label className="roles-label roles-label-uppercase">
            Nombre del Rol
          </label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Supervisor de Alojamiento"
            className="roles-input roles-input-name"
          />
        </div>
        <div className="roles-identifier">
          <span className="roles-identifier-label">Identificador</span>
          <code className="roles-identifier-code">
            {role.key}
          </code>
        </div>
      </div>

      {/* Buscador y Controles Rápidos */}
      <div className="roles-search-controls">
        <div className="roles-search-wrap">
          <Search size={15} className="roles-search-icon" />
          <input
            placeholder="Buscar permiso específico (ej. check_in, compras, caja)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="roles-input roles-search-input"
          />
        </div>
        <div className="roles-inline-actions">
          <button type="button" className="btn btn-sm btn-outline" onClick={selectAllSystem}>
            Seleccionar Todos ({ALL_SYSTEM_PERMS.length})
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={clearAll}>
            Desmarcar Todos
          </button>
        </div>
      </div>

      {/* Lista de Módulos y Permisos */}
      <div className="roles-permission-list">
        {filteredModules.map((module) => {
          const modPermKeys = module.permissions.map((p) => p.key);
          const selectedInMod = modPermKeys.filter((k) => selectedPerms.has(k)).length;
          const allModSelected = modPermKeys.length > 0 && selectedInMod === modPermKeys.length;
          const isExpanded = expandedModules.has(module.id);

          return (
            <div key={module.id} className="roles-module">
              {/* Header del Módulo */}
              <div className={`roles-module-header ${selectedInMod > 0 ? 'is-selected' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                onClick={() => toggleModuleAccordion(module.id)}
              >
                <div className="roles-module-heading">
                  <span className="roles-module-icon">{module.icon}</span>
                  <div>
                    <strong className="roles-module-name">{module.name}</strong>
                    <span className="roles-module-count">
                      ({selectedInMod} de {modPermKeys.length} asignados)
                    </span>
                  </div>
                </div>

                <div className="roles-module-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => toggleModuleAll(module)}
                    className={`roles-module-select ${allModSelected ? 'is-selected' : ''}`}
                  >
                    {allModSelected ? '✓ Todo asignado' : 'Seleccionar módulo'}
                  </button>
                </div>
              </div>

              {/* Grid de Permisos del Módulo */}
              {isExpanded && (
                <div className="roles-permission-grid">
                  {module.permissions.map((perm) => {
                    const isChecked = selectedPerms.has(perm.key);
                    return (
                      <div
                        key={perm.key}
                        onClick={() => togglePermission(perm.key)}
                        className={`roles-permission ${isChecked ? 'is-selected' : ''}`}
                      >
                        <div className={`roles-permission-check ${isChecked ? 'is-selected' : ''}`}>
                          {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </div>
                        <div className="roles-permission-content">
                          <div className={`roles-permission-label ${isChecked ? 'is-selected' : ''}`}>
                            {perm.label}
                          </div>
                          <div className="roles-permission-description">
                            {perm.desc}
                          </div>
                          <code className="roles-permission-key">
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
      <div className="roles-form-footer">
        <div className="roles-selected-total">
          Total seleccionados: <span className="badge badge-green roles-selected-badge">{selectedPerms.size} permisos</span>
        </div>
        <div className="roles-form-actions">
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
    <form onSubmit={handleSubmit} className="roles-form">
      <div className="roles-create-fields">
        <div>
          <label className="roles-label">
            Nombre del Nuevo Rol *
          </label>
          <input
            required
            autoFocus
            placeholder="Ej. Seguridad Nocturna"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="roles-input"
          />
        </div>
        <div>
          <label className="roles-label">
            Clave del Rol (código)
          </label>
          <input
            placeholder="ej. seguridad_nocturna"
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            className="roles-input roles-input-key"
          />
        </div>
      </div>

      <div className="roles-template-row">
        <span className="roles-template-label">
          💡 Copiar permisos base desde otro rol:
        </span>
        <select 
          value={templateRole} 
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="roles-template-select"
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
        <div className="roles-selection-header">
          <span className="roles-selection-title">
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

        <div className="roles-create-permission-list">
          {PERMISSION_MODULES.map((mod) => (
            <div key={mod.id} className="roles-create-module">
              <div className="roles-create-module-title">
                <span>{mod.icon}</span> {mod.name}
              </div>
              <div className="roles-create-permission-grid">
                {mod.permissions.map((p) => {
                  const isChecked = selectedPerms.has(p.key);
                  return (
                    <label
                      key={p.key}
                      className={`roles-create-permission ${isChecked ? 'is-selected' : ''}`}
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

      <div className="roles-form-actions roles-create-footer">
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
        <div className="roles-loading-state">
          <div className="roles-loading-spinner"></div>
          <p className="roles-loading-text">Cargando matriz de roles y permisos...</p>
        </div>
      ) : status === 'error' ? (
        <div className="alert-banner alert-banner-danger roles-error-state">
          <span>{error}</span>
          <button className="btn btn-sm btn-outline" onClick={loadData}>Reintentar</button>
        </div>
      ) : (
        <>
          {/* Selector de Modo de Vista */}
          <div className="roles-view-toolbar">
            <div className="roles-view-switcher">
              <button
                type="button"
                className={`btn btn-sm roles-view-button ${viewMode === 'cards' ? 'is-active btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('cards')}
              >
                <Grid size={15} /> Tarjetas de Roles
              </button>
              <button
                type="button"
                className={`btn btn-sm roles-view-button ${viewMode === 'matrix' ? 'is-active btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('matrix')}
              >
                <TableIcon size={15} /> Matriz Comparativa
              </button>
            </div>

            <div className="roles-toolbar-actions">
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
            <div className="roles-card-grid">
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
                    className="card roles-card"
                  >
                    <div>
                      {/* Top Row: Icon, Name & Badges */}
                      <div className="roles-card-top">
                        <div>
                          <div className="roles-card-title">
                            <Shield size={20} color="#0f172a" />
                            <h3 className="roles-card-name">
                              {role.name}
                            </h3>
                          </div>
                          <code className="roles-card-key">
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
                      <div className="roles-card-info">
                        <div>
                          <span className="roles-card-info-label">Usuarios Asignados</span>
                          <strong className="roles-card-info-value">{role.usersCount}</strong> cuenta(s)
                        </div>
                        <div>
                          <span className="roles-card-info-label">Cobertura Permisos</span>
                          <strong className="roles-card-info-value is-success">{permsCount}</strong> / {totalPermissionsCount} ({pct}%)
                        </div>
                      </div>

                      {/* Módulos Habilitados */}
                      <div className="roles-card-modules">
                        <span className="roles-card-section-label">
                          Módulos Habilitados
                        </span>
                        <div className="roles-module-tags">
                          {activeModules.length > 0 ? (
                            activeModules.map((m) => (
                              <span 
                                key={m.id} 
                                className="roles-module-tag"
                              >
                                {m.icon} {m.name.split(' ')[0]}
                              </span>
                            ))
                          ) : (
                            <span className="roles-no-permissions">
                              Sin permisos asignados
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="roles-card-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-primary roles-edit-action"
                        onClick={() => setEditingRole(role)}
                      >
                        <Edit2 size={13} /> Modificar Permisos
                      </button>
                      {!role.isSystem && role.usersCount === 0 && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline roles-delete-action"
                          onClick={() => setDeletingRole(role)}
                          title="Eliminar rol personalizado"
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
            <div className="table-container card roles-matrix-container">
              <table className="custom-table permission-table roles-matrix-table">
                <thead>
                  <tr>
                    <th scope="col" className="roles-matrix-module-heading">Módulo o Alcance</th>
                    {rolesList.map((role) => (
                      <th scope="col" key={role.id} className="roles-matrix-role-heading">
                        <div className="roles-matrix-role-name">{role.name}</div>
                        <small className="roles-matrix-role-users">{role.usersCount} usuario(s)</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MODULES.map((module) => (
                    <tr key={module.id}>
                      <th scope="row" className="roles-matrix-module-cell">
                        <div className="roles-matrix-module-content">
                          <span className="roles-module-icon">{module.icon}</span>
                          <div>
                            <strong>{module.name}</strong>
                            <div className="roles-matrix-module-count">
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
                          <td key={role.id} className="roles-matrix-permission-cell">
                            <button
                              type="button"
                              onClick={() => setEditingRole(role)}
                              title={`Editar permisos de ${role.name}`}
                              className="roles-matrix-permission-button"
                            >
                              <span
                                className={`badge roles-matrix-badge ${isFull ? 'badge-green' : isNone ? 'badge-gray' : 'badge-yellow'}`}
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
          <div className="roles-delete-confirmation">
            <p className="roles-delete-description">
              Esta acción eliminará de forma permanente el rol personalizado <strong>{deletingRole.name}</strong> ({deletingRole.key}) y todas sus asignaciones de permisos.
            </p>
            <div className="alert-banner alert-banner-warning">
              Solo se pueden eliminar roles personalizados que no tengan ninguna cuenta de usuario asignada actualmente.
            </div>
            <div className="roles-delete-actions">
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
