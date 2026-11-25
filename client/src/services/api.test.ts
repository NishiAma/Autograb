import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fetchModels, submitVehicle } from './api';

function mockFetch(implementation: () => Promise<Response>) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api service', () => {
  it('encodes query parameters and returns the data payload', async () => {
    const fetchMock = mockFetch(async () => jsonResponse({ success: true, data: ['Model 3'] }));

    await expect(fetchModels('tesla & co')).resolves.toEqual(['Model 3']);
    expect(fetchMock).toHaveBeenCalledWith('/api/vehicles/models?make=tesla+%26+co', undefined);
  });

  it('converts an error envelope into an ApiError', async () => {
    mockFetch(async () =>
      jsonResponse({ success: false, error: { code: 'MAKE_NOT_FOUND', message: 'Unknown make "x".' } }, 404),
    );

    await expect(fetchModels('x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'MAKE_NOT_FOUND',
      message: 'Unknown make "x".',
    });
  });

  it('handles a non-JSON error response', async () => {
    mockFetch(async () => new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(fetchModels('ford')).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });

  it('reports network failures with a friendly message', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const error = await fetchModels('ford').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('posts the selection and file as multipart form data', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse(
        {
          success: true,
          message: 'Upload successful - there is no spoon',
          data: { make: 'ford', model: 'Ranger', badge: 'Raptor', logbookFileName: 'a.txt', logbookContents: 'hi' },
        },
        201,
      ),
    );
    const logbook = new File(['hi'], 'a.txt', { type: 'text/plain' });

    const result = await submitVehicle({ make: 'ford', model: 'Ranger', badge: 'Raptor', logbook });

    expect(result.message).toBe('Upload successful - there is no spoon');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/submissions');
    expect(init.method).toBe('POST');
    const body = init.body as FormData;
    expect(body.get('make')).toBe('ford');
    expect(body.get('model')).toBe('Ranger');
    expect(body.get('badge')).toBe('Raptor');
    expect((body.get('logbook') as File).name).toBe('a.txt');
  });
});
