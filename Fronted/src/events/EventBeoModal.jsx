import React from 'react';
import { 
  Printer, 
  X, 
  Building2, 
  Calendar, 
  Clock, 
  Users, 
  DollarSign, 
  FileText, 
  UtensilsCrossed, 
  Tv, 
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';

export function EventBeoModal({ event, onClose }) {
  if (!event) return null;

  const startsDate = event.startsAt ? new Date(event.startsAt) : new Date();
  const endsDate = event.endsAt ? new Date(event.endsAt) : new Date();
  const tz = event.timezone || 'America/Lima';

  const formatDate = (date) => {
    try {
      return new Intl.DateTimeFormat('es-PE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        timeZone: tz 
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  };

  const formatTime = (date) => {
    try {
      return new Intl.DateTimeFormat('es-PE', { 
        hour: '2-digit', 
        minute: '2-digit', 
        timeZone: tz 
      }).format(date);
    } catch {
      return date.toLocaleTimeString();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const spaceName = event.space?.name || 'Salón Gran Plaza';
  const totalAmount = Number(event.estimatedAmount || 0);
  const depositPaid = Number(event.depositReceivedAmount || event.depositAmount || 0);
  const balancePending = Math.max(0, totalAmount - depositPaid);

  return (
    <div className="beo-modal-overlay" onClick={onClose}>
      <style>{`
        .beo-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(10, 17, 34, 0.75);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          overflow-y: auto;
        }
        .beo-modal-container {
          background: #FFFFFF;
          border-radius: 16px;
          width: 100%;
          max-width: 860px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }
        .beo-modal-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 24px;
          background: #0F172A;
          color: #F8FAFC;
        }
        .beo-sheet {
          padding: 36px 40px;
          overflow-y: auto;
          color: #0F172A;
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          background: #FFFFFF;
        }
        .beo-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #C59D5F;
          padding-bottom: 18px;
          margin-bottom: 22px;
        }
        .beo-brand-title {
          font-family: var(--font-serif, "Playfair Display", Georgia, serif);
          font-size: 24px;
          font-weight: 800;
          color: #0B192C;
          letter-spacing: 0.05em;
          margin: 0;
        }
        .beo-badge {
          display: inline-block;
          padding: 4px 12px;
          background: #FEF3C7;
          color: #92400E;
          border: 1px solid #FDE047;
          border-radius: 9999px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .beo-badge-confirmed {
          background: #DCFCE7;
          color: #166534;
          border-color: #86EFAC;
        }
        .beo-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 22px;
        }
        .beo-section {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 16px 18px;
        }
        .beo-section-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #C59D5F;
          margin: 0 0 12px;
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px dashed #CBD5E1;
          padding-bottom: 6px;
        }
        .beo-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          margin-bottom: 6px;
          color: #334155;
        }
        .beo-row strong {
          color: #0F172A;
          text-align: right;
        }
        .beo-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-top: 8px;
        }
        .beo-table th {
          background: #E2E8F0;
          color: #1E293B;
          text-align: left;
          padding: 8px 10px;
          font-weight: 700;
          font-size: 11.5px;
          text-transform: uppercase;
        }
        .beo-table td {
          padding: 8px 10px;
          border-bottom: 1px solid #F1F5F9;
        }
        .beo-signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 36px;
          padding-top: 20px;
        }
        .beo-signature-box {
          border-top: 1px solid #475569;
          padding-top: 8px;
          text-align: center;
          font-size: 12px;
          color: #475569;
        }
        .beo-signature-box strong {
          display: block;
          color: #0F172A;
          font-size: 13px;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .beo-modal-overlay,
          .beo-modal-container,
          .beo-sheet,
          .beo-sheet * {
            visibility: visible;
          }
          .beo-modal-overlay {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            background: #FFFFFF !important;
            padding: 0;
          }
          .beo-modal-container {
            max-width: 100% !important;
            max-height: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .beo-modal-actions {
            display: none !important;
          }
          .beo-sheet {
            padding: 20px !important;
          }
        }
      `}</style>

      <div className="beo-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="beo-modal-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} color="#C59D5F" />
            <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '0.03em' }}>
              Orden de Servicio de Banquetería (B.E.O.) · Hotel Park Plaza
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                borderRadius: 8,
                background: '#C59D5F',
                color: '#0B192C',
                border: 'none',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              <Printer size={15} /> Imprimir BEO
            </button>
            <button 
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="beo-sheet">
          {/* Header */}
          <div className="beo-header">
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#C59D5F', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                HOTEL PARK PLAZA ★★★★★
              </div>
              <h1 className="beo-brand-title">BANQUET EVENT ORDER (B.E.O.)</h1>
              <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                Orden Operativa de Eventos & Salones · Folio #{event.id?.slice(0, 8).toUpperCase()}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={`beo-badge ${event.status === 'confirmed' || event.status === 'in_progress' ? 'beo-badge-confirmed' : ''}`}>
                ESTADO: {event.status?.toUpperCase()}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 6 }}>
                Emisión: {new Date().toLocaleDateString('es-PE')}
              </div>
            </div>
          </div>

          {/* Grid 1: Datos Generales y Horarios */}
          <div className="beo-grid">
            <div className="beo-section">
              <h3 className="beo-section-title"><UserCheck size={14} /> 1. Datos del Anfitrión y Evento</h3>
              <div className="beo-row">
                <span>Título del Evento:</span>
                <strong>{event.title}</strong>
              </div>
              <div className="beo-row">
                <span>Salón / Espacio:</span>
                <strong>{spaceName}</strong>
              </div>
              <div className="beo-row">
                <span>Aforo Garantizado:</span>
                <strong>{event.attendees || 20} personas</strong>
              </div>
              <div className="beo-row">
                <span>Tipo de Modalidad:</span>
                <strong>{event.timeKind === 'all_day' ? 'Jornada Completa' : 'Por Horas Programadas'}</strong>
              </div>
              {event.description && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#475569', background: '#F1F5F9', padding: '6px 10px', borderRadius: 6 }}>
                  <em>Notas: {event.description}</em>
                </div>
              )}
            </div>

            <div className="beo-section">
              <h3 className="beo-section-title"><Clock size={14} /> 2. Cronograma Operativo</h3>
              <div className="beo-row">
                <span>Fecha del Evento:</span>
                <strong style={{ textTransform: 'capitalize' }}>{formatDate(startsDate)}</strong>
              </div>
              <div className="beo-row">
                <span>Hora de Montaje (Staff):</span>
                <strong>Aprox. 1 hora antes</strong>
              </div>
              <div className="beo-row">
                <span>Recepción & Apertura:</span>
                <strong>{formatTime(startsDate)}</strong>
              </div>
              <div className="beo-row">
                <span>Finalización Programada:</span>
                <strong>{formatTime(endsDate)}</strong>
              </div>
              <div className="beo-row">
                <span>Zona Horaria:</span>
                <strong>{tz}</strong>
              </div>
            </div>
          </div>

          {/* Grid 2: Montaje & Equipamiento */}
          <div className="beo-grid">
            <div className="beo-section">
              <h3 className="beo-section-title"><Building2 size={14} /> 3. Montaje de Sala & Salón</h3>
              <div className="beo-row">
                <span>Disposición de Sala:</span>
                <strong>Mesas redondas / Banquete</strong>
              </div>
              <div className="beo-row">
                <span>Mantelería & Menaje:</span>
                <strong>Lencería Fina Hotel Park Plaza</strong>
              </div>
              <div className="beo-row">
                <span>Climatización Sugerida:</span>
                <strong>Confort 21°C</strong>
              </div>
              <div className="beo-row">
                <span>Estacionamiento:</span>
                <strong>Valet Parking / Espacios asignados</strong>
              </div>
            </div>

            <div className="beo-section">
              <h3 className="beo-section-title"><Tv size={14} /> 4. Equipamiento Técnico & A/V</h3>
              <div className="beo-row">
                <span>Proyección & Video:</span>
                <strong>Proyector Láser 4K & Ecran</strong>
              </div>
              <div className="beo-row">
                <span>Microfonía & Sonido:</span>
                <strong>Set inalámbrico + Audio ambiental</strong>
              </div>
              <div className="beo-row">
                <span>Conectividad:</span>
                <strong>WiFi 6 Dedicado para Asistentes</strong>
              </div>
              <div className="beo-row">
                <span>Personal Asignado:</span>
                <strong>1 Coordinador + Mozos de Sala</strong>
              </div>
            </div>
          </div>

          {/* Section 3: Comanda Gastronómica */}
          <div className="beo-section" style={{ marginBottom: 22 }}>
            <h3 className="beo-section-title"><UtensilsCrossed size={14} /> 5. Comanda de Alimentos & Bebidas (Catering)</h3>
            {event.services && event.services.length > 0 ? (
              <table className="beo-table">
                <thead>
                  <tr>
                    <th>Servicio / Paquete</th>
                    <th style={{ textAlign: 'center' }}>Cantidad</th>
                    <th style={{ textAlign: 'right' }}>P. Unitario</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {event.services.map((s, idx) => (
                    <tr key={idx}>
                      <td><strong>{s.serviceCode || s.name || 'Servicio Gastronómico'}</strong></td>
                      <td style={{ textAlign: 'center' }}>{s.quantity || 1}</td>
                      <td style={{ textAlign: 'right' }}>S/ {Number(s.unitAmount || 0).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}><strong>S/ {Number(s.totalAmount || 0).toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ fontSize: 12.5, color: '#64748B', padding: '8px 0' }}>
                Catering estándar coordinado con F&B del hotel según número de comensales ({event.attendees || 20} pers.)
              </div>
            )}
          </div>

          {/* Resumen Financiero */}
          <div className="beo-section" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
            <h3 className="beo-section-title" style={{ color: '#B45309', borderColor: '#FDE68A' }}>
              <DollarSign size={14} /> 6. Resumen Financiero & Saldos
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, textAlign: 'center' }}>
              <div>
                <span style={{ fontSize: 12, color: '#78350F', display: 'block' }}>Importe Total Contratado</span>
                <strong style={{ fontSize: 18, color: '#92400E' }}>{formatMoney(totalAmount)}</strong>
              </div>
              <div>
                <span style={{ fontSize: 12, color: '#166534', display: 'block' }}>Adelanto / Garantía Recibido</span>
                <strong style={{ fontSize: 18, color: '#15803D' }}>{formatMoney(depositPaid)}</strong>
              </div>
              <div>
                <span style={{ fontSize: 12, color: '#991B1B', display: 'block' }}>Saldo Restante al Cierre</span>
                <strong style={{ fontSize: 18, color: '#B91C1C' }}>{formatMoney(balancePending)}</strong>
              </div>
            </div>
          </div>

          {/* Firmas de Conformidad */}
          <div className="beo-signatures">
            <div className="beo-signature-box">
              <strong>Jefatura de Alimentos & Bebidas / Eventos</strong>
              <span>Hotel Park Plaza ★★★★★</span>
            </div>
            <div className="beo-signature-box">
              <strong>Firma de Conformidad del Anfitrión / Titular</strong>
              <span>DNI / RUC / Pasaporte</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
