import type { QuickSelectVehicle } from '../types/vehicle';

/**
 * Presets for the quick-select buttons. These are a UI convenience, not a copy
 * of the catalogue: each preset is checked against the API's options before it
 * is applied, so a stale preset produces an error rather than an invalid form.
 */
export const QUICK_SELECT_VEHICLES: readonly QuickSelectVehicle[] = [
  { label: 'Ford Ranger Raptor', make: 'ford', model: 'Ranger', badge: 'Raptor' },
  { label: 'Tesla Model 3 Performance', make: 'tesla', model: 'Model 3', badge: 'Performance' },
  { label: 'BMW 130d xDrive 26d', make: 'bmw', model: '130d', badge: 'xDrive 26d' },
];
