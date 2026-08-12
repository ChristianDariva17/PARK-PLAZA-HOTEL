import { useDeferredValue, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useCollectionTable } from '../../../hooks/useCollectionTable';
import { useHotel } from '../../../state/hotelContext';
import { Pagination, RowActions, SortableHeader } from '../../ui/CollectionTable';
import { executeWithFeedback } from '../../ui/actionFeedback';
import { FormWizard } from '../../ui/FormWizard';
import { Dialog, Drawer } from '../../ui/Overlay';
import { DetailGrid, EmptyState, MetricStrip, PageHeader, StatusBadge } from '../SharedViewParts';

const EMPTY_CLIENT = { documentType: 'DNI', documentNumber: '', firstName: '', lastName: '', phone: '', email: '', address: '', nationality: 'Peruana', birthDate: '', emergencyContact: '', notes: '' };

function CustomerForm({ client, onClose, notify }) {
  const { execute } = useHotel();
  const [form, setForm] = useState(client ? { ...client } : EMPTY_CLIENT);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    const action = client ? { type: 'CLIENT_UPDATE', clientId: client.id, changes: form } : { type: 'CLIENT_CREATE', payload: form };
    if (executeWithFeedback(execute, action, notify, { title: client ? 'Cliente actualizado' : 'Cliente registrado', message: 'El perfil quedó validado y auditado.' })) onClose();
  };
  const summary = <DetailGrid compact items={[{ label: 'Nombre', value: `${form.firstName} ${form.lastName}`.trim() || 'Pendiente' }, { label: 'Documento', value: `${form.documentType} ${form.documentNumber || 'Pendiente'}` }, { label: 'Contacto', value: form.phone || form.email || 'Pendiente' }, { label: 'Nacionalidad', value: form.nationality }, { label: 'Emergencia', value: form.emergencyContact || 'No registrada' }, { label: 'Observaciones', value: form.notes || 'Sin observaciones' }]} />;
  const steps = [
    { label: 'Identidad', title: 'Identificación del cliente', validate: () => !form.documentNumber.trim() || !form.firstName.trim() || !form.lastName.trim() ? 'Completá documento, nombres y apellidos.' : '', content: <div className="form-grid"><label>Tipo de documento<select value={form.documentType} onChange={(event) => set('documentType', event.target.value)}><option>DNI</option><option>Carnet de extranjería</option><option>Pasaporte</option></select></label><label>Número<input value={form.documentNumber} onChange={(event) => set('documentNumber', event.target.value)} /></label><label>Nombres<input value={form.firstName} onChange={(event) => set('firstName', event.target.value)} /></label><label>Apellidos<input value={form.lastName} onChange={(event) => set('lastName', event.target.value)} /></label></div> },
    { label: 'Contacto', title: 'Contacto y domicilio', validate: () => form.email && !form.email.includes('@') ? 'Ingresá un correo válido o dejalo vacío.' : '', content: <div className="form-grid"><label>Teléfono<input value={form.phone} onChange={(event) => set('phone', event.target.value)} /></label><label>Correo<input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} /></label><label className="span-2">Dirección<input value={form.address} onChange={(event) => set('address', event.target.value)} /></label></div> },
    { label: 'Perfil', title: 'Datos complementarios', content: <div className="form-grid"><label>Nacionalidad<input value={form.nationality} onChange={(event) => set('nationality', event.target.value)} /></label><label>Fecha de nacimiento<input type="date" value={form.birthDate} onChange={(event) => set('birthDate', event.target.value)} /></label><label className="span-2">Contacto de emergencia<input value={form.emergencyContact} onChange={(event) => set('emergencyContact', event.target.value)} /></label><label className="span-2">Observaciones<textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} /></label></div> },
    { label: 'Confirmación', title: 'Revisá el perfil', content: <div className="alert-banner alert-banner-info">El perfil sólo se cerrará cuando la validación central acepte la operación.</div> },
  ];
  return <FormWizard steps={steps} summary={summary} onCancel={onClose} onSubmit={submit} submitLabel="Guardar cliente" />;
}

export default function CustomersView({ notify, navigationIntent, consumeNavigationIntent }) {
  const { state, execute } = useHotel();
  const [editor, setEditor] = useState(undefined);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.toLowerCase());
  useEffect(() => { if (navigationIntent?.type === 'select-record') { setSelectedId(navigationIntent.recordId); consumeNavigationIntent(navigationIntent.id); } }, [navigationIntent, consumeNavigationIntent]);
  const records = state.clients.filter((item) => `${item.name} ${item.documentNumber} ${item.email}`.toLowerCase().includes(deferred));
  const table = useCollectionTable(records, 'name', 8, JSON.stringify([deferred, records.map((item) => item.id)]));
  const selected = state.clients.find((item) => item.id === selectedId);
  const transition = (client) => executeWithFeedback(execute, { type: client.status === 'Archivado' ? 'CLIENT_REACTIVATE' : 'CLIENT_ARCHIVE', clientId: client.id, reason: 'Acción contextual desde listado de clientes' }, notify, { title: client.status === 'Archivado' ? 'Cliente reactivado' : 'Cliente archivado', message: 'El historial y sus relaciones se conservaron.' });
  const columns = [{ key: 'name', label: 'Cliente' }, { key: 'documentNumber', label: 'Documento' }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo' }, { key: 'loyaltyTier', label: 'Fidelización' }, { key: 'status', label: 'Estado' }];
  return <div className="view-container"><PageHeader metadata="Documento único entre perfiles activos" title="Clientes y fidelización" description="Alta guiada, edición, archivo y reactivación sin perder historial." action={<button className="btn btn-primary" onClick={() => setEditor(null)}>Registrar cliente</button>} /><MetricStrip items={[{ label: 'Activos', value: state.clients.filter((item) => item.status !== 'Archivado').length }, { label: 'Archivados', value: state.clients.filter((item) => item.status === 'Archivado').length }, { label: 'Frecuentes', value: state.clients.filter((item) => item.visits >= 3).length }]} /><div className="filter-bar"><label className="search-label"><Search size={16} /><input aria-label="Buscar clientes" placeholder="Nombre, documento o correo" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="filter-result">{records.length} perfiles</span></div>{table.total ? <section className="card table-container"><table className="custom-table"><caption>Clientes registrados en la sesión</caption><thead><tr>{columns.map((column) => <SortableHeader key={column.key} column={column} sort={table.sort} onSort={table.toggleSort} />)}<th scope="col">Acciones</th></tr></thead><tbody>{table.visible.map((client) => <tr key={client.id}><td><strong>{client.name}</strong><br /><small>{client.id}</small></td><td>{client.documentType} {client.documentNumber}</td><td>{client.phone || 'No registrado'}</td><td>{client.email || 'No registrado'}</td><td>{client.loyaltyTier}</td><td><StatusBadge>{client.status || 'Activo'}</StatusBadge></td><td><RowActions label={client.name}><button role="menuitem" onClick={() => setSelectedId(client.id)}>Ver perfil</button>{client.status !== 'Archivado' ? <button role="menuitem" onClick={() => setEditor(client)}>Editar</button> : null}<button role="menuitem" onClick={() => transition(client)}>{client.status === 'Archivado' ? 'Reactivar' : 'Archivar'}</button></RowActions></td></tr>)}</tbody></table><Pagination {...table} onPage={table.setPage} /></section> : <EmptyState title="Sin clientes" />}<Drawer open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected?.name || 'Cliente'}>{selected ? <DetailGrid items={[{ label: 'Documento', value: `${selected.documentType} ${selected.documentNumber}` }, { label: 'Teléfono', value: selected.phone }, { label: 'Correo', value: selected.email }, { label: 'Dirección', value: selected.address }, { label: 'Nacionalidad', value: selected.nationality }, { label: 'Estado', node: <StatusBadge>{selected.status || 'Activo'}</StatusBadge> }]} /> : null}</Drawer><Dialog open={editor !== undefined} onClose={() => setEditor(undefined)} title={editor ? `Editar ${editor.name}` : 'Registrar cliente'} description="El borrador se conserva entre pasos y se limpia al cerrar." wide><CustomerForm client={editor || null} onClose={() => setEditor(undefined)} notify={notify} /></Dialog></div>;
}
