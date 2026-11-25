import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const MAX_SIZE = 1024; // small limit so the "too large" test stays fast
const app = createApp({ maxLogbookSizeBytes: MAX_SIZE });

const LOGBOOK_TEXT = 'Vehicle serviced at 10,000 km.\nOil and filter replaced.\n';
const textFile = (contents = LOGBOOK_TEXT, filename = 'logbook.txt', contentType = 'text/plain') => ({
  buffer: Buffer.from(contents),
  options: { filename, contentType },
});

function submit(fields: Record<string, string>, file = textFile()) {
  const req = request(app).post('/api/submissions');
  for (const [key, value] of Object.entries(fields)) req.field(key, value);
  return file ? req.attach('logbook', file.buffer, file.options) : req;
}

const RANGER_RAPTOR = { make: 'ford', model: 'Ranger', badge: 'Raptor' };

describe('POST /api/submissions', () => {
  it('accepts a valid submission and returns the vehicle and logbook contents', async () => {
    const res = await submit(RANGER_RAPTOR);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      message: 'Upload successful - there is no spoon',
      data: { ...RANGER_RAPTOR, logbookFileName: 'logbook.txt', logbookContents: LOGBOOK_TEXT },
    });
  });

  it('accepts the banana badge for the Ford Falcon Ute', async () => {
    const res = await submit({ make: 'ford', model: 'Falcon Ute', badge: 'XR6 \u{1F34C}' });

    expect(res.status).toBe(201);
    expect(res.body.data.badge).toBe('XR6 \u{1F34C}');
  });

  it('preserves non-ASCII UTF-8 text and strips a BOM', async () => {
    const res = await submit(RANGER_RAPTOR, textFile('﻿Serviced — 5 000 km ✓'));

    expect(res.status).toBe(201);
    expect(res.body.data.logbookContents).toBe('Serviced — 5 000 km ✓');
  });

  it('rejects missing vehicle selections and lists each missing field', async () => {
    const res = await submit({ make: 'ford' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { model: 'model is required.', badge: 'badge is required.' },
    });
  });

  it('treats whitespace-only fields as missing', async () => {
    const res = await submit({ make: 'ford', model: '   ', badge: 'Raptor' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('model');
  });

  it('rejects an unknown make', async () => {
    const res = await submit({ ...RANGER_RAPTOR, make: 'holden' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_MAKE');
  });

  it('rejects a model that does not belong to the make', async () => {
    const res = await submit({ make: 'bmw', model: 'Ranger', badge: 'Raptor' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_MODEL');
  });

  it('rejects a badge that does not belong to the model', async () => {
    const res = await submit({ ...RANGER_RAPTOR, badge: 'XR8' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BADGE');
  });

  it('rejects a submission without a file', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .field('make', 'ford')
      .field('model', 'Ranger')
      .field('badge', 'Raptor');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FILE');
  });

  it('rejects a file with a non-.txt extension', async () => {
    const res = await submit(RANGER_RAPTOR, textFile(LOGBOOK_TEXT, 'logbook.pdf', 'application/pdf'));

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('rejects a .txt file sent with a non-text MIME type', async () => {
    const res = await submit(RANGER_RAPTOR, textFile(LOGBOOK_TEXT, 'logbook.txt', 'image/png'));

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('rejects binary content disguised as a .txt file', async () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const res = await submit(RANGER_RAPTOR, { buffer: pngHeader, options: { filename: 'logbook.txt', contentType: 'text/plain' } });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('INVALID_FILE_CONTENT');
  });

  it('rejects text that is not valid UTF-8', async () => {
    const latin1 = Buffer.from([0x63, 0x61, 0x66, 0xe9]); // "café" in Latin-1
    const res = await submit(RANGER_RAPTOR, { buffer: latin1, options: { filename: 'logbook.txt', contentType: 'text/plain' } });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('INVALID_FILE_CONTENT');
  });

  it('rejects an empty file', async () => {
    const res = await submit(RANGER_RAPTOR, textFile(''));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMPTY_FILE');
  });

  it('rejects a file exceeding the size limit', async () => {
    const res = await submit(RANGER_RAPTOR, textFile('a'.repeat(MAX_SIZE + 1)));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('accepts a file exactly at the size limit', async () => {
    const res = await submit(RANGER_RAPTOR, textFile('a'.repeat(MAX_SIZE)));

    expect(res.status).toBe(201);
  });

  it('rejects a file uploaded under an unexpected field name', async () => {
    const res = await request(app)
      .post('/api/submissions')
      .field('make', 'ford')
      .field('model', 'Ranger')
      .field('badge', 'Raptor')
      .attach('document', Buffer.from(LOGBOOK_TEXT), { filename: 'logbook.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNEXPECTED_FILE');
  });
});
