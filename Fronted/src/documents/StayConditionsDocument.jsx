import React, { useRef } from 'react';
import { Printer, FileCheck } from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';
import { DEFAULT_CHECKLIST, HOTEL_INFO, PENALTY_RATES } from './stayConditionsModel.js';

export function StayConditionsDocument({
  reservation,
  guest,
  room,
  stay,
  pricing = {},
  checklist = DEFAULT_CHECKLIST,
  onChecklistChange,
  guestSignature,
  receptionistName = 'Recepción Park Plaza',
  isReadOnly = false,
}) {
  const documentRef = useRef(null);

  const handlePrint = () => {
    window.print();
  };

  // Safe data calculations
  const guestName = guest?.name || (guest?.firstName ? `${guest.firstName} ${guest.lastName || ''}`.trim() : 'Huésped no registrado');
  const guestDoc = guest?.documentNumber ? `${guest.docType || guest.primaryDocument?.type || 'DNI'}: ${guest.documentNumber}` : 'Documento no registrado';
  const guestPhone = guest?.phone || 'No registrado';
  const guestEmail = guest?.email || 'No registrado';
  const roomNumber = room?.number || reservation?.roomNumber || 'Por asignar';
  const roomCategory = room?.category || reservation?.category || 'Estándar';

  const checkInDate = reservation?.checkIn || stay?.checkIn || new Date().toISOString().split('T')[0];
  const checkOutDate = reservation?.checkOut || stay?.checkOut || new Date().toISOString().split('T')[0];
  const checkInTime = stay?.checkInAt ? new Date(stay.checkInAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '14:00';
  const checkOutTime = '12:00 m.';

  const nights = reservation?.nights || 1;
  const nightlyRate = pricing.nightlyRate || (reservation?.total ? Number(reservation.total) / nights : 130);
  const totalStay = pricing.totalStay || Number(reservation?.total || nightlyRate * nights);
  const advancePaid = pricing.advancePaid || 0;
  const pendingBalance = Math.max(0, totalStay - advancePaid);

  return (
    <div className="stay-conditions-document-wrapper">
      {/* Print Controls Bar (Hidden during printing) */}
      <div className="no-print stay-document-controls">
        <div className="stay-document-control-title">
          <FileCheck size={20} color="#D4AF37" />
          <span className="stay-document-control-label">
            Documento Oficial de Condiciones de Estadía
          </span>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="stay-document-print-button"
        >
          <Printer size={16} /> Imprimir / Guardar PDF
        </button>
      </div>

      {/* Main Document Body */}
      <div
        ref={documentRef}
        className="printable-stay-document"
      >
        {/* Header Hotel Banner */}
        <div className="stay-document-header">
          <div>
            <h1 className="stay-document-hotel-name">
              {HOTEL_INFO.name.toUpperCase()}
            </h1>
            <div className="stay-document-stars">
              {HOTEL_INFO.stars}
            </div>
            <div className="stay-document-hotel-meta stay-document-hotel-meta-spaced">
              RUC: {HOTEL_INFO.ruc} · {HOTEL_INFO.address}
            </div>
            <div className="stay-document-hotel-meta">
              Tel: {HOTEL_INFO.phone} · Email: {HOTEL_INFO.email}
            </div>
          </div>
          <div className="stay-document-registration">
            <div className="stay-document-registration-label">N.º de Registro</div>
            <div className="stay-document-registration-id">
              {stay?.id || reservation?.id || 'DOC-REG-' + new Date().getFullYear()}
            </div>
            <div className="stay-document-registration-date">
              Emisión: {new Date().toLocaleDateString('es-PE')}
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="stay-document-title">
          <h2 className="stay-document-title-heading">
            Documento de Reconocimiento de Gastos, Condiciones y Responsabilidades de Estadía
          </h2>
          <p className="stay-document-title-copy">
            Conformidad de ingreso, cargos a cuenta acumulada, políticas internas y estado de habitación
          </p>
        </div>

        {/* 1. Datos del Huésped y de la Estadía */}
        <div className="stay-document-section">
          <h3 className="stay-document-section-heading">
            1. Datos del Huésped y de la Estadía
          </h3>
          <div className="stay-document-guest-grid">
            <div><strong>Huésped Principal:</strong> {guestName}</div>
            <div><strong>Documento Identidad:</strong> {guestDoc}</div>
            <div><strong>Teléfono:</strong> {guestPhone}</div>
            <div><strong>Correo Electrónico:</strong> {guestEmail}</div>
            <div><strong>Habitación Asignada:</strong> N.º {roomNumber} ({roomCategory})</div>
            <div><strong>Noches de Estadía:</strong> {nights} noche(s)</div>
            <div><strong>Fecha de Ingreso (Check-in):</strong> {checkInDate} — {checkInTime}</div>
            <div><strong>Fecha Prevista de Salida (Check-out):</strong> {checkOutDate} — {checkOutTime}</div>
          </div>
        </div>

        {/* 2. Resumen Económico */}
        <div className="stay-document-section">
          <h3 className="stay-document-section-heading">
            2. Resumen Económico Inicial
          </h3>
          <table className="stay-document-summary-table">
            <thead>
              <tr className="stay-document-table-header">
                <th>Concepto</th>
                <th className="stay-document-number-cell">Tarifa Unitaria</th>
                <th className="stay-document-number-cell">Noches / Cant.</th>
                <th className="stay-document-number-cell">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr className="stay-document-table-row">
                <td>Hospedaje Habitación {roomCategory}</td>
                <td className="stay-document-number-cell">{formatMoney(nightlyRate)}</td>
                <td className="stay-document-number-cell">{nights}</td>
                <td className="stay-document-number-cell stay-document-total-cell">{formatMoney(totalStay)}</td>
              </tr>
              <tr className="stay-document-table-row stay-document-paid-row">
                <td>Adelantos / Pagos registrados al momento</td>
                <td className="stay-document-number-cell">—</td>
                <td className="stay-document-number-cell">—</td>
                <td className="stay-document-number-cell stay-document-total-cell">- {formatMoney(advancePaid)}</td>
              </tr>
              <tr className="stay-document-balance-row">
                <td colSpan={3}>Saldo pendiente estimado por hospedaje:</td>
                <td className="stay-document-number-cell">{formatMoney(pendingBalance)}</td>
              </tr>
            </tbody>
          </table>
          <p className="stay-document-note">
            * El saldo final podrá variar de acuerdo con consumos adicionales de restaurante, bar, room service, lavandería, daños o servicios especiales solicitados y autorizados durante la estadía.
          </p>
        </div>

        {/* 3. Condiciones de Consumos y Cuenta Acumulada */}
        <div className="stay-document-section stay-document-section-tight">
          <h3 className="stay-document-section-heading">
            3. Gastos Adicionales y Cuenta Acumulada (Folio)
          </h3>
          <p className="stay-document-paragraph">
            El huésped autoriza que todos los consumos realizados por él o sus acompañantes en el Restaurante, Bar, Servicio a la habitación (Room Service), Lavandería y Áreas recreativas sean cargados directamente al <strong>Folio de su Habitación</strong>. Cada consumo registrado incluirá fecha, hora, detalle, importe y firma/identificación del solicitante.
          </p>
        </div>

        {/* 4. Tarifario de Daños y Penalidades */}
        <div className="stay-document-section stay-document-section-tight">
          <h3 className="stay-document-section-heading">
            4. Tarifario Oficial de Daños y Penalidades
          </h3>
          <div className="stay-document-penalty-grid">
            {PENALTY_RATES.map((pen, idx) => (
              <div key={idx} className="stay-document-penalty-row">
                <span>• {pen.concept}:</span>
                <strong>{typeof pen.amount === 'number' ? formatMoney(pen.amount) : pen.amount}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Estado Inicial de la Habitación (Checklist) */}
        <div className="stay-document-section stay-document-section-tight">
          <h3 className="stay-document-section-heading">
            5. Verificación y Estado Inicial de la Habitación
          </h3>
          <div className="stay-document-checklist-grid">
            {checklist.map((item) => (
              <label key={item.id} className={`stay-document-checklist-item ${isReadOnly ? 'is-read-only' : 'is-editable'}`}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    if (onChecklistChange) {
                      onChecklistChange(checklist.map(c => c.id === item.id ? { ...c, checked: e.target.checked } : c));
                    }
                  }}
                  className="stay-document-checkbox"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 6. Declaración de Conformidad */}
        <div className="stay-document-section stay-document-conformity-section">
          <h3 className="stay-document-section-heading">
            6. Declaración de Conformidad y Aceptación
          </h3>
          <div className="stay-document-conformity-copy">
            El huésped declara que ha sido debidamente informado sobre las tarifas contratadas, las normas de convivencia del hotel, el horario límite de salida (12:00 m.), las políticas de penalidades por daños y el sistema de cargos al Folio. Con su firma a continuación, expresa su plena conformidad con todas las condiciones estipuladas.
          </div>
        </div>

        {/* 7. Sección de Firmas Digitales */}
        <div className="stay-document-signatures">
          {/* Firma del Huésped */}
          <div className="stay-document-signature-column">
            <div className="stay-document-guest-signature-box">
              {guestSignature ? (
                <img
                  src={guestSignature}
                  alt="Firma del Huésped"
                  className="stay-document-signature-image"
                />
              ) : (
                <span className="stay-document-signature-pending">
                  Pendiente de firma digital
                </span>
              )}
            </div>
            <div className="stay-document-signature-caption">
              <div className="stay-document-signature-name">{guestName}</div>
              <div className="stay-document-signature-document">{guestDoc}</div>
              <div className="stay-document-signature-role">FIRMA DEL HUÉSPED / TITULAR</div>
            </div>
          </div>

          {/* Firma / Sello del Hotel */}
          <div className="stay-document-signature-column">
            <div className="stay-document-hotel-signature-box">
              <div className="stay-document-hotel-stamp">
                <div>HOTEL PARK PLAZA</div>
                <div className="stay-document-stamp-label">VALIDADO EN RECEPCIÓN</div>
                <div className="stay-document-stamp-name">{receptionistName}</div>
              </div>
            </div>
            <div className="stay-document-signature-caption">
              <div className="stay-document-signature-name">{receptionistName}</div>
              <div className="stay-document-signature-document">Recepción / Front Desk</div>
              <div className="stay-document-signature-role">REPRESENTANTE DEL HOTEL</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="stay-document-footer">
          Documento generado y custodiado digitalmente bajo estándares de trazabilidad y seguridad por Hotel Park Plaza S.A.C.
        </div>
      </div>
    </div>
  );
}
