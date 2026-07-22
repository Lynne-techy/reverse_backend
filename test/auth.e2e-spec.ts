import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createE2EApp, BEARER } from './utils/e2e-app';

/**
 * 전역 AuthGuard 배선(HTTP 관통). 유닛(auth.guard.spec)이 가드 로직을 커버하지만,
 * 여기선 "전역으로 실제 붙었는가 + @Public 예외가 실제로 통하는가"를 앱 전체로 확인한다.
 */
describe('Auth 가드 배선 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2EApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('보호 라우트에 토큰 없이 접근 → 401', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/verses/today?date=2026-07-22',
    );
    expect(res.status).toBe(401);
  });

  it('@Public 라우트(health)는 토큰 없이 → 200', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
  });

  it('보호 라우트에 Bearer 토큰 → 통과(401 아님)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/verses/today?date=2026-07-22')
      .set(BEARER);
    expect(res.status).not.toBe(401);
    expect(res.status).toBe(200);
  });
});
