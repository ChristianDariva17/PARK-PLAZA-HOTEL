import React, { useState } from 'react';
import { Car, Bike } from 'lucide-react';

import { DEFAULT_PARKING_SPACES } from './parkingModel.js';

// Keep the historical component-module export for existing consumers.
export { DEFAULT_PARKING_SPACES } from './parkingModel.js';

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
    <div className="parking-map">
      {/* Barra superior con KPIs de Capacidad y Barra de Ocupación */}
      <div
        className="card parking-map-summary"
      >
          <div className="parking-map-summary-header">
          <div>
            <span className="parking-map-kicker">
              Estado del Estacionamiento
            </span>
            <h3 className="parking-map-summary-title">
              {occupiedCount} de {totalSpaces} espacios ocupados ({occupancyPercent}%)
            </h3>
          </div>
          <div className="parking-map-legend">
            <span className="parking-map-legend-item">
              <span className="parking-map-dot parking-map-dot-available" />
              {availableCount} Disponibles
            </span>
            <span className="parking-map-legend-item">
              <span className="parking-map-dot parking-map-dot-occupied" />
              {occupiedCount} Ocupados
            </span>
          </div>
        </div>

        {/* Barra de progreso visual */}
        <div className="parking-map-progress">
          <div
            className={`parking-map-progress-bar ${occupancyPercent >= 90 ? 'is-danger' : occupancyPercent >= 70 ? 'is-warning' : 'is-healthy'}`}
            data-occupancy={Math.round(occupancyPercent / 10) * 10}
          />
        </div>

        {/* Selector de filtros de tipo */}
        <div className="parking-map-filters">
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
        className="parking-map-grid"
      >
        {filteredSpaces.map((space) => {
          const vehicle = vehicleBySpace.get(space.code);
          const isOccupied = Boolean(vehicle);
          const isMoto = space.type === 'Moto';

          return (
            <div
              key={space.id}
              className={`parking-space-card ${isOccupied ? 'is-occupied' : 'is-available'} ${isMoto ? 'is-moto' : 'is-auto'}`}
            >
              {/* Encabezado del slot */}
              <div className="parking-space-header">
                <div className="parking-space-heading">
                  <div
                    className="parking-space-icon"
                  >
                    {isMoto ? <Bike size={18} /> : <Car size={18} />}
                  </div>
                  <div>
                    <strong className="parking-space-code">{space.code}</strong>
                    <div className="parking-space-type">{space.type}</div>
                  </div>
                </div>
                <span
                  className="parking-space-status"
                >
                  {isOccupied ? 'OCUPADO' : 'LIBRE'}
                </span>
              </div>

              {/* Cuerpo: detalles si está ocupado, o prompt para ingresar si está libre */}
              <div className="parking-space-body">
                {isOccupied ? (
                  <div className="parking-space-vehicle">
                    <div className="parking-space-plate">
                      {vehicle.plate}
                      {vehicle.color ? <span className="parking-space-color">({vehicle.color})</span> : null}
                    </div>
                    <div className="parking-space-model">
                      {vehicle.brandModel || vehicle.type}
                    </div>
                    <div className="parking-space-tags">
                      {vehicle.roomId ? (
                        <span
                          className="parking-space-room"
                        >
                          Hab. {vehicle.roomId}
                        </span>
                      ) : (
                        <span
                          className="parking-space-origin"
                        >
                          {vehicle.originType === 'restaurant' ? '🍴 Restaurante' : vehicle.originType === 'event' ? '🎉 Evento' : '🚗 Visita'} · {vehicle.driverName || 'Externo'}
                        </span>
                      )}
                      {vehicle.keysLeft ? (
                        <span className="parking-space-keys">🔑 Llaves</span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="parking-space-empty">
                    Espacio disponible para asignación
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="parking-space-actions">
                {isOccupied ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline parking-space-action"
                      onClick={() => onVehicleClick?.(vehicle)}
                    >
                      Detalles
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary parking-space-action"
                      onClick={() => onVehicleExit?.(vehicle)}
                    >
                      Salida
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline parking-space-assign"
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
