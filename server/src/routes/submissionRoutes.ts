import { Router, type RequestHandler } from 'express';
import { decodeLogbook } from '../services/logbookService.js';
import type { createVehicleService } from '../services/vehicleService.js';
import type { ApiSuccess, SubmissionData } from '../types/api.js';
import type { VehicleSelection } from '../types/vehicle.js';
import { AppError } from '../utils/AppError.js';
import { readString } from '../utils/requestValues.js';

type VehicleService = ReturnType<typeof createVehicleService>;

// Required by the assessment brief: the success message must contain "there is no spoon".
export const SUCCESS_MESSAGE = 'Upload successful - there is no spoon';

const REQUIRED_FIELDS = ['make', 'model', 'badge'] as const;

/** Reads make/model/badge from the multipart body, reporting every missing field at once. */
function readSelection(body: unknown): VehicleSelection {
  const source = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const details: Record<string, string> = {};
  const selection: Partial<VehicleSelection> = {};

  for (const field of REQUIRED_FIELDS) {
    const value = readString(source[field]);
    if (value) selection[field] = value;
    else details[field] = `${field} is required.`;
  }

  if (Object.keys(details).length > 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Make, model and badge are all required.', details);
  }
  return selection as VehicleSelection;
}

export function createSubmissionRouter(vehicleService: VehicleService, logbookUpload: RequestHandler): Router {
  const router = Router();

  // POST /api/submissions  (multipart/form-data: make, model, badge, logbook)
  router.post('/', logbookUpload, (req, res) => {
    const selection = readSelection(req.body);
    vehicleService.assertValidSelection(selection);

    if (!req.file) {
      throw new AppError(400, 'MISSING_FILE', 'A service logbook file is required.');
    }

    const body: ApiSuccess<SubmissionData> = {
      success: true,
      message: SUCCESS_MESSAGE,
      data: {
        ...selection,
        logbookFileName: req.file.originalname,
        logbookContents: decodeLogbook(req.file.buffer),
      },
    };
    res.status(201).json(body);
  });

  return router;
}
