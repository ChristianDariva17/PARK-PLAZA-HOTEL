import React, { useState } from 'react';
import { useDocuments } from '../useDocuments.js';
import { PageHeader, MetricStrip, DataTable, StatusBadge, SectionHeader } from '../../components/views/SharedViewParts.jsx';
import { Drawer } from '../../components/ui/Overlay.jsx';
import { Search, FileText, CheckCircle2, AlertCircle, Printer, X } from 'lucide-react';
import { StayConditionsDocument } from '../StayConditionsDocument.jsx';

export function ContractsView({ notify }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const { data, loading, error, setFilters, page, setPage, refresh } = useDocuments('contracts', { status: '', reference: '' });

  const handleFilter = () => {
    setFilters({ status: statusFilter, reference: query });
    setPage(1);
  };

  const selected = data.items.find(item => item.id === selectedId);

  return (
    <div className="view-container">
      <PageHeader
        metadata="Gestión Documental y Legal 5★"
        title="Documentos y Contratos de Estadía"
        description="Custodia digital de declaraciones de conformidad, condiciones de estadía, folios y firmas capturadas en check-in."
      />
      
      <MetricStrip items={[
        { label: 'Total Documentos', value: data.total },
        { label: 'Vigentes / Firmados', value: data.items.filter(i => ['Vigente', 'SIGNED'].includes(i.status) || Boolean(i.metadata?.signatures?.guestSignature)).length },
        { label: 'Borradores / Pendientes', value: data.items.filter(i => ['Borrador', 'Pendiente', 'DRAFT', 'PENDING_SIGNATURE'].includes(i.status) && !i.metadata?.signatures?.guestSignature).length },
      ]} />
      
      <div className="filter-bar" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <label className="search-label" style={{ flex: 1 }}>
          <Search size={16} />
          <input
            aria-label="Buscar documentos"
            placeholder="Buscar por código, referencia, huésped o habitación..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={handleFilter}
            onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>Estado:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setFilters(f => ({ ...f, status: e.target.value }));
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="Vigente">Vigente / Firmado</option>
            <option value="Borrador">Borrador</option>
            <option value="Pendiente">Pendiente de firma</option>
            <option value="Cancelado">Cancelado / Anulado</option>
          </select>
        </label>
        <button className="btn btn-outline" onClick={() => refresh()}>
          Actualizar
        </button>
      </div>
      
      {error && <div className="alert-banner alert-banner-error">{error}</div>}
      
      <DataTable
        caption="Declaraciones y contratos de estadía registrados"
        columns={['Referencia', 'Huésped', 'Habitación', 'Reserva', 'Emisión', 'Estado', 'Firma Digital', 'Acción']}
        emptyTitle="Sin contratos registrados"
      >
        {loading ? (
          <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24 }}>Cargando documentos...</td></tr>
        ) : data.items.length === 0 ? (
          <tr>
            <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
              <FileText size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
              No se encontraron documentos de estadía registrados aún.
            </td>
          </tr>
        ) : data.items.map((item) => {
          const meta = item.metadata || {};
          const guestName = meta.guest?.name || meta.guest?.firstName ? `${meta.guest.firstName || ''} ${meta.guest.lastName || ''}`.trim() : (item.clientId || 'Huésped no registrado');
          const roomNumber = meta.room?.number ? `Hab ${meta.room.number}` : (meta.stay?.roomNumber ? `Hab ${meta.stay.roomNumber}` : '—');
          const hasSignature = Boolean(meta.signatures?.guestSignature);

          return (
            <tr key={item.id}>
              <td>
                <div style={{ fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                  {item.reference || `DOC-${item.id.substring(0, 8).toUpperCase()}`}
                </div>
              </td>
              <td><strong>{guestName}</strong></td>
              <td>{roomNumber}</td>
              <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.reservationId || 'Directa'}</td>
              <td>{new Date(item.generatedAt || item.createdAt).toLocaleDateString('es-PE')}</td>
              <td>
                <StatusBadge status={item.status === 'Vigente' ? 'confirmed' : 'pending'}>
                  {item.status}
                </StatusBadge>
              </td>
              <td>
                {hasSignature ? (
                  <span style={{ color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 11 }}>
                    <CheckCircle2 size={13} /> Capturada
                  </span>
                ) : (
                  <span style={{ color: '#94A3B8', fontSize: 11 }}>Sin firma</span>
                )}
              </td>
              <td>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setSelectedId(item.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <FileText size={13} /> Ver Documento
                </button>
              </td>
            </tr>
          );
        })}
      </DataTable>

      <div className="pagination" style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
         <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</button>
         <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: 13 }}>Página {page}</span>
         <button className="btn btn-outline" disabled={data.items.length < 50} onClick={() => setPage(p => p + 1)}>Siguiente</button>
      </div>

      {/* Document Detail & Print Modal */}
      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected?.reference || `Documento ${selected?.id?.substring(0, 8) || ''}`}
      >
        {selected ? (
          <div className="detail-stack" style={{ gap: 20 }}>
            <StayConditionsDocument
              reservation={selected.metadata?.stay || { id: selected.reservationId, ...selected.metadata?.reservation }}
              guest={selected.metadata?.guest}
              room={selected.metadata?.room}
              stay={selected.metadata?.stay}
              pricing={selected.metadata?.pricing || {}}
              checklist={selected.metadata?.checklist}
              guestSignature={selected.metadata?.signatures?.guestSignature}
              receptionistSignature={selected.metadata?.signatures?.hotelRepresentative}
              receptionistName={selected.metadata?.signatures?.hotelRepresentative || 'Recepción Park Plaza'}
              isReadOnly={true}
            />
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
