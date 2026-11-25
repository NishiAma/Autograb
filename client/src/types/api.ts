import type { VehicleSelection } from './vehicle';

/** Mirrors the server's success envelope. */
export interface ApiSuccess<T> {
  success: true;
  message?: string;
  data: T;
}

/** Mirrors the server's error envelope. */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

export interface SubmissionPayload extends VehicleSelection {
  logbook: File;
}

export interface SubmissionData extends VehicleSelection {
  logbookFileName: string;
  logbookContents: string;
}

export interface SubmissionResult {
  message: string;
  data: SubmissionData;
}
