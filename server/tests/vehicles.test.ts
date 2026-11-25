import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/vehicles/makes', () => {
  it('returns every make with a display label', async () => {
    const res = await request(app).get('/api/vehicles/makes');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [
        { value: 'ford', label: 'Ford' },
        { value: 'bmw', label: 'BMW' },
        { value: 'tesla', label: 'Tesla' },
      ],
    });
  });
});

describe('GET /api/vehicles/models', () => {
  it('returns the models for a valid make', async () => {
    const res = await request(app).get('/api/vehicles/models').query({ make: 'ford' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(['Ranger', 'Falcon', 'Falcon Ute']);
  });

  it('returns 404 for an unknown make', async () => {
    const res = await request(app).get('/api/vehicles/models').query({ make: 'holden' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'MAKE_NOT_FOUND' } });
  });

  it('does not resolve inherited object properties as makes', async () => {
    const res = await request(app).get('/api/vehicles/models').query({ make: 'constructor' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when the make query parameter is missing', async () => {
    const res = await request(app).get('/api/vehicles/models');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/vehicles/badges', () => {
  it('returns the badges for a valid make and model', async () => {
    const res = await request(app).get('/api/vehicles/badges').query({ make: 'ford', model: 'Ranger' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(['Raptor', 'Raptor X', 'Wildtrak']);
  });

  it('includes the banana badge as the final Ford Falcon Ute option', async () => {
    const res = await request(app).get('/api/vehicles/badges').query({ make: 'ford', model: 'Falcon Ute' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(['XR6', 'XR6 Turbo', 'XR6 \u{1F34C}']);
  });

  it('returns 404 when the model does not belong to the make', async () => {
    const res = await request(app).get('/api/vehicles/badges').query({ make: 'tesla', model: 'Ranger' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MODEL_NOT_FOUND');
  });

  it('returns 404 for an unknown make', async () => {
    const res = await request(app).get('/api/vehicles/badges').query({ make: 'holden', model: 'Ranger' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MAKE_NOT_FOUND');
  });

  it('returns 400 when the model query parameter is missing', async () => {
    const res = await request(app).get('/api/vehicles/badges').query({ make: 'ford' });

    expect(res.status).toBe(400);
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });
});
