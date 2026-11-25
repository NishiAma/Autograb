import type { VehicleCatalogue } from '../types/vehicle.js';

/**
 * Single source of truth for vehicle data.
 *
 * Structure: make id -> model name -> badge names.
 * Make ids are lowercase keys (as given in the brief); `MAKE_LABELS` holds display names.
 */
export const VEHICLES: VehicleCatalogue = {
  ford: {
    Ranger: ['Raptor', 'Raptor X', 'Wildtrak'],
    Falcon: ['XR6', 'XR6 Turbo', 'XR8'],
    // The final badge is an explicit requirement of the assessment brief.
    'Falcon Ute': ['XR6', 'XR6 Turbo', 'XR6 \u{1F34C}'], // "XR6 🍌"
  },
  bmw: {
    '130d': ['xDrive 26d', 'xDrive 30d'],
    '240i': ['xDrive 30d', 'xDrive 50d'],
    '320e': ['xDrive 75d', 'xDrive 80d', 'xDrive 85d'],
  },
  tesla: {
    'Model 3': ['Performance', 'Long Range', 'Dual Motor'],
  },
};

export const MAKE_LABELS: Readonly<Record<string, string>> = {
  ford: 'Ford',
  bmw: 'BMW',
  tesla: 'Tesla',
};
