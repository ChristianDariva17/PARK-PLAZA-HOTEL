import React from 'react';
import { Dialog } from '../components/ui/Overlay.jsx';
import { Printer, QrCode } from 'lucide-react';
import { formatMoney, formatDateTime } from '../domain/hotelModel.js';

export function ParkingTicketModal({ open, onClose, vehicle, clientName = '' }) {
  if (!open || !vehicle) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Comprobante de Cochera"
      description="Ticket de control de acceso vehicular para impresión térmica o comprobante del huésped."
    >
      <div className="parking-ticket-modal">
        {/* Ticket Térmico 80mm Container */}
        <div
          id="parking-thermal-ticket"
          className="parking-ticket"
          data-ticket-layout="thermal"
        >
          {/* Header */}
          <div className="parking-ticket-header">
            <div className="parking-ticket-hotel-label">
              HOTEL
            </div>
            <div className="parking-ticket-brand">
              PARK PLAZA
            </div>
            <div className="parking-ticket-stars">★★★★★</div>
            <div className="parking-ticket-title">
              CONTROL DE COCHERA
            </div>
            <div className="parking-ticket-number">
              Ticket N°: {vehicle.id}
            </div>
          </div>

          {/* Placa & Espacio Destacados */}
          <div
            className="parking-ticket-vehicle-summary"
          >
            <div className="parking-ticket-label">Placa del Vehículo</div>
            <div className="parking-ticket-plate">
              {vehicle.plate}
            </div>
            <div className="parking-ticket-space-info">
              <span className="parking-ticket-space">ESPACIO: {vehicle.space}</span>
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
          <div className="parking-ticket-details">
            <div className="parking-ticket-row">
              <span className="parking-ticket-muted">Tipo / Modelo:</span>
              <span className="parking-ticket-value">{vehicle.type} · {vehicle.brandModel || 'S/M'}</span>
            </div>
            {vehicle.color ? (
              <div className="parking-ticket-row">
                <span className="parking-ticket-muted">Color:</span>
                <span className="parking-ticket-value">{vehicle.color}</span>
              </div>
            ) : null}
            <div className="parking-ticket-row">
              <span className="parking-ticket-muted">Titular / Conductor:</span>
              <span className="parking-ticket-value parking-ticket-driver">
                {vehicle.driverName || clientName || 'No especificado'}
              </span>
            </div>
            {vehicle.driverPhone ? (
              <div className="parking-ticket-row">
                <span className="parking-ticket-muted">Teléfono:</span>
                <span className="parking-ticket-value">{vehicle.driverPhone}</span>
              </div>
            ) : null}
            {vehicle.stayId ? (
              <div className="parking-ticket-row">
                <span className="parking-ticket-muted">Estadía:</span>
                <span className="parking-ticket-value">{vehicle.stayId?.slice(0, 10)}...</span>
              </div>
            ) : null}
            {vehicle.keysLeft ? (
              <div className="parking-ticket-row parking-ticket-keys">
                <span className="parking-ticket-value">Custodia de llaves:</span>
                <span className="parking-ticket-value">🔑 En Recepción</span>
              </div>
            ) : null}
            <div className="parking-ticket-row">
              <span className="parking-ticket-muted">Ingreso:</span>
              <span className="parking-ticket-value">{formatDateTime(vehicle.entryAt)}</span>
            </div>
            {vehicle.exitAt ? (
              <div className="parking-ticket-row">
                <span className="parking-ticket-muted">Salida:</span>
                <span className="parking-ticket-value">{formatDateTime(vehicle.exitAt)}</span>
              </div>
            ) : (
              <div className="parking-ticket-row">
                <span className="parking-ticket-muted">Estado:</span>
                <span className="parking-ticket-status">● DENTRO</span>
              </div>
            )}
            <div className="parking-ticket-row parking-ticket-total">
              <span className="parking-ticket-value">Tarifa Folio:</span>
              <span className="parking-ticket-total-value">{formatMoney(vehicle.fee)}</span>
            </div>
            {vehicle.entryResponsible ? (
              <div className="parking-ticket-row parking-ticket-registered-by">
                <span>Registrado por:</span>
                <span>{vehicle.entryResponsible}</span>
              </div>
            ) : null}
          </div>

          {/* QR / Código de Barras Representativo */}
          <div className="parking-ticket-qr-section">
            <div className="parking-ticket-qr">
              <QrCode size={64} />
            </div>
            <div className="parking-ticket-qr-code">
              *{vehicle.id}*
            </div>
          </div>

          {/* Cláusula Legal / Disclaimer */}
          <div className="parking-ticket-disclaimer">
            Conserve este ticket para la autorización de retiro de su vehículo. El hotel no se responsabiliza por dinero, joyas u objetos de valor dejados en el interior.
          </div>
        </div>

        {/* Acciones del Modal */}
        <div className="form-actions parking-ticket-actions">
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
