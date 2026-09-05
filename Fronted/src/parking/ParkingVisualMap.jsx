import React, { useState } from 'react';
import { Car, Bike, CheckCircle2, Clock, DoorClosed, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatDateTime } from '../domain/hotelModel.js';

export const DEFAULT_PARKING_SPACES = [
  { id: 'E-01', code: 'E-01', type: 'Auto', label: 'Cochera 01' },
  { id: 'E-02', code: 'E-02', type: 'Auto', label: 'Cochera 02' },
  { id: 'E-03', code: 'E-03', type: 'Auto', label: 'Cochera 03' },
  { id: 'E-04', code: 'E-04', type: 'Auto', label: 'Cochera 04' },
  { id: 'E-05', code: 'E-05', type: 'Auto', label: 'Cochera 05' },
  { id: 'E-06', code: 'E-06', type: 'Auto', label: 'Cochera 06' },
  { id: 'E-07', code: 'E-07', type: 'Auto', label: 'Cochera 07' },
  { id: 'E-08', code: 'E-08', type: 'Auto', label: 'Cochera 08' },
  { id: 'E-09', code: 'E-09', type: 'Auto', label: 'Cochera 09' },
  { id: 'E-10', code: 'E-10', type: 'Auto', label: 'Cochera 10' },
  { id: 'E-11', code: 'E-11', type: 'Auto', label: 'Cochera 11' },
  { id: 'E-12', code: 'E-12', type: 'Auto', label: 'Cochera 12' },
  { id: 'M-01', code: 'M-01', type: 'Moto', label: 'Bahía Moto 01' },
  { id: 'M-02', code: 'M-02', type: 'Moto', label: 'Bahía Moto 02' },
  { id: 'M-03', code: 'M-03', type: 'Moto', label: 'Bahía Moto 03' },
  { id: 'M-04', code: 'M-04', type: 'Moto', label: 'Bahía Moto 04' },
];

export function ParkingVisualMap({
  vehicles = [],
  onSelectAvailableSpace,
  onVehicleClick,
  onVehicleExit,
}) {
  const [filterType, setFilterType] = useState('Todos');

  // Map vehicles currently inside by normalized space name
  const activeVehicles = vehicles.filter((v) => v.status === 'Dentro');
  const vehicleBySpace = new Map();
  activeVehicles.forEach((v) => {
    if (v.space) {
      vehicleBySpace.set(v.space.toUpperCase().trim(), v);
    }
  });

  const totalSpaces = DEFAULT_PARKING_SPACES.length;
  const occupiedCount = activeVehicles.length;
  const availableCount = Math.max(0, totalSpaces - occupiedCount);
  const occupancyPercent = Math.min(100, Math.round((occupiedCount / totalSpaces) * 100));

  const filteredSpaces = DEFAULT_PARKING_SPACES.filter((space) => {
    if (filterType === 'Todos') return true;
    if (filterType === 'Auto') return space.type === 'Auto';
    if (filterType === 'Moto') return space.type === 'Moto';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Barra superior con KPIs de Capacidad y Barra de Ocupación */}
      <div
        className="card"
        style={{
          padding: '18px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border, #e2e8f0)',
          borderRadius: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-muted, #64748b)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estado del Estacionamiento
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
              {occupiedCount} de {totalSpaces} espacios ocupados ({occupancyPercent}%)
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
              {availableCount} Disponibles
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500 }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
              {occupiedCount} Ocupados
            </span>
          </div>
        </div>

        {/* Barra de progreso visual */}
        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-border, #e2e8f0)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${occupancyPercent}%`,
              height: '100%',
              backgroundColor: occupancyPercent >= 90 ? '#ef4444' : occupancyPercent >= 70 ? '#f59e0b' : '#10b981',
              transition: 'width 0.4s ease',
              borderRadius: '4px',
            }}
          />
        </div>

        {/* Selector de filtros de tipo */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          {['Todos', 'Auto', 'Moto'].map((type) => (
            <button
              key={type}
              type="button"
              className={`btn btn-sm ${filterType === type ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilterType(type)}
            >
              {type === 'Todos' ? 'Todos los espacios' : type === 'Auto' ? '🚗 Autos / Camionetas' : '🏍️ Motos'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Espacios Visuales */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {filteredSpaces.map((space) => {
          const vehicle = vehicleBySpace.get(space.code);
          const isOccupied = Boolean(vehicle);
          const isMoto = space.type === 'Moto';

          return (
            <div
              key={space.id}
              style={{
                borderRadius: '14px',
                border: isOccupied ? '2px solid rgba(239, 68, 68, 0.4)' : '1px dashed #10b981',
                backgroundColor: isOccupied ? 'rgba(254, 242, 242, 0.6)' : 'rgba(240, 253, 244, 0.5)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '160px',
                transition: 'all 0.2s ease',
                boxShadow: isOccupied ? '0 2px 8px rgba(239, 68, 68, 0.08)' : 'none',
              }}
            >
              {/* Encabezado del slot */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isOccupied ? '#fee2e2' : '#dcfce7',
                      color: isOccupied ? '#dc2626' : '#16a34a',
                    }}
                  >
                    {isMoto ? <Bike size={18} /> : <Car size={18} />}
                  </div>
                  <div>
                    <strong style={{ fontSize: '15px', color: 'var(--color-text, #0f172a)' }}>{space.code}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--color-muted, #64748b)' }}>{space.type}</div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '20px',
                    backgroundColor: isOccupied ? '#fee2e2' : '#dcfce7',
                    color: isOccupied ? '#b91c1c' : '#15803d',
                  }}
                >
                  {isOccupied ? 'OCUPADO' : 'LIBRE'}
                </span>
              </div>

              {/* Cuerpo: detalles si está ocupado, o prompt para ingresar si está libre */}
              <div style={{ marginTop: '12px', flex: 1 }}>
                {isOccupied ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '0.05em' }}>
                      {vehicle.plate}
                      {vehicle.color ? <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--color-muted, #64748b)', marginLeft: '6px' }}>({vehicle.color})</span> : null}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {vehicle.brandModel || vehicle.type}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                      {vehicle.roomId ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: 'var(--color-surface-hover, #f1f5f9)',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border, #e2e8f0)',
                          }}
                        >
                          Hab. {vehicle.roomId}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '6px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                          }}
                        >
                          {vehicle.originType === 'restaurant' ? '🍴 Restaurante' : vehicle.originType === 'event' ? '🎉 Evento' : '🚗 Visita'} · {vehicle.driverName || 'Externo'}
                        </span>
                      )}
                      {vehicle.keysLeft ? (
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#d97706' }}>🔑 Llaves</span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', height: '100%', color: '#15803d', fontSize: '12px', fontWeight: 500 }}>
                    Espacio disponible para asignación
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div style={{ marginTop: '14px', display: 'flex', gap: '6px' }}>
                {isOccupied ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                      onClick={() => onVehicleClick?.(vehicle)}
                    >
                      Detalles
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      style={{ flex: 1, fontSize: '11px', padding: '4px 8px' }}
                      onClick={() => onVehicleExit?.(vehicle)}
                    >
                      Salida
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    style={{ width: '100%', fontSize: '12px', borderColor: '#10b981', color: '#16a34a' }}
                    onClick={() => onSelectAvailableSpace?.(space.code, space.type)}
                  >
                    + Asignar ingreso
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
