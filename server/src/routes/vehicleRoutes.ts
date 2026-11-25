import { Router } from 'express';
import type { createVehicleService } from '../services/vehicleService.js';
import type { ApiSuccess } from '../types/api.js';
import type { MakeOption } from '../types/vehicle.js';
import { AppError } from '../utils/AppError.js';
import { readString } from '../utils/requestValues.js';

type VehicleService = ReturnType<typeof createVehicleService>;

function requireQuery(value: unknown, name: string): string {
  const parsed = readString(value);
  if (!parsed) {
    throw new AppError(400, 'VALIDATION_ERROR', `Query parameter "${name}" is required.`);
  }
  return parsed;
}

export function createVehicleRouter(vehicleService: VehicleService): Router {
  const router = Router();

  // GET /api/vehicles/makes
  router.get('/makes', (_req, res) => {
    const body: ApiSuccess<MakeOption[]> = { success: true, data: vehicleService.getMakes() };
    res.json(body);
  });

  // GET /api/vehicles/models?make=ford
  router.get('/models', (req, res) => {
    const make = requireQuery(req.query.make, 'make');
    const body: ApiSuccess<string[]> = { success: true, data: vehicleService.getModels(make) };
    res.json(body);
  });

  // GET /api/vehicles/badges?make=ford&model=Ranger
  router.get('/badges', (req, res) => {
    const make = requireQuery(req.query.make, 'make');
    const model = requireQuery(req.query.model, 'model');
    const body: ApiSuccess<string[]> = { success: true, data: vehicleService.getBadges(make, model) };
    res.json(body);
  });

  return router;
}
