import { Injectable } from '@nestjs/common';

export interface GeofenceValidationResult {
  isValid: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  message?: string;
}

@Injectable()
export class GeofenceService {
  /**
   * Calculates the great-circle distance between two geographic coordinates using the Haversine formula.
   * @returns Distance in meters.
   */
  calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRadians = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusMeters = 6371000;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
  }

  /**
   * Validates if a user coordinate is within the geofenced perimeter of the property.
   * Considers a dynamic tolerance based on the GPS accuracy reporting (capped at 25m).
   */
  validateGeofence(
    hotelLat: number,
    hotelLon: number,
    hotelRadiusMeters: number,
    userLat: number,
    userLon: number,
    userGpsAccuracyMeters: number = 10
  ): GeofenceValidationResult {
    const distanceMeters = this.calculateDistanceMeters(hotelLat, hotelLon, userLat, userLon);
    
    // GPS accuracy tolerance: give slight margin if GPS accuracy is reasonable (up to 25m)
    const accuracyBuffer = Math.min(Math.max(userGpsAccuracyMeters, 0), 25);
    const effectiveRadius = hotelRadiusMeters + accuracyBuffer;

    const isValid = distanceMeters <= effectiveRadius;

    return {
      isValid,
      distanceMeters: Math.round(distanceMeters * 10) / 10,
      allowedRadiusMeters: hotelRadiusMeters,
      message: isValid
        ? 'Dentro de las instalaciones del hotel'
        : `Estás a ${Math.round(distanceMeters)}m del hotel. El radio permitido es de ${hotelRadiusMeters}m.`
    };
  }
}
