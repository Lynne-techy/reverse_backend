import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createE2EApp, BEARER } from './utils/e2e-app';

describe('Writing sessions (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2EApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /api/writing-sessions → 200 배열', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/writing-sessions')
      .set(BEARER);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/writing-sessions/upload-url 유효 바디 → 201 + 세션', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/writing-sessions/upload-url')
      .set(BEARER)
      .send({
        book: 19,
        chapter: 23,
        startVerseNo: 1,
        endVerseNo: 6,
        language: 'ko',
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      sessionId: expect.any(String),
      uploadUrl: expect.any(String),
    });
  });

  it('POST /api/writing-sessions/upload-url 잘못된 바디 → 400 (ValidationPipe)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/writing-sessions/upload-url')
      .set(BEARER)
      .send({ book: 'not-a-number' });
    expect(res.status).toBe(400);
  });

  it('GET /api/writing-sessions 토큰 없음 → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/writing-sessions');
    expect(res.status).toBe(401);
  });
});
