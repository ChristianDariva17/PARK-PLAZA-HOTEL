import React, { useState } from 'react';
import { useDocuments } from '../useDocuments.js';
import { PageHeader, MetricStrip, DataTable, StatusBadge, DetailGrid, SectionHeader } from '../../components/views/SharedViewParts.jsx';
import { Drawer } from '../../components/ui/Overlay.jsx';

export function AuditView({ notify }) {
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [subjectTypeFilter, setSubjectTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const { data, loading, error, setFilters, page, setPage } = useDocuments('audit', { eventType: '', subjectType: '', search: '', from: '', to: '' });

  const selected = data.items.find(item => item.id === selectedId);

  return (
    <div className="view-container">
      <PageHeader metadata="Trazabilidad y Seguridad" title="Eventos de Auditoría" description="Consulta de registro inmutable de transiciones y eventos críticos de documentos" />
      <MetricStrip items={[{ label: 'Eventos Registrados', value: data.total }]} />
      
      <div className="filter-bar">
        <label>
          Tipo de Evento
          <select value={eventTypeFilter} onChange={(e) => { setEventTypeFilter(e.target.value); setFilters(f => ({ ...f, eventType: e.target.value })); setPage(1); }}>
            <option value="">Todos</option>
            <option value="contract.created">Contrato creado</option>
            <option value="contract.transitioned">Contrato actualizado</option>
            <option value="evidence.registered">Evidencia registrada</option>
            <option value="contract.evidence_linked">Evidencia vinculada</option>
          </select>
        </label>
        <label>
          Entidad
          <select value={subjectTypeFilter} onChange={(e) => { setSubjectTypeFilter(e.target.value); setFilters(f => ({ ...f, subjectType: e.target.value })); setPage(1); }}>
            <option value="">Todas</option>
            <option value="contract">Contrato</option>
            <option value="evidence">Evidencia</option>
          </select>
        </label>
        <label>
          Buscar
          <input value={search} placeholder="Tipo, entidad o usuario" onChange={(e) => { setSearch(e.target.value); setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }} />
        </label>
        <label>
          Desde
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setFilters(f => ({ ...f, from: e.target.value ? `${e.target.value}T00:00:00.000Z` : '' })); setPage(1); }} />
        </label>
        <label>
          Hasta
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setFilters(f => ({ ...f, to: e.target.value ? `${e.target.value}T23:59:59.999Z` : '' })); setPage(1); }} />
        </label>
      </div>
      
      {error && <div className="alert-banner alert-banner-error">{error}</div>}
      
      <DataTable caption="Registro de eventos de auditoría (solo lectura)" columns={['ID Evento', 'Fecha', 'Usuario', 'Acción', 'Entidad', 'Ref. Entidad', 'Detalle']} emptyTitle="Sin eventos">
        {loading ? (
          <tr><td colSpan="7">Cargando eventos...</td></tr>
        ) : data.items.map((item) => (
          <tr key={item.id}>
            <td>{item.id.substring(0, 8)}...</td>
            <td>{new Date(item.occurredAt).toLocaleString()}</td>
            <td>{item.actor?.email || 'Sistema'}</td>
            <td><StatusBadge>{item.eventType}</StatusBadge></td>
            <td>{item.subjectType}</td>
            <td>{item.subjectId}</td>
            <td>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedId(item.id)}>Inspeccionar</button>
            </td>
          </tr>
        ))}
      </DataTable>
      <div className="pagination" style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
         <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
         <span>Página {page}</span>
          <button className="btn btn-outline" disabled={!data.hasNextPage} onClick={() => setPage(p => p + 1)}>Siguiente</button>
      </div>

       <Drawer open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected?.eventType || 'Evento'}>
        {selected ? (
          <div className="detail-stack">
             <section>
                <SectionHeader eyebrow="Metadatos" title="Detalle del Payload" />
                <DetailGrid items={[
                   { label: 'IP', value: selected.ipAddress || 'N/A' },
                   { label: 'User Agent', value: selected.userAgent || 'N/A' },
                   { label: 'Usuario', value: selected.actor?.email || 'Sistema' },
                   { label: 'Rol', value: selected.actor?.role || 'N/A' },
                ]} />
                <div style={{ marginTop: '16px', background: 'var(--color-neutral-900)', padding: '16px', borderRadius: '4px', overflowX: 'auto', color: 'var(--color-neutral-300)', fontFamily: 'monospace', fontSize: '13px' }}>
                   <pre>{JSON.stringify(selected.metadata || {}, null, 2)}</pre>
                </div>
             </section>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
