import React, { useRef } from 'react';
import { Printer, Check, Shield, Building, User, Calendar, DollarSign, AlertCircle, FileCheck } from 'lucide-react';
import { formatMoney } from '../domain/hotelModel.js';

export const HOTEL_INFO = {
  name: 'Hotel Park Plaza',
  stars: '★★★★★',
  ruc: '20601234567',
  address: 'Av. Principal 123, Miraflores, Lima - Perú',
  phone: '+51 (01) 555-0199 / +51 987 654 321',
  email: 'recepcion@parkplaza.pe',
  website: 'www.parkplazahotel.pe',
};

export const DEFAULT_CHECKLIST = [
  { id: 'tv', label: 'Televisor Smart TV operativo y pantalla intacta', checked: true },
  { id: 'remote', label: 'Control remoto de TV y AC entregados y con baterías', checked: true },
  { id: 'ac', label: 'Aire acondicionado y calefacción en correcto funcionamiento', checked: true },
  { id: 'lights', label: 'Iluminación y tomas eléctricas operativas', checked: true },
  { id: 'bathroom', label: 'Sanitarios, grifería y agua caliente operativos', checked: true },
  { id: 'towels', label: 'Juego de toallas completo y en perfecto estado', checked: true },
  { id: 'bedding', label: 'Sábanas, almohadas y cobertor limpios e intactos', checked: true },
  { id: 'furniture', label: 'Mobiliario, veladores y closets sin deterioros', checked: true },
  { id: 'key', label: 'Tarjeta de acceso / Llave de habitación entregada', checked: true },
];

export const PENALTY_RATES = [
  { concept: 'Pérdida o daño de tarjeta / llave de acceso', amount: 40.00 },
  { concept: 'Limpieza extraordinaria (manchas graves, olor a tabaco)', amount: 120.00 },
  { concept: 'Pérdida de control remoto (TV o aire acondicionado)', amount: 60.00 },
  { concept: 'Daño en toallas o ropa de cama', amount: 80.00 },
  { concept: 'Daño o rotura de mobiliario / equipos', amount: 'Según valuación técnica' },
  { concept: 'Salida tardía no autorizada (Late check-out > 13:00)', amount: '50% tarifa diaria' },
];

export function StayConditionsDocument({
  reservation,
  guest,
  room,
  stay,
  pricing = {},
  checklist = DEFAULT_CHECKLIST,
  onChecklistChange,
  guestSignature,
  receptionistSignature,
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
    <div className="stay-conditions-document-wrapper" style={{ color: '#0F172A', background: '#FFFFFF', padding: 0 }}>
      {/* Print Controls Bar (Hidden during printing) */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#0F172A',
        color: '#F8FAFC',
        padding: '12px 20px',
        borderRadius: 8,
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileCheck size={20} color="#D4AF37" />
          <span style={{ fontWeight: 700, fontSize: 14 }}>
            Documento Oficial de Condiciones de Estadía
          </span>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 6,
            background: '#D4AF37',
            color: '#0F172A',
            border: 'none',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <Printer size={16} /> Imprimir / Guardar PDF
        </button>
      </div>

      {/* Main Document Body */}
      <div
        ref={documentRef}
        className="printable-stay-document"
        style={{
          border: '1px solid #CBD5E1',
          borderRadius: 8,
          padding: '32px 36px',
          background: '#FFFFFF',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontSize: 12.5,
          lineHeight: 1.5,
          color: '#1E293B',
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        {/* Header Hotel Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #D4AF37', paddingBottom: 16, marginBottom: 20 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0F172A', letterSpacing: '0.05em' }}>
              {HOTEL_INFO.name.toUpperCase()}
            </h1>
            <div style={{ color: '#D4AF37', fontSize: 14, fontWeight: 800, letterSpacing: '0.1em' }}>
              {HOTEL_INFO.stars}
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
              RUC: {HOTEL_INFO.ruc} · {HOTEL_INFO.address}
            </div>
            <div style={{ fontSize: 11, color: '#64748B' }}>
              Tel: {HOTEL_INFO.phone} · Email: {HOTEL_INFO.email}
            </div>
          </div>
          <div style={{ textAlign: 'right', border: '1px solid #E2E8F0', padding: '8px 14px', borderRadius: 6, background: '#F8FAFC' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>N.º de Registro</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A', fontFamily: 'monospace' }}>
              {stay?.id || reservation?.id || 'DOC-REG-' + new Date().getFullYear()}
            </div>
            <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>
              Emisión: {new Date().toLocaleDateString('es-PE')}
            </div>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 900, margin: '0 0 4px', textTransform: 'uppercase', color: '#0F172A', letterSpacing: '0.02em' }}>
            Documento de Reconocimiento de Gastos, Condiciones y Responsabilidades de Estadía
          </h2>
          <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>
            Conformidad de ingreso, cargos a cuenta acumulada, políticas internas y estado de habitación
          </p>
        </div>

        {/* 1. Datos del Huésped y de la Estadía */}
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', background: '#F1F5F9', padding: '4px 10px', borderRadius: 4, margin: '0 0 10px', color: '#0F172A' }}>
            1. Datos del Huésped y de la Estadía
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 20px', fontSize: 12 }}>
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
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', background: '#F1F5F9', padding: '4px 10px', borderRadius: 4, margin: '0 0 10px', color: '#0F172A' }}>
            2. Resumen Económico Inicial
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 6 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                <th style={{ padding: '6px 10px' }}>Concepto</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Tarifa Unitaria</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Noches / Cant.</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '6px 10px' }}>Hospedaje Habitación {roomCategory}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>{formatMoney(nightlyRate)}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>{nights}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>{formatMoney(totalStay)}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#16A34A' }}>
                <td style={{ padding: '6px 10px' }}>Adelantos / Pagos registrados al momento</td>
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>—</td>
                <td style={{ padding: '6px 10px', textAlign: 'right' }}>—</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>- {formatMoney(advancePaid)}</td>
              </tr>
              <tr style={{ background: '#F8FAFC', fontWeight: 900 }}>
                <td style={{ padding: '6px 10px' }} colSpan={3}>Saldo pendiente estimado por hospedaje:</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', color: '#0F172A' }}>{formatMoney(pendingBalance)}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 10.5, color: '#64748B', margin: 0, fontStyle: 'italic' }}>
            * El saldo final podrá variar de acuerdo con consumos adicionales de restaurante, bar, room service, lavandería, daños o servicios especiales solicitados y autorizados durante la estadía.
          </p>
        </div>

        {/* 3. Condiciones de Consumos y Cuenta Acumulada */}
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', background: '#F1F5F9', padding: '4px 10px', borderRadius: 4, margin: '0 0 8px', color: '#0F172A' }}>
            3. Gastos Adicionales y Cuenta Acumulada (Folio)
          </h3>
          <p style={{ fontSize: 11.5, margin: '0 0 6px', color: '#334155' }}>
            El huésped autoriza que todos los consumos realizados por él o sus acompañantes en el Restaurante, Bar, Servicio a la habitación (Room Service), Lavandería y Áreas recreativas sean cargados directamente al <strong>Folio de su Habitación</strong>. Cada consumo registrado incluirá fecha, hora, detalle, importe y firma/identificación del solicitante.
          </p>
        </div>

        {/* 4. Tarifario de Daños y Penalidades */}
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', background: '#F1F5F9', padding: '4px 10px', borderRadius: 4, margin: '0 0 8px', color: '#0F172A' }}>
            4. Tarifario Oficial de Daños y Penalidades
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 16px', fontSize: 11.5 }}>
            {PENALTY_RATES.map((pen, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dotted #CBD5E1', padding: '3px 0' }}>
                <span>• {pen.concept}:</span>
                <strong>{typeof pen.amount === 'number' ? formatMoney(pen.amount) : pen.amount}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Estado Inicial de la Habitación (Checklist) */}
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', background: '#F1F5F9', padding: '4px 10px', borderRadius: 4, margin: '0 0 8px', color: '#0F172A' }}>
            5. Verificación y Estado Inicial de la Habitación
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 12px', fontSize: 11.5 }}>
            {checklist.map((item) => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isReadOnly ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    if (onChecklistChange) {
                      onChecklistChange(checklist.map(c => c.id === item.id ? { ...c, checked: e.target.checked } : c));
                    }
                  }}
                  style={{ accentColor: '#D4AF37' }}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 6. Declaración de Conformidad */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', background: '#F1F5F9', padding: '4px 10px', borderRadius: 4, margin: '0 0 8px', color: '#0F172A' }}>
            6. Declaración de Conformidad y Aceptación
          </h3>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: 10, borderRadius: 6, fontSize: 11, color: '#334155', lineHeight: 1.45 }}>
            El huésped declara que ha sido debidamente informado sobre las tarifas contratadas, las normas de convivencia del hotel, el horario límite de salida (12:00 m.), las políticas de penalidades por daños y el sistema de cargos al Folio. Con su firma a continuación, expresa su plena conformidad con todas las condiciones estipuladas.
          </div>
        </div>

        {/* 7. Sección de Firmas Digitales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 30, marginTop: 24, paddingTop: 16, borderTop: '2px solid #E2E8F0' }}>
          {/* Firma del Huésped */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              height: 100,
              border: '1px solid #CBD5E1',
              borderRadius: 6,
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {guestSignature ? (
                <img
                  src={guestSignature}
                  alt="Firma del Huésped"
                  style={{ maxHeight: '90%', maxWidth: '90%', objectFit: 'contain' }}
                />
              ) : (
                <span style={{ color: '#94A3B8', fontSize: 11, fontStyle: 'italic' }}>
                  Pendiente de firma digital
                </span>
              )}
            </div>
            <div style={{ borderTop: '1px solid #475569', paddingTop: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: '#0F172A' }}>{guestName}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{guestDoc}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>FIRMA DEL HUÉSPED / TITULAR</div>
            </div>
          </div>

          {/* Firma / Sello del Hotel */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              height: 100,
              border: '1px solid #CBD5E1',
              borderRadius: 6,
              background: '#F8FAFC',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 8,
            }}>
              <div style={{
                border: '2px solid #D4AF37',
                borderRadius: 8,
                padding: '6px 14px',
                color: '#D4AF37',
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: '0.05em',
                textAlign: 'center',
                background: 'rgba(212, 175, 55, 0.05)',
              }}>
                <div>HOTEL PARK PLAZA</div>
                <div style={{ fontSize: 9, color: '#64748B' }}>VALIDADO EN RECEPCIÓN</div>
                <div style={{ fontSize: 9, color: '#0F172A', fontWeight: 700 }}>{receptionistName}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #475569', paddingTop: 4 }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: '#0F172A' }}>{receptionistName}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>Recepción / Front Desk</div>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>REPRESENTANTE DEL HOTEL</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 9.5, color: '#94A3B8', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
          Documento generado y custodiado digitalmente bajo estándares de trazabilidad y seguridad por Hotel Park Plaza S.A.C.
        </div>
      </div>
    </div>
  );
}
