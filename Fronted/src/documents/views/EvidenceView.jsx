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
      <div className="filter-bar evidence-filter-bar">
        <div className="evidence-filter-controls">
          <label className="search-label evidence-search-label">
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

        <div className="evidence-view-controls">
          <span className="evidence-result-count">
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
        <div className="card evidence-loading">
          <p className="evidence-loading-copy">Cargando catálogo de evidencias operativas...</p>
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
                    className={`evidence-source-badge evidence-source-${item.sourceKey.toLowerCase()}`}
                  >
                    <Icon size={12} />
                    <span>{item.sourceConfig.label}</span>
                  </div>

                  <div className="evidence-overlay-action">
                    <span className="btn btn-sm btn-primary evidence-overlay-button">
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
                          <BedDouble size={13} className="evidence-room-icon" />
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

                  <div className="evidence-card-footer">
                    <StatusBadge>{item.status || 'VERIFIED'}</StatusBadge>
                    <span className="evidence-file-size">
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
                <th scope="col" className="evidence-thumbnail-heading">Miniatura</th>
                <th scope="col">Área</th>
                <th scope="col">Referencia / Habitación</th>
                <th scope="col">Descripción</th>
                <th scope="col">Fecha y Hora</th>
                <th scope="col">Estado</th>
                <th scope="col" className="evidence-action-heading">Acción</th>
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
                          className="evidence-table-thumbnail"
                          onClick={() => setSelectedEvidence(item)}
                        >
                          <img src={item.imageUrl} alt="preview" className="evidence-table-thumbnail-image" />
                        </div>
                      ) : (
                        <div className="evidence-table-placeholder">
                          <FileImage size={18} color="var(--color-muted)" />
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                         className={`badge evidence-source-badge-inline evidence-source-${item.sourceKey.toLowerCase()}`}
                      >
                        <Icon size={12} />
                        {item.sourceConfig.label}
                      </span>
                    </td>
                    <td>
                      {item.roomNumber ? (
                        <div>
                          <strong>Habitación {item.roomNumber}</strong>
                          <div className="evidence-table-origin">{item.originTitle || item.refId}</div>
                        </div>
                      ) : (
                        <span>{item.originTitle || item.refId || 'N/A'}</span>
                      )}
                    </td>
                    <td className="evidence-description-cell">
                      <div className="evidence-description-text">
                        {item.description || 'Sin descripción'}
                      </div>
                      {item.responsible && (
                        <small className="evidence-responsible">Por: {item.responsible}</small>
                      )}
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <StatusBadge>{item.status || 'VERIFIED'}</StatusBadge>
                    </td>
                    <td className="evidence-action-cell">
                      <button className="btn btn-sm btn-outline" onClick={() => setSelectedEvidence(item)}>
                        <Eye size={13} className="evidence-action-icon" /> Ver detalle
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
      <div className="pagination evidence-pagination">
        <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </button>
        <span className="evidence-page-label">Página {page}</span>
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
                <div className="evidence-no-preview">
                  <FileImage size={64} className="evidence-no-preview-icon" />
                  <p>Esta evidencia no contiene vista previa gráfica.</p>
                </div>
              )}
            </div>

            {/* Structured Info Pane */}
            <div className="evidence-modal-info-pane">
              <div className="evidence-info-group">
                <div className="evidence-info-label">Descripción de la Evidencia</div>
                <div className="evidence-info-value evidence-description-value">
                  {selectedEvidence.description || 'Sin descripción detallada.'}
                </div>
              </div>

              <div className="evidence-info-group">
                <div className="evidence-info-label">Origen y Vinculación</div>
                <div className="evidence-info-value evidence-origin-value">
                  <span
                    className={`badge evidence-source-badge-inline evidence-source-${selectedEvidence.sourceKey.toLowerCase()}`}
                  >
                    {selectedEvidence.sourceConfig?.label}
                  </span>
                  {selectedEvidence.roomNumber && (
                    <span className="badge badge-blue">Hab. {selectedEvidence.roomNumber}</span>
                  )}
                </div>
                <div className="evidence-origin-copy">
                  {selectedEvidence.originTitle || `ID Referencia: ${selectedEvidence.refId}`}
                </div>
              </div>

              <div className="evidence-info-group">
                <div className="evidence-info-label">Metadatos de Archivo</div>
                <div className="evidence-file-metadata">
                  <div><strong>Archivo:</strong> {selectedEvidence.fileName}</div>
                  <div><strong>Tamaño:</strong> {selectedEvidence.fileSize ? formatBytes(selectedEvidence.fileSize) : 'N/A'}</div>
                  <div><strong>Formato:</strong> {selectedEvidence.fileMime}</div>
                  <div><strong>Registrado:</strong> {formatDate(selectedEvidence.createdAt)}</div>
                  {selectedEvidence.responsible && (
                    <div><strong>Responsable:</strong> {selectedEvidence.responsible}</div>
                  )}
                </div>
              </div>

              <div className="evidence-modal-actions">
                {selectedEvidence.imageUrl && (
                  <a
                    href={selectedEvidence.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline evidence-open-button"
                  >
                    <ExternalLink size={14} /> Abrir original
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn-primary evidence-close-button"
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
