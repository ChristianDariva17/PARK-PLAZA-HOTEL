import React, { useState, useMemo } from 'react';
import { useDocuments } from '../useDocuments.js';
import { useHotel } from '../../state/hotelContext.js';
import { PageHeader, MetricStrip, StatusBadge, EmptyState } from '../../components/views/SharedViewParts.jsx';
import { Dialog } from '../../components/ui/Overlay.jsx';
import {
  Search,
  LayoutGrid,
  List,
  Eye,
  ExternalLink,
  Download,
  Calendar,
  Sparkles,
  Wrench,
  AlertTriangle,
  FileSignature,
  FileImage,
  Layers,
  BedDouble,
  User,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

const SOURCE_CONFIG = {
  CLEANING: { label: 'Limpieza', icon: Sparkles, color: 'var(--color-success)', bg: 'var(--color-success-soft)' },
  MAINTENANCE: { label: 'Mantenimiento', icon: Wrench, color: 'var(--color-warning)', bg: 'var(--color-warning-soft)' },
  INCIDENTS: { label: 'Incidencias', icon: AlertTriangle, color: 'var(--color-danger)', bg: 'var(--color-danger-soft)' },
  CONTRACTS: { label: 'Contratos', icon: FileSignature, color: 'var(--color-purple)', bg: 'var(--color-purple-soft)' },
};

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(isoString) {
  if (!isoString) return 'No registrada';
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? isoString : d.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function EvidenceView() {
  const { state } = useHotel();
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  const { data, loading, error, setFilters, page, setPage, refresh } = useDocuments('evidences', {
    status: '',
    source: '',
    referenceId: ''
  });

  const handleSourceChange = (val) => {
    setSourceFilter(val);
    setFilters((prev) => ({ ...prev, source: val }));
    setPage(1);
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setFilters((prev) => ({ ...prev, status: val }));
    setPage(1);
  };

  // Helper to enrich evidence item with state data (room, user, reason, etc.)
  const resolveEvidenceDetails = (item) => {
    const rawSource = String(item.sourceType || item.originType || '').toUpperCase();
    const sourceKey = rawSource.includes('CLEAN') ? 'CLEANING'
      : rawSource.includes('MAINT') ? 'MAINTENANCE'
      : rawSource.includes('INCID') ? 'INCIDENTS'
      : rawSource.includes('CONT') ? 'CONTRACTS'
      : 'CLEANING';

    const config = SOURCE_CONFIG[sourceKey] || SOURCE_CONFIG.CLEANING;
    const refId = item.referenceId || item.originId;

    let relatedRecord = null;
    let roomNumber = null;
    let responsible = null;
    let originTitle = null;

    if (sourceKey === 'CLEANING') {
      relatedRecord = state.cleaningTasks?.find((t) => t.id === refId);
      if (relatedRecord) {
        const room = state.rooms?.find((r) => r.id === relatedRecord.roomId);
        roomNumber = room ? room.number || room.id : relatedRecord.roomId;
        responsible = relatedRecord.assignedTo;
        originTitle = `Tarea de Limpieza: ${relatedRecord.reason || 'Mantenimiento de turno'}`;
      }
    } else if (sourceKey === 'MAINTENANCE') {
      relatedRecord = state.maintenanceTickets?.find((m) => m.id === refId);
      if (relatedRecord) {
        const room = state.rooms?.find((r) => r.id === relatedRecord.roomId);
        roomNumber = room ? room.number || room.id : relatedRecord.roomId;
        responsible = relatedRecord.assignedTo;
        originTitle = `Ticket de Avería: ${relatedRecord.type || relatedRecord.description?.slice(0, 40)}`;
      }
    } else if (sourceKey === 'INCIDENTS') {
      relatedRecord = state.incidents?.find((i) => i.id === refId);
      if (relatedRecord) {
        const room = state.rooms?.find((r) => r.id === relatedRecord.roomId);
        roomNumber = room ? room.number || room.id : relatedRecord.roomId;
        responsible = relatedRecord.responsible;
        originTitle = `Incidencia: ${relatedRecord.type} (${relatedRecord.priority || 'Normal'})`;
      }
    } else if (sourceKey === 'CONTRACTS') {
      relatedRecord = state.contracts?.find((c) => c.id === refId);
      if (relatedRecord) {
        responsible = relatedRecord.responsible || 'Recepción';
        originTitle = `Contrato de Hospedaje #${relatedRecord.id?.slice(0, 8)}`;
      }
    }

    const imageUrl = item.metadata?.dataUrl || item.metadata?.url || item.url || null;
    const fileName = item.metadata?.fileName || `evidencia-${item.id?.slice(0, 8) || 'archivo'}`;
    const fileSize = item.metadata?.size || null;
    const fileMime = item.metadata?.mimeType || 'image/jpeg';

    return {
      ...item,
      sourceKey,
      sourceConfig: config,
      refId,
      relatedRecord,
      roomNumber,
      responsible,
      originTitle,
      imageUrl,
      fileName,
      fileSize,
      fileMime
    };
  };

  // Enriched items
  const enrichedItems = useMemo(() => {
    return (data.items || []).map(resolveEvidenceDetails);
  }, [data.items, state]);

  // Client-side quick search filter
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return enrichedItems;
    const q = searchQuery.toLowerCase();
    return enrichedItems.filter((it) => {
      return (
        it.description?.toLowerCase().includes(q) ||
        it.refId?.toLowerCase().includes(q) ||
        it.originTitle?.toLowerCase().includes(q) ||
        it.roomNumber?.toString().toLowerCase().includes(q) ||
        it.responsible?.toLowerCase().includes(q) ||
        it.sourceConfig.label.toLowerCase().includes(q)
      );
    });
  }, [enrichedItems, searchQuery]);

  // Metric counts
  const totalCount = data.total || enrichedItems.length;
  const cleaningCount = enrichedItems.filter((i) => i.sourceKey === 'CLEANING').length;
  const maintenanceCount = enrichedItems.filter((i) => i.sourceKey === 'MAINTENANCE').length;
  const incidentCount = enrichedItems.filter((i) => i.sourceKey === 'INCIDENTS').length;
  const contractCount = enrichedItems.filter((i) => i.sourceKey === 'CONTRACTS').length;

  return (
    <div className="view-container">
      <style>{`
        .evidence-gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 10px;
        }

        .evidence-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
          display: flex;
          flex-direction: column;
          cursor: pointer;
        }

        .evidence-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-card);
          border-color: var(--color-gold);
        }

        .evidence-media-wrapper {
          position: relative;
          width: 100%;
          height: 190px;
          background: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .evidence-media-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }

        .evidence-card:hover .evidence-media-img {
          transform: scale(1.05);
        }

        .evidence-media-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #94a3b8;
          font-size: 13px;
        }

        .evidence-source-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 700;
          backdrop-filter: blur(8px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }

        .evidence-overlay-action {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .evidence-card:hover .evidence-overlay-action {
          opacity: 1;
        }

        .evidence-card-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          flex: 1;
          justify-content: space-between;
          gap: 12px;
        }

        .evidence-card-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.35;
        }

        .evidence-card-meta {
          font-size: 12px;
          color: var(--color-muted);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .evidence-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .evidence-modal-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 24px;
          min-height: 400px;
        }

        @media (max-width: 850px) {
          .evidence-modal-layout {
            grid-template-columns: 1fr;
          }
        }

        .evidence-modal-media-pane {
          background: #090d16;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          min-height: 350px;
          max-height: 550px;
          overflow: hidden;
        }

        .evidence-modal-img {
          max-width: 100%;
          max-height: 500px;
          object-fit: contain;
          border-radius: 6px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }

        .evidence-modal-info-pane {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .evidence-info-group {
          background: var(--color-surface-soft);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 14px;
        }

        .evidence-info-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }

        .evidence-info-value {
          font-size: 13.5px;
          color: var(--color-text);
          font-weight: 600;
        }

        .view-mode-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-body);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .view-mode-btn.active {
          background: var(--color-navy-deep);
          color: var(--color-gold);
          border-color: var(--color-navy-deep);
        }
      `}</style>

      <PageHeader
        metadata="Auditoría y Control de Calidad Operativa"
        title="Auditoría de Evidencias"
        description="Panel centralizado de supervisión fotográfica y documental de Limpieza, Mantenimiento, Incidencias y Contratos."
        action={
          <button className="btn btn-outline" onClick={refresh} title="Actualizar datos">
            <RefreshCw size={15} /> Actualizar
          </button>
        }
      />

      <MetricStrip
        items={[
          { label: 'Total Evidencias', value: totalCount },
          { label: 'Limpieza', value: cleaningCount },
          { label: 'Mantenimiento', value: maintenanceCount },
          { label: 'Incidencias', value: incidentCount },
          { label: 'Contratos', value: contractCount },
        ]}
      />

      {/* Filter and Switcher Toolbar */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', flex: 1, alignItems: 'center' }}>
          <label className="search-label" style={{ minWidth: '240px' }}>
            <Search size={16} />
            <input
              aria-label="Buscar evidencia"
              placeholder="Buscar por descripción, habitación, responsable..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>

          <label>
            Área / Fuente
            <select value={sourceFilter} onChange={(e) => handleSourceChange(e.target.value)}>
              <option value="">Todas las áreas</option>
              <option value="CLEANING">Limpieza</option>
              <option value="MAINTENANCE">Mantenimiento</option>
              <option value="INCIDENTS">Incidencias</option>
              <option value="CONTRACTS">Contratos</option>
            </select>
          </label>

          <label>
            Estado
            <select value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="VERIFIED">Verificada</option>
              <option value="PENDING">Pendiente de revisión</option>
              <option value="REJECTED">Rechazada</option>
            </select>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-muted)', marginRight: '6px' }}>
            {filteredItems.length} {filteredItems.length === 1 ? 'resultado' : 'resultados'}
          </span>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Vista de Galería"
            aria-label="Vista de Galería"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Vista de Tabla"
            aria-label="Vista de Tabla"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {error && <div className="alert-banner alert-banner-danger">{error}</div>}

      {/* Main Content Area */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <p style={{ color: 'var(--color-muted)' }}>Cargando catálogo de evidencias operativas...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="Sin evidencias encontradas"
          description={searchQuery || sourceFilter || statusFilter ? 'No se encontraron evidencias con los filtros seleccionados.' : 'Aún no se han registrado evidencias fotográficas en el sistema.'}
        />
      ) : viewMode === 'grid' ? (
        /* Visual Grid Gallery View */
        <div className="evidence-gallery-grid">
          {filteredItems.map((item) => {
            const Icon = item.sourceConfig.icon;
            return (
              <article
                key={item.id}
                className="evidence-card"
                onClick={() => setSelectedEvidence(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedEvidence(item)}
              >
                <div className="evidence-media-wrapper">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.description || item.fileName} className="evidence-media-img" loading="lazy" />
                  ) : (
                    <div className="evidence-media-placeholder">
                      <FileImage size={36} />
                      <span>Documento sin imagen</span>
                    </div>
                  )}

                  <div
                    className="evidence-source-badge"
                    style={{ backgroundColor: item.sourceConfig.bg, color: item.sourceConfig.color, border: `1px solid ${item.sourceConfig.color}` }}
                  >
                    <Icon size={12} />
                    <span>{item.sourceConfig.label}</span>
                  </div>

                  <div className="evidence-overlay-action">
                    <span className="btn btn-sm btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Eye size={14} /> Inspeccionar
                    </span>
                  </div>
                </div>

                <div className="evidence-card-body">
                  <div>
                    <h3 className="evidence-card-title">{item.description || item.originTitle || 'Evidencia de turno'}</h3>
                    <div className="evidence-card-meta">
                      {item.roomNumber && (
                        <div className="evidence-meta-row">
                          <BedDouble size={13} style={{ color: 'var(--color-gold)' }} />
                          <strong>Habitación {item.roomNumber}</strong>
                        </div>
                      )}
                      {item.originTitle && (
                        <div className="evidence-meta-row" title={item.originTitle}>
                          <Layers size={13} />
                          <span>{item.originTitle}</span>
                        </div>
                      )}
                      {item.responsible && (
                        <div className="evidence-meta-row">
                          <User size={13} />
                          <span>{item.responsible}</span>
                        </div>
                      )}
                      <div className="evidence-meta-row">
                        <Calendar size={13} />
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--color-border)' }}>
                    <StatusBadge>{item.status || 'VERIFIED'}</StatusBadge>
                    <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                      {item.fileSize ? formatBytes(item.fileSize) : 'Adjunto'}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Detailed Audit Table View */
        <section className="card table-container">
          <table className="custom-table">
            <caption>Registro y trazabilidad de evidencias operativas</caption>
            <thead>
              <tr>
                <th scope="col" style={{ width: '80px' }}>Miniatura</th>
                <th scope="col">Área</th>
                <th scope="col">Referencia / Habitación</th>
                <th scope="col">Descripción</th>
                <th scope="col">Fecha y Hora</th>
                <th scope="col">Estado</th>
                <th scope="col" style={{ textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const Icon = item.sourceConfig.icon;
                return (
                  <tr key={item.id}>
                    <td>
                      {item.imageUrl ? (
                        <div
                          style={{ width: '56px', height: '42px', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', background: '#0f172a' }}
                          onClick={() => setSelectedEvidence(item)}
                        >
                          <img src={item.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: '56px', height: '42px', borderRadius: '6px', background: 'var(--color-surface-soft)', display: 'grid', placeItems: 'center' }}>
                          <FileImage size={18} color="var(--color-muted)" />
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: item.sourceConfig.bg, color: item.sourceConfig.color }}
                      >
                        <Icon size={12} />
                        {item.sourceConfig.label}
                      </span>
                    </td>
                    <td>
                      {item.roomNumber ? (
                        <div>
                          <strong>Habitación {item.roomNumber}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{item.originTitle || item.refId}</div>
                        </div>
                      ) : (
                        <span>{item.originTitle || item.refId || 'N/A'}</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '280px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description || 'Sin descripción'}
                      </div>
                      {item.responsible && (
                        <small style={{ color: 'var(--color-muted)' }}>Por: {item.responsible}</small>
                      )}
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <StatusBadge>{item.status || 'VERIFIED'}</StatusBadge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-sm btn-outline" onClick={() => setSelectedEvidence(item)}>
                        <Eye size={13} style={{ marginRight: '4px' }} /> Ver detalle
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Pagination Bar */}
      <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </button>
        <span style={{ fontSize: '13px', fontWeight: '600' }}>Página {page}</span>
        <button className="btn btn-outline" disabled={data.items.length < 50} onClick={() => setPage((p) => p + 1)}>
          Siguiente
        </button>
      </div>

      {/* Detailed Inspection Lightbox Dialog */}
      <Dialog
        open={Boolean(selectedEvidence)}
        onClose={() => setSelectedEvidence(null)}
        title={selectedEvidence ? `Inspección de Evidencia: ${selectedEvidence.sourceConfig?.label || 'General'}` : 'Detalle de evidencia'}
        description={selectedEvidence ? `Registro #${selectedEvidence.id} • ${formatDate(selectedEvidence.createdAt)}` : ''}
        wide
      >
        {selectedEvidence && (
          <div className="evidence-modal-layout">
            {/* Visual Media Pane */}
            <div className="evidence-modal-media-pane">
              {selectedEvidence.imageUrl ? (
                <img
                  src={selectedEvidence.imageUrl}
                  alt={selectedEvidence.description || 'Evidencia fotográfica'}
                  className="evidence-modal-img"
                />
              ) : (
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <FileImage size={64} style={{ margin: '0 auto 12px' }} />
                  <p>Esta evidencia no contiene vista previa gráfica.</p>
                </div>
              )}
            </div>

            {/* Structured Info Pane */}
            <div className="evidence-modal-info-pane">
              <div className="evidence-info-group">
                <div className="evidence-info-label">Descripción de la Evidencia</div>
                <div className="evidence-info-value" style={{ fontWeight: 500, fontSize: '14px', lineHeight: '1.4' }}>
                  {selectedEvidence.description || 'Sin descripción detallada.'}
                </div>
              </div>

              <div className="evidence-info-group">
                <div className="evidence-info-label">Origen y Vinculación</div>
                <div className="evidence-info-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: selectedEvidence.sourceConfig?.bg,
                      color: selectedEvidence.sourceConfig?.color,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {selectedEvidence.sourceConfig?.label}
                  </span>
                  {selectedEvidence.roomNumber && (
                    <span className="badge badge-blue">Hab. {selectedEvidence.roomNumber}</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-body)' }}>
                  {selectedEvidence.originTitle || `ID Referencia: ${selectedEvidence.refId}`}
                </div>
              </div>

              <div className="evidence-info-group">
                <div className="evidence-info-label">Metadatos de Archivo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12.5px' }}>
                  <div><strong>Archivo:</strong> {selectedEvidence.fileName}</div>
                  <div><strong>Tamaño:</strong> {selectedEvidence.fileSize ? formatBytes(selectedEvidence.fileSize) : 'N/A'}</div>
                  <div><strong>Formato:</strong> {selectedEvidence.fileMime}</div>
                  <div><strong>Registrado:</strong> {formatDate(selectedEvidence.createdAt)}</div>
                  {selectedEvidence.responsible && (
                    <div><strong>Responsable:</strong> {selectedEvidence.responsible}</div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                {selectedEvidence.imageUrl && (
                  <a
                    href={selectedEvidence.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline"
                    style={{ flex: 1, textDecoration: 'none', textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <ExternalLink size={14} /> Abrir original
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => setSelectedEvidence(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
