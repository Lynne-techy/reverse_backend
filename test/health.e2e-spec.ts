import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createE2EApp } from './utils/e2e-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2EApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health → 200 (public·토큰 불필요·전역 프리픽스 적용)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(typeof res.body.timestamp).toBe('string');
  });

  it('GET /api/health/db → 200 (DB 왕복·supabase 목킹)', async () => {
    const res = await request(app.getHttpServer()).get('/api/health/db');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('프리픽스 없는 경로(/health)는 404', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(404);
  });
});
