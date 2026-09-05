import React from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { Printer, QrCode, ShieldCheck, Car, Clock } from 'lucide-react';
import { formatMoney, formatDateTime } from '../domain/hotelModel.js';

export function ParkingTicketModal({ open, onClose, vehicle, clientName = '' }) {
  if (!open || !vehicle) return null;

  const handlePrint = () => {
    window.print();
  };

  const isInside = vehicle.status === 'Dentro';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Comprobante de Cochera"
      description="Ticket de control de acceso vehicular para impresión térmica o comprobante del huésped."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Ticket Térmico 80mm Container */}
        <div
          id="parking-thermal-ticket"
          style={{
            maxWidth: '360px',
            margin: '0 auto',
            padding: '24px 20px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
            fontFamily: "'Courier New', Courier, monospace",
            color: '#0f172a',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', borderBottom: '1px dashed #94a3b8', paddingBottom: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#64748b' }}>
              HOTEL
            </div>
            <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '0.05em', margin: '2px 0' }}>
              PARK PLAZA
            </div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>★★★★★</div>
            <div style={{ fontSize: '11px', fontWeight: 700, marginTop: '4px', textTransform: 'uppercase' }}>
              CONTROL DE COCHERA
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>
              Ticket N°: {vehicle.id}
            </div>
          </div>

          {/* Placa & Espacio Destacados */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center',
              marginBottom: '14px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Placa del Vehículo</div>
            <div style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '0.1em', margin: '2px 0' }}>
              {vehicle.plate}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '12px', fontWeight: 700 }}>
              <span style={{ color: '#0369a1' }}>ESPACIO: {vehicle.space}</span>
              {vehicle.roomId ? (
                <>
                  <span>·</span>
                  <span>HAB: {vehicle.roomId}</span>
                </>
              ) : (
                <>
                  <span>·</span>
                  <span>{vehicle.originType === 'restaurant' ? 'RESTAURANTE' : vehicle.originType === 'event' ? 'EVENTO' : 'EXTERNO'}</span>
                </>
              )}
            </div>
          </div>

          {/* Datos Detallados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Tipo / Modelo:</span>
              <span style={{ fontWeight: 600 }}>{vehicle.type} · {vehicle.brandModel || 'S/M'}</span>
            </div>
            {vehicle.color ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Color:</span>
                <span style={{ fontWeight: 600 }}>{vehicle.color}</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Titular / Conductor:</span>
              <span style={{ fontWeight: 600, maxWidth: '180px', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {vehicle.driverName || clientName || 'No especificado'}
              </span>
            </div>
            {vehicle.driverPhone ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Teléfono:</span>
                <span style={{ fontWeight: 600 }}>{vehicle.driverPhone}</span>
              </div>
            ) : null}
            {vehicle.stayId ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Estadía:</span>
                <span style={{ fontWeight: 600 }}>{vehicle.stayId?.slice(0, 10)}...</span>
              </div>
            ) : null}
            {vehicle.keysLeft ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}>
                <span style={{ fontWeight: 700 }}>Custodia de llaves:</span>
                <span style={{ fontWeight: 700 }}>🔑 En Recepción</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Ingreso:</span>
              <span style={{ fontWeight: 600 }}>{formatDateTime(vehicle.entryAt)}</span>
            </div>
            {vehicle.exitAt ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Salida:</span>
                <span style={{ fontWeight: 600 }}>{formatDateTime(vehicle.exitAt)}</span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Estado:</span>
                <span style={{ fontWeight: 700, color: '#15803d' }}>● DENTRO</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: '4px' }}>
              <span style={{ fontWeight: 700 }}>Tarifa Folio:</span>
              <span style={{ fontWeight: 900, color: '#0f172a' }}>{formatMoney(vehicle.fee)}</span>
            </div>
            {vehicle.entryResponsible ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                <span>Registrado por:</span>
                <span>{vehicle.entryResponsible}</span>
              </div>
            ) : null}
          </div>

          {/* QR / Código de Barras Representativo */}
          <div style={{ textAlign: 'center', padding: '12px 0', borderTop: '1px dashed #94a3b8', borderBottom: '1px dashed #94a3b8', marginBottom: '12px' }}>
            <div style={{ display: 'inline-flex', padding: '6px', backgroundColor: '#f1f5f9', borderRadius: '6px', marginBottom: '4px' }}>
              <QrCode size={64} />
            </div>
            <div style={{ fontSize: '10px', letterSpacing: '0.2em', color: '#64748b' }}>
              *{vehicle.id}*
            </div>
          </div>

          {/* Cláusula Legal / Disclaimer */}
          <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'center', lineHeight: '1.3' }}>
            Conserve este ticket para la autorización de retiro de su vehículo. El hotel no se responsabiliza por dinero, joyas u objetos de valor dejados en el interior.
          </div>
        </div>

        {/* Acciones del Modal */}
        <div className="form-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePrint}>
            <Printer size={16} /> Imprimir ticket (80mm)
          </button>
        </div>
      </div>
    </Dialog>
  );
}
