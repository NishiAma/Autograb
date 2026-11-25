import { MAKE_LABELS, VEHICLES } from '../data/vehicles.js';
import type { MakeOption, VehicleCatalogue, VehicleSelection } from '../types/vehicle.js';
import { AppError } from '../utils/AppError.js';

/**
 * Read-only queries over the vehicle catalogue.
 *
 * `Object.hasOwn` is used for lookups so that inputs like "constructor" or
 * "__proto__" can never resolve to inherited object properties.
 */
export function createVehicleService(catalogue: VehicleCatalogue = VEHICLES) {
  function getMakes(): MakeOption[] {
    return Object.keys(catalogue).map((make) => ({
      value: make,
      label: MAKE_LABELS[make] ?? make,
    }));
  }

  function getModels(make: string): string[] {
    if (!Object.hasOwn(catalogue, make)) {
      throw new AppError(404, 'MAKE_NOT_FOUND', `Unknown make "${make}".`);
    }
    return Object.keys(catalogue[make]!);
  }

  function getBadges(make: string, model: string): string[] {
    const models = Object.hasOwn(catalogue, make) ? catalogue[make]! : undefined;
    if (!models) {
      throw new AppError(404, 'MAKE_NOT_FOUND', `Unknown make "${make}".`);
    }
    if (!Object.hasOwn(models, model)) {
      throw new AppError(404, 'MODEL_NOT_FOUND', `Model "${model}" is not available for make "${make}".`);
    }
    return [...models[model]!];
  }

  /** Throws a 400 describing the first part of the selection that is invalid. */
  function assertValidSelection({ make, model, badge }: VehicleSelection): void {
    const models = Object.hasOwn(catalogue, make) ? catalogue[make]! : undefined;
    if (!models) {
      throw new AppError(400, 'INVALID_MAKE', `Unknown make "${make}".`);
    }
    const badges = Object.hasOwn(models, model) ? models[model]! : undefined;
    if (!badges) {
      throw new AppError(400, 'INVALID_MODEL', `Model "${model}" does not belong to make "${make}".`);
    }
    if (!badges.includes(badge)) {
      throw new AppError(400, 'INVALID_BADGE', `Badge "${badge}" does not belong to model "${model}".`);
    }
  }

  return { getMakes, getModels, getBadges, assertValidSelection };
}

export const vehicleService = createVehicleService();
