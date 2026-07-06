# Re-Verse Backend 아키텍처 설계

> Re-Verse는 성경을 "읽는" 서비스가 아니라 **매일 손으로 쓰게 만드는 습관 시스템**이다.
> 이 문서는 `reverse_backend`(NestJS API 서버)의 초기 설계를 정의한다. NestJS를 처음 접하는 팀 사정상,
> 표준 4계층 클린 아키텍처 대신 **controller/service/repository 단순 구조**를 따른다.

## 0. 범위와 스택

- **이 저장소**: NestJS 11 + TypeScript API 서버. 인증 + 비즈니스 로직 + presigned URL 발급 + OCR 잡 등록 + streak/통계.
- **DB**: Supabase (PostgreSQL). ORM 대신 `@supabase/supabase-js` 쿼리 빌더 사용, 단 Repository 뒤에 격리.
- **인증**: Supabase Auth (구글 우선, 카카오). 프론트가 OAuth 전담, 백엔드는 JWT 검증만.
- **이미지**: OCI Object Storage (presigned URL 업로드).
- **OCR**: 별도 Python(PaddleOCR) 워커 — 이 저장소 범위 밖. 백엔드는 잡 등록 + 결과 수신.
- **엣지**: Cloudflare (CDN/WAF).

## 0-1. 전역 기반 구조 (실제 구현됨)

```
src/
  config/                      # ConfigModule, env 스키마 검증(zod)
  common/
    supabase/                  # SupabaseClientProvider (service-role client 팩토리)
    filters/                   # 전역 ExceptionFilter
  health/                      # 헬스체크 컨트롤러
  modules/<feature>/
    <feature>.controller.ts    # 라우팅, 요청/응답 DTO 매핑
    <feature>.service.ts       # 비즈니스 로직
    <feature>.repository.ts    # 데이터 접근 (필요할 때만)
    <feature>.types.ts         # 순수 타입/인터페이스
    dto/                       # 요청 DTO (class-validator)
    <feature>.module.ts
```

- 추가 의존성(구현 단계 설치): `@nestjs/config`, `@supabase/supabase-js`, `jose`(JWKS 검증), OCI SDK(`oci-objectstorage`/`oci-common`) 또는 S3 호환 시 `@aws-sdk/client-s3` + presigner, `class-validator`/`class-transformer`, (잡 큐 라이브러리 채택 시) `pg-boss`.
- **Supabase 접근은 반드시 `common/supabase`의 단일 클라이언트 provider 경유.** service/repository가 이 provider를 생성자 주입받아 사용한다.

## 모듈 구조 규약

의존성은 한 방향으로만 향한다: **controller → service → repository**. Port/인터페이스로 역전하지 않고 NestJS DI(생성자 주입)로 직접 연결한다. 타입은 `<feature>.types.ts`에 프레임워크/DB와 무관한 순수 데이터 형태로 정의한다.

---

## A. 데이터베이스 모델링

물리 스키마는 Postgres(Supabase), 앱 테이블은 `public` 스키마. 인증 원천은 Supabase 관리 `auth.users`. 시간은 `timestamptz`, PK는 `uuid`(`gen_random_uuid()`) 기본, 참조 데이터(verses)는 `bigint identity`.

### A-1. users (앱 프로필 — auth.users 미러)
| 컬럼 | 타입 | 제약/기본 |
|---|---|---|
| id | uuid | PK, = auth.users.id (FK, ON DELETE CASCADE) |
| email | text | not null |
| provider | text | not null (`google`\|`kakao`) |
| display_name | text | null |
| avatar_url | text | null |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

`id`를 별도 발급하지 않고 `auth.users.id`를 그대로 PK/FK로 사용 → 1:1 동기화 단순화. 타입: `user.types.ts`의 `User`, `AuthProvider`.

### A-2. verses (성경 구절 원문)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | bigint | PK, identity |
| translation_code | text | not null (`GAE`, `NIV` 등) |
| book_no | smallint | not null |
| book_name | text | not null |
| chapter | smallint | not null |
| verse_no | smallint | not null |
| text | text | not null |
| char_count | int | not null (유사도/난이도 캐시) |
| created_at | timestamptz | default now() |

Unique: `(translation_code, book_no, chapter, verse_no)`. 타입: `verse.types.ts`의 `Verse`. 다중 절 지원은 열린 질문(§열린 질문).

> `book_no` 범위(1~66) `check` 제약은 두지 않음 — `verses`는 신뢰된 시딩 스크립트로만 채워지는 참조 테이블이라 DB 레벨 방어가 불필요하다고 판단 (`docs/DATABASE.md` 참고).

### A-3. emotion_tags (감정 태그 마스터, 8종)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| code | text | PK (`comfort`,`hope`,`gratitude`,`peace`,`courage`,`repentance`,`love`,`faith`) |
| label_ko | text | not null |
| sort_order | smallint | not null |

enum 대신 lookup 테이블(태그 추가 시 마이그레이션 불필요). 8종 확정은 열린 질문.

### A-4. verse_emotion_tags (구절 ↔ 감정 N:M)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| verse_id | bigint | FK→verses, not null |
| tag_code | text | FK→emotion_tags, not null |
| weight | smallint | default 1 |

PK: `(verse_id, tag_code)`. Index: `(tag_code, weight desc)`.

### A-5. daily_verses (오늘의 말씀 배정)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| activity_date | date | PK (전역 1일 1구절) |
| verse_id | bigint | FK→verses, not null |
| created_at | timestamptz | default now() |

**권장: 전역 배정**(모든 사용자 동일) — "선택 부담 제거" 취지 부합, 캐시/공유 용이. 개인화 추천은 별도 API로 분리. 개인화 확정 시 PK를 `(user_id, activity_date)`로 확장.

### A-6. writing_sessions (필사 1회 기록)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK→users, not null |
| verse_id | bigint | FK→verses, not null |
| object_key | text | not null (OCI 키; public URL 대신 키 저장) |
| status | text | not null default `pending` (`pending`\|`uploaded`\|`processing`\|`completed`\|`failed`) |
| ocr_text | text | null |
| ocr_score | numeric(5,2) | null (0–100) |
| similarity_score | numeric(5,2) | null (0–100) |
| passed | boolean | null |
| created_at | timestamptz | default now() |
| completed_at | timestamptz | null |

Index: `(user_id, created_at desc)`, `status`. 타입: `writing-session.types.ts`의 `WritingSession`. 상태 전이 로직(`markUploaded`, `applyOcrResult`)은 `writing-session.service.ts`에 함수로 둔다.

### A-7. ocr_jobs (OCR 비동기 잡 — 워커 인터페이스)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | PK |
| session_id | uuid | FK→writing_sessions, unique, not null |
| object_key | text | not null |
| verse_id | bigint | not null |
| status | text | not null default `queued` (`queued`\|`processing`\|`done`\|`failed`) |
| attempts | smallint | default 0 |
| error | text | null |
| enqueued_at | timestamptz | default now() |
| started_at / finished_at | timestamptz | null |

Index: `status` 부분 인덱스(`WHERE status='queued'`), `enqueued_at`. 명시적 테이블 권장 — Python 워커가 스키마를 직접 이해하기 쉬움.

### A-8. user_statistics (사용자 집계, 1:1)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| user_id | uuid | PK, FK→users |
| current_streak | int | default 0 |
| longest_streak | int | default 0 |
| total_count | int | default 0 |
| last_written_date | date | null |
| freeze_available | smallint | default 0 |
| updated_at | timestamptz | default now() |

타입: `UserStatistics`. streak 계산(연속/끊김/freeze 소모)은 `streak-calculator.ts`에 순수 함수로 분리해 테스트하기 쉽게 한다.

### A-9. user_daily_activity (일자별 활동 — 잔디/별)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| user_id | uuid | FK→users |
| activity_date | date | not null |
| count | int | not null default 0 |
| best_similarity | numeric(5,2) | null (별 밝기 매핑 후보) |
| total_char_count | int | default 0 (별 크기 매핑 후보) |

PK: `(user_id, activity_date)`. 시각화 지표 매핑은 열린 질문 — 후보 컬럼을 선반영해 스키마 변경 없이 대응.

### A-10. streak_freeze_events (freeze 적립/사용 이력)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK→users |
| type | text | not null (`earned`\|`used`) |
| reason | text | null (`7day_streak`, `missed_day_auto` 등) |
| created_at | timestamptz | default now() |

보유 수는 `user_statistics.freeze_available`에 캐시, 이력은 append-only. 규칙은 열린 질문.

### A-11. quests / user_quests
- `quests`: id, code, title, description, type(`daily`\|`streak`\|`total`), goal(int), reward(jsonb), active(bool).
- `user_quests`: (user_id, quest_id) PK, progress(int), completed_at, claimed_at.
- 타입: `Quest`, `UserQuestProgress`. 진행 갱신은 필사 완료 처리 후 `QuestService`를 직접 호출해서 수행한다.

### A-12. 물리 스키마 ↔ 타입 매핑
Repository만 supabase-js row(snake_case)를 인지하고, 반환 전 camelCase 타입으로 매핑한다. Request/Response DTO 매핑은 controller에서 처리한다(매핑 책임 2곳으로 분리: repository↔DB, controller↔HTTP).

### A-13. RLS 방침 (권장)
- **백엔드 service-role 단일 경로.** 모든 DB 접근은 NestJS가 service_role 키로 수행, 인가는 service에서 `user_id` 스코프로 강제.
- **심층 방어로 RLS는 켜두되 정책 최소화**: 소유 테이블에 `auth.uid() = user_id` 읽기 정책, `verses`/`emotion_tags`는 공개 읽기. service_role은 RLS 우회하므로 백엔드 동작 무영향.

---

## B. 인증 / 인가 설계

### B-1. 역할 분담
**프론트가 Supabase Auth로 OAuth(구글/카카오) 전담, NestJS는 Supabase 발급 JWT 검증만.** 백엔드는 OAuth redirect/코드 교환을 구현하지 않는다. 카카오는 Supabase custom OIDC/provider 설정으로 프론트 처리.

백엔드 책임: (1) JWT 검증 Guard, (2) 사용자 식별·JIT 프로비저닝, (3) `user_id` 스코프 데이터 접근/인가.

### B-2. JWT 검증 (권장: JWKS/비대칭)
- **권장: Supabase 비대칭 서명(ES256/RS256) + JWKS 엔드포인트 검증.** `jose`의 `createRemoteJWKSet`으로 공개키 캐싱. 시크릿을 백엔드에 두지 않아 유출면 축소·롤테이션 용이.
- 대안(레거시): 공유 HS256 `SUPABASE_JWT_SECRET`. 간단하나 시크릿 배포/롤테이션 부담.
- 검증 항목: 서명, `iss`(프로젝트 URL), `aud=authenticated`, `exp`. `sub`=auth user id, `email`, `app_metadata.provider` 추출.

### B-3. 계층 배치 (실제 구현됨)
```
src/modules/auth/
  auth.guard.ts               # 전역 Guard: 토큰 추출 → verifyToken → JIT 프로비저닝 → req.user
  auth.service.ts             # jose/JWKS 기반 JWT 검증
  current-user.decorator.ts   # @CurrentUser()
  public.decorator.ts         # @Public() — Guard 예외 화이트리스트
  auth.module.ts
```
- **AuthGuard**: `Authorization: Bearer` 추출 → `AuthService.verifyToken()` → 처음 보는 사용자면 `UserService.provisionFromAuth()`(users upsert) → `req.user`에 저장.
- **AuthService**: `jose`의 `createRemoteJWKSet` + `jwtVerify`로 Supabase JWKS 엔드포인트 검증. 서명/`iss`/`aud`/`exp` 확인 후 `sub`/`email`/`app_metadata.provider` 추출.
- 전역: `APP_GUARD`로 글로벌 등록 + `@Public()` 데코레이터로 예외(헬스체크, OCR 콜백) 화이트리스트.

### B-4. users ↔ auth.users 동기화
- **권장: JIT 프로비저닝(요청 시 upsert).** Guard가 검증 통과 후 `users`에 `id=sub` upsert. 프로비저닝 시 `user_statistics` 초기 row도 같은 usecase 트랜잭션에서 생성.
- 대안: Postgres 트리거. 즉시 동기화되나 로직이 DB에 숨음.

### B-5. 인가
리소스 소유권 검사는 각 기능의 service에서 `authenticatedUser.userId === resource.userId` 확인, 위반 시 `ForbiddenException`. Guard는 인증만, 인가는 service 책임.

---

## C. 아키텍처 & 기능 로드맵

### C-1. API ↔ OCR 워커 비동기 연동 (⚠️ 보류 — 방식 미확정)

> **결정 보류**: OCR 워커 연동 방식은 아직 확정하지 않는다. 아래는 유력 후보이며, 실제 워커 팀과의 계약(payload 스키마·인증)을 정할 때 재검토한다.
> 그 전까지 `writing_sessions`는 `pending`/`uploaded` 상태까지만 다루고, 잡 등록·콜백 처리는 구현 범위에서 제외한다(§C-4 W3에서 착수).

**후보(권장): DB 테이블 기반 잡 큐(`ocr_jobs`) + 워커 폴링 + 워커→NestJS HMAC 콜백.**

1. NestJS: 필사 요청 시 `writing_sessions`(uploaded) + `ocr_jobs`(queued) 생성.
2. Python 워커: `ocr_jobs` where queued를 `FOR UPDATE SKIP LOCKED`로 폴링·클레임(processing).
3. 워커: OCI 이미지 다운로드 → PaddleOCR → 원문 비교 → similarity/ocr_score.
4. 워커 → NestJS 내부 콜백 `POST /internal/ocr/callback`(HMAC 서명, `@Public()`이되 별도 Guard 보호).
5. NestJS: 콜백 usecase가 `WritingSession.applyOcrResult()` → 통과 판정 → **streak/stats/daily_activity/quest 후속 처리를 도메인 트랜잭션으로 실행.**

**근거**: 결과 수신을 워커 콜백으로 하는 이유는 streak/통계/퀘스트 갱신이 도메인 로직이므로 반드시 NestJS를 거쳐야 하기 때문. 워커는 "계산"만, NestJS는 "상태 전이·집계"만. 초기엔 이미 있는 Postgres로 큐 구현이 운영 부담 최소(Redis/BullMQ는 트래픽 증가 시 전환).

### C-2. Presigned URL 발급(OCI) 구조
```
src/modules/writing/
  writing.controller.ts       # POST /writings/upload-url
  writing.service.ts          # key 생성 규칙, 권한 검사, presigned URL 발급 호출
  object-storage.client.ts    # OCI SDK 래퍼: issueUploadUrl(key)
```
클라이언트가 URL로 직접 PUT 업로드 후 `POST /writings`(object_key + verse_id)로 세션 생성 → C-1 잡 등록.

### C-3. 모듈별 책임
- **Auth**: JWT 검증·프로비저닝. `AuthService.verifyToken`, `AuthGuard`.
- **User**: 프로필. `UserService.getProfile/updateProfile/provisionFromAuth`, `UserRepository`.
- **Bible**: 구절·번역·감정태그·오늘의 말씀. `VerseService.getDailyVerse/recommendByEmotion`, 배치 `assignDailyVerse`.
- **Writing**: 필사 핵심. `WritingService.issueUploadUrl/createWritingSession/handleOcrResult/listMyWritings`; `WritingRepository`, `OcrJobRepository`, `ObjectStorageClient`.
- **Streak**: `StreakCalculator`(순수 함수); `StatisticsService.applyWritingToStreak/grantFreeze/consumeFreeze`.
- **Stats**: `StatisticsService.getMyStatistics/getActivityCalendar`(잔디/별). 쓰기는 Writing/Streak 후속 처리에서.
- **Quest**: `QuestService.listQuests/updateQuestProgress/claimReward`.

모듈 간 결합은 이벤트 없이 **명시적으로 순차 호출**한다(예: 필사 완료 시 `WritingService`가 `StatisticsService`, `QuestService`를 직접 호출). 단순하고 트랜잭션 제어가 쉽다.

### C-4. 백엔드 구현 우선순위 (6주 로드맵)
- **W1 — 기반+인증+스키마**: config/env, Supabase client provider, 전 테이블 마이그레이션(SQL), Auth Guard+JWKS+JIT 프로비저닝, User 프로필 API, verses/emotion_tags 시딩.
- **W2 — Bible+업로드 진입**: verses 조회, 오늘의 말씀(전역 배정 배치 + `GetDailyVerse`), OCI presigned URL, `CreateWritingSession`(잡 enqueue).
- **W3 — OCR 파이프라인**: `ocr_jobs` 큐, 워커 콜백(HMAC), `HandleOcrResult`, 상태 전이. 워커 payload 계약 확정.
- **W4 — Streak+Stats**: `StreakCalculator`, `UserStatistics` 갱신, `user_daily_activity` 집계, freeze, 잔디/별 조회.
- **W5 — Quest+추천**: 퀘스트 정의/진행/보상, 감정 태그 추천.
- **W6 — 하드닝·배포**: RLS 최소 적용, 예외 필터/로깅, e2e, Cloudflare/배포, 인덱스 점검.

**핵심 의존 사슬**: 인증·스키마(W1) → 세션·업로드(W2) → OCR 결과 수신(W3) → 그에 반응하는 streak/stats/quest(W4–W5). OCR 워커 콜백 payload 계약은 W2~W3 경계에서 워커 팀과 먼저 합의.

---

## 열린 질문 (결정 필요)

1. **유사도 통과 임계치**: 초안 85%. 한국어 손글씨 PaddleOCR 정확도 실측 전 미확정. 정규화(공백/문장부호/자모 오인식 허용) 규칙, 임계치를 상수 vs 환경설정/DB(난이도별)로 둘지.
2. **streak freeze 규칙**: 적립 조건(예: 7일 연속 시 1개), 주당/총 보유 상한, 미작성일 자동 소모 여부·순서.
3. **시각화 지표 매핑**: 별 밝기/크기/색이 어떤 데이터(유사도/글자수/연속일/감정태그)에 대응하는지. 현재 `best_similarity`,`total_char_count` 후보 선반영.
4. **감정 태그 8종 확정 + 추천 알고리즘**: 태그 목록, 추천 방식(태그 필터 랜덤 vs 가중치 vs 이력 기반), daily verse 전역 vs 개인화.
5. **필사 단위**: 단일 절 vs 다중 절(passage). 다중 절 시 `verse_no_end`/`passages` 도입.
6. **JWT 서명 방식**: 프로젝트가 비대칭(JWKS) 전환 완료인지, legacy HS256만인지 확인 후 B-2 확정.

---

## 착수 지점 (핵심 파일)
- `src/app.module.ts` — 모듈 등록·전역 Guard/Config 배선 루트
- `src/main.ts` — 전역 파이프/필터/CORS 부트스트랩
- `package.json` — 의존성 추가(supabase-js, jose, config, OCI/S3 SDK)
- `tsconfig.json` — 모듈 해석·데코레이터 설정, 경로 alias
- `CLAUDE.md` — 프로젝트 공통 규칙(아키텍처, 세션 인수인계)
