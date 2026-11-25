import type { ApiErrorResponse, ApiSuccess, SubmissionPayload, SubmissionResult } from '../types/api';
import type { MakeOption } from '../types/vehicle';

/**
 * The single place the frontend talks to the backend. Components never call
 * fetch directly; they call these functions and receive typed data or an ApiError.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the server could not be reached. */
    public readonly status: number,
    public readonly code: string,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isApiErrorResponse(body: unknown): body is ApiErrorResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof (body as ApiErrorResponse).error?.message === 'string'
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiSuccess<T>> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }

  // A proxy or crashed server may return non-JSON (e.g. an HTML error page).
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorResponse(body)) {
      const { message, code, details } = body.error;
      throw new ApiError(message, response.status, code, details);
    }
    throw new ApiError(`Request failed with status ${response.status}.`, response.status, 'HTTP_ERROR');
  }
  if (body === null) {
    throw new ApiError('The server returned an unexpected response.', response.status, 'INVALID_RESPONSE');
  }
  return body as ApiSuccess<T>;
}

export async function fetchMakes(): Promise<MakeOption[]> {
  const { data } = await request<MakeOption[]>('/api/vehicles/makes');
  return data;
}

export async function fetchModels(make: string): Promise<string[]> {
  const params = new URLSearchParams({ make });
  const { data } = await request<string[]>(`/api/vehicles/models?${params}`);
  return data;
}

export async function fetchBadges(make: string, model: string): Promise<string[]> {
  const params = new URLSearchParams({ make, model });
  const { data } = await request<string[]>(`/api/vehicles/badges?${params}`);
  return data;
}

export async function submitVehicle({ make, model, badge, logbook }: SubmissionPayload): Promise<SubmissionResult> {
  // Text fields are appended before the file so the server has them when the file arrives.
  const formData = new FormData();
  formData.append('make', make);
  formData.append('model', model);
  formData.append('badge', badge);
  formData.append('logbook', logbook);

  // No Content-Type header: the browser sets multipart/form-data with the boundary.
  const { message, data } = await request<SubmissionResult['data']>('/api/submissions', {
    method: 'POST',
    body: formData,
  });
  return { message: message ?? '', data };
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
