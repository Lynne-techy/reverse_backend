import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createE2EApp, BEARER } from './utils/e2e-app';

describe('Stats (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2EApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /api/stats/me → 200 + 통계 스키마', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/stats/me')
      .set(BEARER);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      currentStreak: expect.any(Number),
      totalCount: expect.any(Number),
    });
  });

  it('GET /api/stats/activity?from=&to= → 200 배열', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/stats/activity?from=2026-07-01&to=2026-07-31')
      .set(BEARER);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/stats/activity 잘못된 날짜 형식 → 400 (Matches)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/stats/activity?from=2026/07/01&to=2026-07-31')
      .set(BEARER);
    expect(res.status).toBe(400);
  });

  it('GET /api/stats/me 토큰 없음 → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/stats/me');
    expect(res.status).toBe(401);
  });
});
