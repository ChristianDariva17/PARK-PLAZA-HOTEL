import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { usePermissions } from '../../../auth/authContext';
import { PERMISSIONS } from '../../../auth/permissions';
import { GUEST_DOCUMENT_TYPES } from '../../../guests/guestModel';
import { useCollectionTable } from '../../../hooks/useCollectionTable';
import { useHotel } from '../../../state/hotelContext';
import { Pagination, RowActions, SortableHeader } from '../../ui/CollectionTable';
import { FormWizard } from '../../ui/FormWizard';
import { Dialog, Drawer } from '../../ui/Overlay';
import { DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';

const EMPTY_CLIENT = {
  firstName: '', lastName: '', birthDate: '', nationality: 'PE', email: '', phone: '', address: '', emergencyContact: '', notes: '',
  primaryDocument: { type: 'dni', issuingCountry: 'PE', documentNumber: '', expiresOn: '' },
};

const COUNTRY_OPTIONS = [
  { code: 'PE', label: '🇵🇪 Perú (PE)' },
  { code: 'US', label: '🇺🇸 Estados Unidos (US)' },
  { code: 'ES', label: '🇪🇸 España (ES)' },
  { code: 'AR', label: '🇦🇷 Argentina (AR)' },
  { code: 'CL', label: '🇨🇱 Chile (CL)' },
  { code: 'CO', label: '🇨🇴 Colombia (CO)' },
  { code: 'MX', label: '🇲🇽 México (MX)' },
  { code: 'BR', label: '🇧🇷 Brasil (BR)' },
  { code: 'EC', label: '🇪🇨 Ecuador (EC)' },
  { code: 'VE', label: '🇻🇪 Venezuela (VE)' },
  { code: 'UY', label: '🇺🇾 Uruguay (UY)' },
  { code: 'BO', label: '🇧🇴 Bolivia (BO)' },
  { code: 'PY', label: '🇵🇾 Paraguay (PY)' },
  { code: 'DE', label: '🇩🇪 Alemania (DE)' },
  { code: 'FR', label: '🇫🇷 Francia (FR)' },
  { code: 'IT', label: '🇮🇹 Italia (IT)' },
  { code: 'GB', label: '🇬🇧 Reino Unido (GB)' },
  { code: 'CA', label: '🇨🇦 Canadá (CA)' },
  { code: 'JP', label: '🇯🇵 Japón (JP)' },
  { code: 'CN', label: '🇨🇳 China (CN)' },
];

function ClientAvatar({ name }) {
  const initials = (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');

  return (
    <div style={{
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #1e293b, #334155)',
      color: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: '600',
      fontSize: '13px',
      flexShrink: 0,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    }}>
      {initials || 'H'}
    </div>
  );
}

function LoyaltyTierBadge({ tier }) {
  const t = (tier || 'Bronce').toLowerCase();
  let bg = 'rgba(205, 127, 50, 0.15)';
  let color = '#d97706';
  let border = '1px solid rgba(205, 127, 50, 0.3)';

  if (t.includes('plata') || t.includes('silver')) {
    bg = 'rgba(148, 163, 184, 0.15)';
    color = '#475569';
    border = '1px solid rgba(148, 163, 184, 0.3)';
  } else if (t.includes('oro') || t.includes('gold')) {
    bg = 'rgba(234, 179, 8, 0.15)';
    color = '#b45309';
    border = '1px solid rgba(234, 179, 8, 0.3)';
  } else if (t.includes('platino') || t.includes('platinum') || t.includes('vip')) {
    bg = 'rgba(168, 85, 247, 0.15)';
    color = '#7e22ce';
    border = '1px solid rgba(168, 85, 247, 0.3)';
  }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      background: bg,
      color: color,
      border: border,
    }}>
      ★ {tier || 'Bronce'}
    </span>
  );
}

function CustomerForm({ client, onClose, notify }) {
  const { guestCommands } = useHotel();
  const { can } = usePermissions();
  const allowed = can(client ? PERMISSIONS.guestsUpdate : PERMISSIONS.guestsCreate);
  const [form, setForm] = useState(() => client ? {
    firstName: client.firstName,
    lastName: client.lastName,
    birthDate: client.birthDate,
    nationality: client.nationality || 'PE',
    email: client.email,
    phone: client.phone,
    address: client.address,
    emergencyContact: client.emergencyContact,
    notes: client.notes,
    primaryDocument: {
      type: client.primaryDocument.type,
      issuingCountry: client.primaryDocument.issuingCountry || 'PE',
      documentNumber: client.primaryDocument.documentNumber,
      expiresOn: client.primaryDocument.expiresOn ?? '',
    },
  } : EMPTY_CLIENT);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const setDocument = (key, value) => setForm((current) => ({ ...current, primaryDocument: { ...current.primaryDocument, [key]: value } }));

  const submit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const saved = client ? await guestCommands.update(client.id, form) : await guestCommands.create(form);
      if (!activeRef.current) return;
      if (!saved) throw new Error('La operación no pudo confirmarse. Revise la información e intente nuevamente.');
      notify(client ? 'Cliente actualizado' : 'Cliente registrado', 'El perfil fue confirmado por el servidor.');
      onClose();
    } catch (error) {
      if (activeRef.current) setSubmitError(error.message || 'No se pudo guardar el cliente.');
    } finally {
      if (activeRef.current) setSubmitting(false);
    }
  };

  const countryLabel = (code) => COUNTRY_OPTIONS.find((c) => c.code === code.toUpperCase())?.label || code.toUpperCase();

  const summary = <DetailGrid compact items={[
    { label: 'Nombre', value: `${form.firstName} ${form.lastName}`.trim() || 'Pendiente' },
    { label: 'Documento', value: `${GUEST_DOCUMENT_TYPES[form.primaryDocument.type]} ${form.primaryDocument.documentNumber || 'Pendiente'}` },
    { label: 'País emisor', value: countryLabel(form.primaryDocument.issuingCountry) },
    { label: 'Contacto', value: form.phone || form.email || 'Pendiente' },
    { label: 'Nacionalidad', value: countryLabel(form.nationality) },
    { label: 'Observaciones', value: form.notes ? (form.notes.length > 30 ? `${form.notes.slice(0, 30)}...` : form.notes) : 'Sin observaciones' },
  ]} />;

  const steps = [
    {
      label: 'Identidad',
      title: 'Identificación del cliente',
      validate: () => !form.primaryDocument.documentNumber.trim() || !form.firstName.trim() || !form.lastName.trim() ? 'Por favor complete el documento, nombres y apellidos.' : '',
      content: (
        <div className="form-grid">
          <label>Tipo de documento
            <select value={form.primaryDocument.type} onChange={(event) => setDocument('type', event.target.value)}>
              {Object.entries(GUEST_DOCUMENT_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>Número de documento
            <input required maxLength="64" placeholder="Ej: 71909900" value={form.primaryDocument.documentNumber} onChange={(event) => setDocument('documentNumber', event.target.value)} />
          </label>
          <label>País emisor
            <select value={form.primaryDocument.issuingCountry} onChange={(event) => setDocument('issuingCountry', event.target.value)}>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </label>
          <label>Fecha de vencimiento
            <input type="date" value={form.primaryDocument.expiresOn} onChange={(event) => setDocument('expiresOn', event.target.value)} />
          </label>
          <label>Nombres
            <input required maxLength="100" placeholder="Ej: Juan Carlos" value={form.firstName} onChange={(event) => set('firstName', event.target.value)} />
          </label>
          <label>Apellidos
            <input required maxLength="100" placeholder="Ej: Pérez Gómez" value={form.lastName} onChange={(event) => set('lastName', event.target.value)} />
          </label>
        </div>
      ),
    },
    {
      label: 'Contacto',
      title: 'Contacto y domicilio',
      validate: () => form.email && !form.email.includes('@') ? 'Ingrese un correo electrónico válido o déjelo vacío.' : '',
      content: (
        <div className="form-grid">
          <label>Teléfono móvil
            <input maxLength="32" placeholder="Ej: +51 987 654 321" value={form.phone} onChange={(event) => set('phone', event.target.value)} />
          </label>
          <label>Correo electrónico
            <input type="email" maxLength="254" placeholder="Ej: cliente@gmail.com" value={form.email} onChange={(event) => set('email', event.target.value)} />
          </label>
          <label className="span-2">Dirección de residencia
            <input maxLength="500" placeholder="Ej: Av. Larco 1234, Miraflores, Lima" value={form.address} onChange={(event) => set('address', event.target.value)} />
          </label>
        </div>
      ),
    },
    {
      label: 'Perfil',
      title: 'Datos complementarios y preferencias',
      content: (
        <div className="form-grid">
          <label>Nacionalidad
            <select value={form.nationality} onChange={(event) => set('nationality', event.target.value)}>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </label>
          <label>Fecha de nacimiento
            <input type="date" value={form.birthDate} onChange={(event) => set('birthDate', event.target.value)} />
          </label>
          <label className="span-2">Contacto de emergencia
            <input maxLength="255" placeholder="Ej: María Pérez (Hermana) - 999 888 777" value={form.emergencyContact} onChange={(event) => set('emergencyContact', event.target.value)} />
          </label>
          <label className="span-2">Observaciones y Preferencias
            <textarea maxLength="2000" placeholder="Ej: Huésped frecuente, solicita piso alto y cama matrimonial." value={form.notes} onChange={(event) => set('notes', event.target.value)} />
          </label>
        </div>
      ),
    },
    {
      label: 'Confirmación',
      title: 'Revisión final del perfil',
      content: (
        <div className="alert-banner alert-banner-info">
          Por favor revise el resumen a la derecha antes de confirmar. Los datos del perfil se guardarán y validarán directamente en el servidor.
        </div>
      ),
    },
  ];

  return <FormWizard steps={steps} summary={summary} onCancel={onClose} onSubmit={submit} submitLabel="Guardar cliente" submitting={submitting} submitError={submitError} submitDisabled={!allowed} />;
}

export default function CustomersView({ notify, navigationIntent, consumeNavigationIntent }) {
  const { state, guestCommands } = useHotel();
  const { can } = usePermissions();
  const canCreate = can(PERMISSIONS.guestsCreate);
  const canUpdate = can(PERMISSIONS.guestsUpdate);
  const [editor, setEditor] = useState(undefined);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.toLowerCase());

  useEffect(() => {
    if (navigationIntent?.type === 'select-record') {
      setSelectedId(navigationIntent.recordId);
      consumeNavigationIntent(navigationIntent.id);
    }
  }, [navigationIntent, consumeNavigationIntent]);

  const records = state.clients.filter((item) => `${item.name} ${item.documentNumber} ${item.email}`.toLowerCase().includes(deferred));
  const table = useCollectionTable(records, 'name', 8, JSON.stringify([deferred, records.map((item) => item.id)]));
  const selected = state.clients.find((item) => item.id === selectedId);
  const editorAllowed = editor === null ? canCreate : canUpdate;
  const columns = [{ key: 'name', label: 'Cliente' }, { key: 'documentNumber', label: 'Documento' }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo' }, { key: 'loyaltyTier', label: 'Fidelización' }, { key: 'status', label: 'Estado' }];
  const loadingWithoutData = state.guestRequest.status === 'loading' && state.clients.length === 0;

  return <div className="view-container">
    <PageHeader metadata="Fidelización y CRM de Huéspedes" title="Clientes y fidelización" description="Gestión de perfiles de huéspedes, preferencias de habitación e historial de estadías." action={canCreate ? <button className="btn btn-primary" onClick={() => setEditor(null)} disabled={state.guestRequest.status === 'loading'}>Registrar cliente</button> : null} />
    <MetricStrip items={[{ label: 'Activos', value: state.clients.filter((item) => item.status !== 'Archivado').length }, { label: 'Archivados', value: state.clients.filter((item) => item.status === 'Archivado').length }, { label: 'Frecuentes / VIP', value: state.clients.filter((item) => item.visits >= 3 || (item.loyaltyTier && item.loyaltyTier !== 'Bronce')).length }]} />
    <div className="filter-bar"><label className="search-label"><Search size={16} /><input aria-label="Buscar clientes" placeholder="Buscar por nombre, documento o correo..." value={query} onChange={(event) => setQuery(event.target.value)} disabled={loadingWithoutData} /></label><span className="filter-result">{records.length} perfiles</span></div>
    {loadingWithoutData ? <div className="alert-banner alert-banner-info" role="status">Cargando huéspedes...</div> : null}
    {state.guestRequest.status === 'error' ? <div className="alert-banner alert-banner-danger" role="alert"><span>{state.guestRequest.error}</span> <button className="btn btn-sm btn-outline" onClick={() => guestCommands.reload().catch(() => {})}>Reintentar</button></div> : null}
    {!loadingWithoutData && table.total ? <section className="card table-container"><table className="custom-table"><caption>Directorio de huéspedes verificados</caption><thead><tr>{columns.map((column) => <SortableHeader key={column.key} column={column} sort={table.sort} onSort={table.toggleSort} />)}<th scope="col">Acciones</th></tr></thead><tbody>{table.visible.map((client) => <tr key={client.id}><td><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><ClientAvatar name={client.name} /><div><strong style={{ fontSize: '14px', color: 'var(--text-main, #0f172a)' }}>{client.name}</strong>{client.nationality ? <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>🌐 Nacionalidad: {client.nationality.toUpperCase()}</div> : null}</div></div></td><td><strong>{client.documentType}</strong> {client.documentNumber}</td><td>{client.phone || 'No registrado'}</td><td>{client.email || 'No registrado'}</td><td><LoyaltyTierBadge tier={client.loyaltyTier} /></td><td><StatusBadge>{client.status || 'Activo'}</StatusBadge></td><td><RowActions label={client.name}><button role="menuitem" onClick={() => setSelectedId(client.id)}>Ver perfil completo</button>{canUpdate && client.status !== 'Archivado' ? <button role="menuitem" onClick={() => setEditor(client)}>Editar</button> : null}</RowActions></td></tr>)}</tbody></table><Pagination page={table.page} pageCount={table.pageCount} total={table.total} pageSize={table.pageSize} onPage={table.setPage} /></section> : null}
    {!loadingWithoutData && state.guestRequest.status === 'success' && !table.total ? <EmptyState title={query ? 'Sin coincidencias' : 'Sin huéspedes registrados'} description={query ? 'No hay perfiles que coincidan con la búsqueda.' : 'Registre el primer huésped para comenzar.'} /> : null}
    <Drawer open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected?.name || 'Cliente'} description={selected ? `${selected.documentType} ${selected.documentNumber}` : ''}>{selected ? <DetailGrid items={[{ label: 'Teléfono', value: selected.phone || 'No registrado' }, { label: 'Correo', value: selected.email || 'No registrado' }, { label: 'Dirección', value: selected.address || 'No registrada' }, { label: 'Nacionalidad', value: selected.nationality || 'No registrada' }, { label: 'País emisor', value: selected.issuingCountry }, { label: 'Nacimiento', value: selected.birthDate || 'No registrado' }, { label: 'Emergencia', value: selected.emergencyContact || 'No registrado' }, { label: 'Observaciones', value: selected.notes || 'Sin observaciones' }]} /> : null}</Drawer>
    <Dialog open={editor !== undefined && editorAllowed} onClose={() => setEditor(undefined)} title={editor ? 'Editar cliente' : 'Registrar cliente'} description="Los datos se validarán y guardarán en el servidor." wide>{editor !== undefined && editorAllowed ? <CustomerForm client={editor} onClose={() => setEditor(undefined)} notify={notify} /> : null}</Dialog>
  </div>;
}
