import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { SUPABASE_CLIENT } from '../../src/common/supabase/supabase.constants';
import { AuthService } from '../../src/modules/auth/auth.service';
import { UserService } from '../../src/modules/user/user.service';
import { VerseRepository } from '../../src/modules/verse/verse.repository';
import { HandwritingCheckService } from '../../src/modules/handwriting-check/handwriting-check.service';
import { StatsService } from '../../src/modules/stats/stats.service';
import { WritingService } from '../../src/modules/writing/writing.service';
import { UserThrottlerGuard } from '../../src/common/throttler/user-throttler.guard';
import {
  FAKE_USER,
  fakeSupabase,
  fakeVerseRepository,
  fakeStatsService,
  fakeWritingService,
} from './fakes';

/**
 * Tier 1 e2e 앱 팩토리 — 실제 Nest 앱을 HTTP로 관통하되 외부 I/O만 대체한다.
 *
 * - 프리픽스/파이프/필터: prod와 동일(`configureApp`).
 * - 인증: **실제 AuthGuard 유지**, JWT 검증(AuthService.verifyToken)만 대체.
 *   → 토큰 헤더 있으면 FAKE_USER 로 통과 / 없으면 실제 가드가 401(거부 경로도 진짜로 검증).
 * - DB: SUPABASE_CLIENT + Repository 페이크. Gemini: HandwritingCheckService 스텁.
 * - Throttler: 통과(테스트 잡음 방지).
 */
export async function createE2EApp(
  opts: { verseRepo?: Partial<VerseRepository> } = {},
): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SUPABASE_CLIENT)
    .useValue(fakeSupabase)
    .overrideProvider(HandwritingCheckService)
    .useValue({})
    .overrideProvider(VerseRepository)
    .useValue(opts.verseRepo ?? fakeVerseRepository)
    // stats/writing은 서비스 경계에서 페이크(컨트롤러 계약 검증). writing 오버라이드는
    // onApplicationBootstrap(잔류 세션 정리)도 함께 무력화한다.
    .overrideProvider(StatsService)
    .useValue(fakeStatsService)
    .overrideProvider(WritingService)
    .useValue(fakeWritingService)
    .overrideProvider(UserService)
    .useValue({ provisionFromAuth: async () => undefined })
    .overrideProvider(AuthService)
    .useValue({ verifyToken: async () => FAKE_USER })
    .overrideGuard(UserThrottlerGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

/** 인증이 필요한 요청에 붙일 임시 Bearer 헤더(값은 무의미 — verifyToken이 대체됨). */
export const BEARER = { Authorization: 'Bearer e2e-token' };
