import type { VehicleSelection } from './vehicle.js';

/** Every successful response uses this envelope. */
export interface ApiSuccess<T> {
  success: true;
  message?: string;
  data: T;
}

/** Every error response uses this envelope. */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

export interface SubmissionData extends VehicleSelection {
  logbookFileName: string;
  logbookContents: string;
}
