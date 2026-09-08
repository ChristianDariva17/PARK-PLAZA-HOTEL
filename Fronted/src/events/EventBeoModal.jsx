import React from 'react';
import { 
  Printer, 
  X, 
  Building2, 
  Clock, 
  DollarSign, 
  FileText, 
  UtensilsCrossed, 
  Tv, 
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
      <div className="beo-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="beo-modal-actions">
          <div className="beo-actions-title">
            <FileText size={18} color="#C59D5F" />
            <span className="beo-actions-label">
              Orden de Servicio de Banquetería (B.E.O.) · Hotel Park Plaza
            </span>
          </div>
          <div className="beo-actions-buttons">
            <button 
              type="button"
              onClick={handlePrint}
              className="beo-print-button"
            >
              <Printer size={15} /> Imprimir BEO
            </button>
            <button 
              type="button"
              onClick={onClose}
              className="beo-close-button"
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
              <div className="beo-hotel-label">
                HOTEL PARK PLAZA ★★★★★
              </div>
              <h1 className="beo-brand-title">BANQUET EVENT ORDER (B.E.O.)</h1>
              <div className="beo-folio">
                Orden Operativa de Eventos & Salones · Folio #{event.id?.slice(0, 8).toUpperCase()}
              </div>
            </div>
            <div className="beo-status-block">
              <div className={`beo-badge ${event.status === 'confirmed' || event.status === 'in_progress' ? 'beo-badge-confirmed' : ''}`}>
                ESTADO: {event.status?.toUpperCase()}
              </div>
              <div className="beo-issued-date">
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
                <div className="beo-description">
                  <em>Notas: {event.description}</em>
                </div>
              )}
            </div>

            <div className="beo-section">
              <h3 className="beo-section-title"><Clock size={14} /> 2. Cronograma Operativo</h3>
              <div className="beo-row">
                <span>Fecha del Evento:</span>
                <strong className="beo-date-value">{formatDate(startsDate)}</strong>
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
          <div className="beo-section beo-catering-section">
            <h3 className="beo-section-title"><UtensilsCrossed size={14} /> 5. Comanda de Alimentos & Bebidas (Catering)</h3>
            {event.services && event.services.length > 0 ? (
              <table className="beo-table">
                <thead>
                  <tr>
                    <th>Servicio / Paquete</th>
                    <th className="beo-align-center">Cantidad</th>
                    <th className="beo-align-right">P. Unitario</th>
                    <th className="beo-align-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {event.services.map((s, idx) => (
                    <tr key={idx}>
                      <td><strong>{s.serviceCode || s.name || 'Servicio Gastronómico'}</strong></td>
                      <td className="beo-align-center">{s.quantity || 1}</td>
                      <td className="beo-align-right">S/ {Number(s.unitAmount || 0).toFixed(2)}</td>
                      <td className="beo-align-right"><strong>S/ {Number(s.totalAmount || 0).toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="beo-catering-empty">
                Catering estándar coordinado con F&B del hotel según número de comensales ({event.attendees || 20} pers.)
              </div>
            )}
          </div>

          {/* Resumen Financiero */}
          <div className="beo-section beo-financial-section">
            <h3 className="beo-section-title beo-financial-title">
              <DollarSign size={14} /> 6. Resumen Financiero & Saldos
            </h3>
            <div className="beo-financial-grid">
              <div>
                <span className="beo-financial-label beo-financial-label-total">Importe Total Contratado</span>
                <strong className="beo-financial-value beo-financial-value-total">{formatMoney(totalAmount)}</strong>
              </div>
              <div>
                <span className="beo-financial-label beo-financial-label-paid">Adelanto / Garantía Recibido</span>
                <strong className="beo-financial-value beo-financial-value-paid">{formatMoney(depositPaid)}</strong>
              </div>
              <div>
                <span className="beo-financial-label beo-financial-label-balance">Saldo Restante al Cierre</span>
                <strong className="beo-financial-value beo-financial-value-balance">{formatMoney(balancePending)}</strong>
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
