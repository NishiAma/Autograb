import express from 'express';
import { config } from './config.js';
import { createErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createLogbookUpload } from './middleware/logbookUpload.js';
import { createSubmissionRouter } from './routes/submissionRoutes.js';
import { createVehicleRouter } from './routes/vehicleRoutes.js';
import { vehicleService } from './services/vehicleService.js';

export interface AppOptions {
  maxLogbookSizeBytes?: number;
}

/**
 * Builds the Express app without starting a server, so tests can drive it
 * directly with Supertest.
 */
export function createApp({ maxLogbookSizeBytes = config.maxLogbookSizeBytes }: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok' } });
  });
  app.use('/api/vehicles', createVehicleRouter(vehicleService));
  app.use('/api/submissions', createSubmissionRouter(vehicleService, createLogbookUpload(maxLogbookSizeBytes)));

  app.use(notFoundHandler);
  app.use(createErrorHandler(maxLogbookSizeBytes));

  return app;
}
