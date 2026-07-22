import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createE2EApp, BEARER } from './utils/e2e-app';
import { EMOTION_CODES } from '../src/modules/verse/emotion.types';

/**
 * Verses 라우트 e2e — 인증 통과 상태에서 라우팅·ValidationPipe(DTO allowlist)·응답 스키마 확인.
 * 리포지토리는 페이크라 DB 없이 결정론적으로 검증된다.
 */
describe('Verses (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2EApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /api/verses/today → 200 + Verse 스키마', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/verses/today?date=2026-07-22')
      .set(BEARER);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      bookName: expect.any(String),
      chapter: expect.any(Number),
      text: expect.any(String),
    });
  });

  it('GET /api/verses/recommendations?emotion=<허용외> → 400 (DTO allowlist)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/verses/recommendations?emotion=__not_an_emotion__')
      .set(BEARER);

    expect(res.status).toBe(400);
  });

  it('GET /api/verses/recommendations?emotion=<유효> → 200 배열', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/verses/recommendations?emotion=${EMOTION_CODES[0]}`)
      .set(BEARER);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('허용되지 않은 쿼리 파라미터 → 400 (forbidNonWhitelisted)', async () => {
    const res = await request(app.getHttpServer())
      .get(
        '/api/verses/recommendations?emotion=' + EMOTION_CODES[0] + '&evil=1',
      )
      .set(BEARER);

    expect(res.status).toBe(400);
  });
});
