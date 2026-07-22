# 백엔드 E2E 테스트 설계

> 대상: NestJS 백엔드(`reverse_backend`). [품질] 테스트 도입 일감의 "e2e 스텁 채우기" 근거 설계.
> 작성 2026-07-22.

## 0. 현재 상태 (실측)

- 유닛/컴포넌트: **83 tests / 11 suites 통과** (가드·컨트롤러·필터·DTO·서비스·계산기).
- **e2e는 죽은 스텁**: `test/app.e2e-spec.ts`가 `GET / → "Hello World!"`를 기대하지만
  - `AppModule.controllers`엔 root 컨트롤러가 없다(→ 404).
  - `main.ts`의 전역 프리픽스 `api`가 스텁에 안 걸려 실제 라우트(`/api/**`)와도 어긋난다.
  - 즉 `npm run test:e2e`는 지금 돌리면 실패한다. **폐기 후 재작성 대상.**

## 1. 부팅 의존성 & 오버라이드 seam

E2E는 "실제 Nest 앱을 HTTP로 관통"하되, 외부 I/O만 대체한다. 대체 지점:

| 의존성 | 위치 | E2E 처리 |
| --- | --- | --- |
| 전역 프리픽스/파이프/필터 | `main.ts` bootstrap (AppModule 밖) | **`configureApp(app)`로 추출**해 prod=e2e 동일 적용 |
| AuthGuard (전역, JWKS 검증) | `AuthModule` APP_GUARD | `overrideGuard`로 가짜 `req.user` 주입 / 401 시나리오 분리 |
| UserThrottlerGuard (전역) | `AppModule` APP_GUARD | 기본 무력화(통과) + 별도 throttle 테스트에서만 저한도 env |
| `SUPABASE_CLIENT` (service-role) | `SupabaseModule` (@Global) | Tier1: 미사용(리포 경계에서 차단) / Tier2: 로컬 Supabase |
| Repository (`VerseRepository` 등) | 각 모듈 provider, 서비스에 DI | **Tier1 주 seam** — `overrideProvider(XRepository).useValue(fake)` |
| Gemini (HandwritingCheckService 내부 `new`) | `HandwritingCheckModule` | `overrideProvider(HandwritingCheckService).useValue(fake)` |
| env 검증 (zod) | `config.module` | `.env.test`의 더미(형식만 유효) 값으로 통과 |

리포지토리가 얇은 supabase-js 래퍼 + @Injectable이라, **리포 경계 오버라이드**가 PostgREST 체인을
흉내 내는 것보다 견고하다(서비스→컨트롤러→파이프→가드→필터까지 실제 코드로 관통).

## 2. 2-티어 전략

### Tier 1 — 애플리케이션 E2E (외부 목킹) · **CI 게이트**
목표: HTTP 표면 전체를 결정론적으로 검증(라우팅/프리픽스·ValidationPipe·전역 가드 배선·예외 필터 마스킹·직렬화).
Docker 불필요, 빠름. **PR 필수 통과.**

대체: Auth(가짜 유저) · Throttler(통과) · Repository(인메모리 페이크) · Gemini(캔드).

### Tier 2 — 통합 E2E (로컬 Supabase) · **선택/야간**
목표: 실제 SQL·PostgREST·**RLS 백스톱**·FK·마이그레이션 유효성을 검증.
`supabase start`(로컬 Postgres+PostgREST+GoTrue) → `supabase db reset`(마이그레이션 적용) → 최소 시드 →
로컬 GoTrue 발급 실제 JWT(or `/api/dev/token`)로 관통. Docker 필요·느림 → **별도 스크립트, 초기엔 CI 비차단.**
리포지토리 레이어와 RLS의 "진짜" 커버리지는 여기서 확보.

## 3. 선행 리팩터 (필수)

`main.ts`의 전역 설정을 재사용 함수로 추출한다. 없으면 e2e가 prod와 어긋난다(현 스텁의 버그 원인).

```ts
// src/app.setup.ts
export function configureApp(app: NestExpressApplication): void {
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false, hsts: false }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');
}
```
`main.ts`는 이 함수를 호출하도록 바꾸고(동작 불변), e2e도 동일 호출.

## 4. 테스트 하네스

- **`.env.test`**: 형식만 유효한 더미(예: `SUPABASE_URL=http://localhost:54321`, `SUPABASE_JWT_ISSUER=http://localhost:54321/auth/v1`, `SUPABASE_SERVICE_ROLE_KEY=test`, `SUPABASE_STORAGE_BUCKET=test`, `NODE_ENV=test`). Auth·repo를 오버라이드하므로 실값 불필요.
- **`test/utils/e2e-app.ts`** — 표준 오버라이드로 앱 생성 헬퍼:

```ts
export const FAKE_USER = { userId: 'u-e2e', email: 'e2e@test', provider: 'google', fullName: 'E2E' };

export async function createE2EApp(overrides: {
  user?: AuthenticatedUser | null;   // null이면 401 시나리오(AuthGuard 원본 통과 거부)
  repos?: Partial<Record<string, unknown>>;
} = {}) {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideGuard(UserThrottlerGuard).useValue({ canActivate: () => true })
    .overrideGuard(AuthGuard).useValue({
      canActivate: (ctx: ExecutionContext) => {
        if (overrides.user === null) throw new UnauthorizedException();
        ctx.switchToHttp().getRequest().user = overrides.user ?? FAKE_USER;
        return true;
      },
    })
    .overrideProvider(HandwritingCheckService).useValue(fakeHandwriting);
  for (const [token, value] of Object.entries(overrides.repos ?? {}))
    builder.overrideProvider(token).useValue(value);

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}
```

- **페이크 리포지토리**: 모듈별 인메모리 구현(호출되는 메서드만) — `VerseRepository`(findById/findRange/findDailyVerseByDate/findRandomVerse/findEmotionVerseCandidates), `WritingRepository`, `StatsRepository`, `UserRepository`.

## 5. Tier 1 테스트 매트릭스 (유닛이 못 잡는 HTTP 계약)

1. **Auth 배선**: 보호 라우트(`GET /api/verses/today`) 토큰 없음 → **401**; `@Public`(`GET /api/health`, `POST /api/dev/token`) → 토큰 없이 **200**.
2. **ValidationPipe(e2e)**: `GET /api/verses/recommendations?emotion=<허용외>` → **400**(allowlist); 미허용 쿼리/바디 필드 → `forbidNonWhitelisted` **400**.
3. **프리픽스/라우팅**: `GET /api/health` 200 `{status}`; `GET /api/verses/today` 200 + 스키마.
4. **예외 필터 마스킹**: 페이크 리포가 던지게 해 5xx → 내부 메시지/시크릿 **미노출**(4xx 메시지는 유지). (unit `all-exceptions.filter.spec` 보완 = HTTP 관통 확인)
5. **핵심 해피패스(목킹)**: 오늘의 말씀 배정/조회, 추천(allowlist emotion), 필사 세션 생성(`POST /api/writing-sessions`) → 응답 스키마·상태코드, 통계/활동 조회.
6. **Throttle(선택)**: 실제 ThrottlerGuard + 저한도 `.env`로 N+1요청 → **429**(1건만, 나머지는 무력화 기본값).

## 6. Tier 2 아웃라인 (선택)

- `supabase start` → `supabase db reset`(migrations, RLS 백스톱 포함) → 시드(`scripts/seed-*.mjs`).
- 로컬 GoTrue로 실제 유저+JWT 발급(or `/api/dev/token`) → `SUPABASE_JWT_ISSUER`를 로컬로.
- 검증: 리포지토리 실 SQL, FK, **RLS(anon 거부 / service-role 통과)**, 마이그레이션 순서.
- 실행: `npm run test:integration`(env 플래그 게이트), 초기엔 야간/수동.

## 7. 범위·비목표

- Gemini 실호출·유료 경로는 **항상 목킹**(비용/쿼터).
- 실 Google OAuth는 e2e 대상 아님(가짜 유저 주입 / Tier2는 로컬 GoTrue).
- 부하/성능은 별도 일감(`loadtest.mjs`)에서 다룸.

## 8. 롤아웃 & DoD 매핑

1. `configureApp()` 추출(+`main.ts` 반영, 동작 불변) — 선행.
2. `.env.test` + `createE2EApp` 헬퍼 + 페이크 리포 4종.
3. Tier1 스펙 작성(매트릭스 §5) → 죽은 `app.e2e-spec.ts` 대체. **CI에 `test:e2e` 게이트 추가.**
4. (선택) Tier2 로컬 Supabase 통합 스펙 + `test:integration`.

→ [품질] DoD "백엔드 e2e 스텁 채우기"는 **1~3**으로 충족. 레포 레이어 실 커버리지는 **4**(Tier2)에서.
```
