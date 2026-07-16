# 진행 상황 로그 (세션 인수인계용)

> 세션 시작 시 먼저 읽고, 의미 있는 진행이 있으면 마무리 전에 갱신. **간결하게 유지** — 상세 배경은
> git log / `docs/DATABASE.md` / `docs/ARCHITECTURE.md`에 있으니 여기엔 한두 줄 요약만 남긴다.

## 상태
`main` 최신. **프로덕션 전체 스택 라이브** — https://reverse-growthlog.com
(web/api/health/db 모두 200). CI/CD는 **레지스트리 빌드로 전환 완료**(GitHub Actions가 빌드해
Artifact Registry push, VM은 pull만 — 매일 1회 자동 배포). 로컬 `.env` 있음(개발/시딩 가능).
현재 작업 브랜치: **`feat/recent-writing`** — QT(묵상/적용/기도제목) 저장 완료,
최근 필사 기록 목록 API는 다음 세션에(아래 참고). (`chore/review-fixes`는 PR #9로 merge 완료.) 남은 것: 프론트 `RecommendPage` 실제 구현(팀원), 모니터링 알림
정책(선택), e2-medium 리사이즈(부하 시).
쉬는 동안 VM 중지 권장: `gcloud compute instances stop reverse-vm --zone=asia-northeast3-a`

## 완료 (W1)
기반구조·의존성, Auth/User 모듈(controller/service/repository 구조), DB 모델링 문서,
MVP 7개 테이블 마이그레이션. ARCHITECTURE.md·README.md 단순 구조로 정리.

## 완료 (W2 — 수직 슬라이스)
로그인 → 필사 업로드 → 잔디까지 관통 완료.
- `verse`/`writing`/`stats` 모듈: 오늘의 구절, 업로드-URL+완료(Gemini 유사도 검사 인프로세스 백그라운드,
  통과 기준 손글씨&&점수≥60), streak/잔디(`streak-calculator.ts` 순수함수). 필사 **범위**(같은 장
  start/end_verse_no) + `key_verse_id`(complete 시점 지정) + 언어(ko/en) 선택 + 범위 조회
  `GET /verses?book&chapter&from&to`.
- **성경 전체 시딩**: `data/bible.json`(개역개정 66권 31,088절) 청크 upsert로 적재 완료
  (`scripts/seed-verses.mjs`). 여러 번역본/언어 확장 대비 `translation_code` 명명 규칙
  (`{LANG}_{VERSION}`) 정립 + 매핑 테이블(`docs/DATABASE.md`). PR #3 merge 완료(2026-07-13).

## 완료 (배포/운영)
전체 스택 프로덕션 라이브(GCE VM + `reverse-growthlog.com` + Cloudflare, Docker 컨테이너화,
전역 `/api` prefix). CI/CD(GitHub Actions, Workload Identity + IAP, 매일 1회 배포) — **레지스트리
빌드로 전환**(VM 직접 빌드 → Actions가 빌드해 Artifact Registry push, VM은 pull만, `:sha` 태그로
롤백 가능). 팀원 IAM+SSH IAP 전환(22번 포트 전세계 개방 방화벽 삭제). Gemini 유사도 검사 인프로세스
백그라운드 배선(원자적 선점, 인프라 오류 시 재시도 가능, `SIMILARITY_MAX_CONCURRENCY`로 동시성 상한
적용). 운영 잔손질: Supabase 비활성 방지 헬스체크 크론, 주간 디스크 스냅샷, Ops Agent(메모리/로그
모니터링). 프론트(`reverse_app`) Docker화 + `feat/docker-nginx`→main 병합, VM이 main 추종(단, 신규
페이지는 라우터 미배선이라 화면은 기존 대시보드 그대로 — 팀원 작업 필요). 로컬 dev 매뉴얼
`docs/LOCAL_DEV.md`.

## 보류
별(밤하늘) 시각화 컬럼 — 방식 미확정 (`docs/DATABASE.md` 6장).
OCI Object Storage 전환(현재 Supabase Storage 임시 사용).
(`ocr_jobs`/Python OCR 워커는 **폐기** — Gemini API 직접 호출로 대체.)

## 다음 단계 (백로그)
- [ ] **`GET /writing-sessions` 목록 API** (다음 세션, 설계 확정) — 홈 "최근 필사 기록"·"필사
  타임라인(전체보기)" 화면용. 통과(passed=true)만, 최신순 flat 목록 + `limit`/`offset`
  (날짜 그룹핑·"N건" 카운트는 프론트 몫). 응답에 keyVerse(chapter/verseNo) 포함 필요
  (`key_verse_id` FK embed) + `meditation`(카드 본문, null이면 "(묵상 미작성)").
  과거 "stats.totalCount로 충분해 드롭" 결정은 이 화면들이 새로 생겨 번복.
- [ ] 구절 검색/목록 API 확장 — 현재 `GET /verses`는 같은 장 범위 조회만.
- [ ] (이후) emotion_tags, verse_emotion_tags, quests, user_quests
- [ ] 프론트 신규 페이지(Login/pilsa/heatmap 등) 라우터 배선 — 팀원 작업
- [ ] 밤하늘 밝기용 **절별 필사 횟수** 엔드포인트 — 마이페이지 별밤(0→3회 밝기)은 절 주소별
  카운트 배열이 필요. `/progress` 요약(3개 숫자)과 별개 데이터라 분리.
- [ ] 절수 라벨/분모 정합 — 프론트 밤하늘 라벨 31,102절 vs 시딩(개역개정) 31,088절 불일치.
  진척률 분모는 백엔드(31,088) 기준이라 라벨과 어긋남. 어느 쪽이 정본인지 정하고 맞추기.

## 진행 중: `feat/user-progress` (진척률/계정연결 API + 책 배경 정보 API)
계획 승인 완료(plan: `~/.claude/plans/supabase-humble-barto.md`). 두 기능:
1. **프로필**: `GET /users/me/profile` — 이름/이메일/streak/완필권수(정밀 절 커버리지)/진척률/
   필사기록/계정연결(auth.users.identities 조회)/언어설정.
2. **책 배경 정보**: `GET /books/:bookNo` — 요약/저자/기록시기/기록장소/수신대상/핵심주제/유튜브
   링크(컬럼만 확보, 링크 소싱은 보류).

**진행 상태**:
- [x] 마이그레이션(`20260713000000_users_language.sql`, `20260713010000_book_infos.sql`) 작성
  + 원격 반영 완료(`supabase migration list`로 in-sync 확인).
- [x] `books` 모듈 스캐폴딩 완료(`types/repository/service/controller/module.ts`, `app.module.ts`
  등록까지 완료, 빌드 통과).
- [x] **성경 66권 전체 배경 정보 시딩 완료**: `data/books.json`(66권 summary/author/written_period/
  written_place/audience/core_theme, youtube_url은 전부 null로 구조만 확보) + `scripts/seed-books.mjs`
  (`seed-verses.mjs`와 동일 패턴, PK `book_no` upsert). 원격 `book_infos` 테이블 66건 적재 확인 완료.
  `data/books.json`은 `bible.json`처럼 이미 Supabase에 적재됐다고 판단해 **`.gitignore`에 추가**(저장소엔
  안 올리고 로컬에서만 관리).
- [x] **`book_infos` PK 확장 완료**: 새 마이그레이션(`20260713020000_book_infos_translation_pk.sql`)으로
  `book_no` 단일 PK → `(translation_code, book_no)` 복합 PK로 교체(원격 반영 확인). `books` 모듈
  (`types`/`repository`/`service`)에 `translationCode` 반영(현재는 `KO_GAEGAEJEONG` 상수 기본값 —
  `verses` 모듈과 동일 패턴, 다중 번역본 실제 지원 시 파라미터화 예정). `data/books.json`에
  `translation_code` 필드 추가, `seed-books.mjs` upsert 키를 `translation_code,book_no`로 변경 후
  재시딩 완료. `GET /books/1`, `/books/66` 실동작 확인(`translationCode` 필드 포함 응답), `/books/999`는
  설계대로 400.
- [x] `docs/DATABASE.md`에 `book_infos`(복합 PK 포함)/`users.language` 반영 완료.
- [x] `users.language` 코드 반영: `user.types.ts`(`LANGUAGES`/`Language`), `user.repository.ts`
  (`UserRow.language`+매핑+`updateProfile` patch), `update-profile.dto.ts`(`@IsIn` 검증) 완료.
- [x] 완필/진척률 계산 `progress-calculator.ts`(순수함수, Learn-by-Doing으로 직접 구현) 완료 +
  jest 단위테스트 6종(빈 기록/부분 커버/완필/범위 중복/미등록 book 무시/0-분모 방어) 전부 통과.
  이를 위해 `writing.repository.findPassedRangesByUser`(통과 세션 범위 조회), `verse.repository
  .countVersesPerBook`(RPC) + `VerseService` 노출까지 신설.
- [x] **RPC 첫 사례 도입**: `count_verses_per_book`(book_no별 총 절수 group by 집계)는
  `.from()`으로 표현 불가해 Postgres 함수로 신설(`supabase/migrations/
  20260714000000_count_verses_per_book_fn.sql`). `supabase db push`로 원격 반영 완료, 실제 호출로
  검증 완료(66권 합계 31,088로 시딩값과 일치).
- [x] `@supabase/postgrest-js` 2.110.0에서 `.returns<T>()` deprecated 확인 → `.overrideTypes<T,
  {merge:false}>()`로 전면 교체(신규 코드 + 기존 `verse.repository.findRange`까지 통일). 단,
  `.rpc()` 체인은 Database 타입 생성 없이 쓰는 이 프로젝트 특성상 반환 타입 추론이 어긋나
  `overrideTypes`가 안 먹어서 `countVersesPerBook`만 `data`를 직접 `as` 캐스팅하는 방식으로 우회.
- [x] (범위 축소) 필사기록 목록(`recentWritings`/`GET /writing-sessions` 신규 엔드포인트)은
  드롭 결정 — 기존 `StatsService.getMyStatistics().totalCount`(통과 필사 총 횟수)로 충분하다고
  판단, `findByUser`/`listMyWritings` 불필요.
- [x] **계정 연결(identities) 조회 완료** — 원래 프로필 집계에 묶으려던 계획을 바꿔 **별도
  서브 리소스 엔드포인트로 분리**(`GET /users/me/linked-providers` → `{google,kakao}` boolean).
  근거: `auth.admin.getUserById()`(service_role admin API)는 무거워, 자주 불리는 프로필 조회에
  끼우면 "이름만 필요한" 호출까지 비용을 냄. 프론트는 프로필·연결상태·진척률을 병렬 호출.
  `UserRepository.getLinkedProviders`(identities → 화이트리스트 필터) + `UserService`(얇은
  pass-through, 존재 확인 불필요 — 데이터가 검증된 JWT의 auth.users에서 옴) + `UserController`
  핸들러. mock 토큰으로 Postman 검증 완료(`{google:false,kakao:false}` — 이메일/비번 mock
  유저라 identity가 email뿐이므로 정상). auth JWT 검증 코드 주석 정리도 함께.
- [x] **진척률 전용 엔드포인트 `GET /users/me/progress`** — 완필권수/전체진척/점등절수 반환(streak/
  총필사는 기존 stats에 그대로, **progress만** 반환하기로 결정). `GET /me/profile` 번들 집계는
  폐기(완전 분리). 마이페이지는 `GET /users/me` + `/progress`(신규) + `/linked-providers` **3개
  병렬 호출**. 오케스트레이션은 **`WritingService.getMyProgress`**에 둠(재료 `findPassedRangesByUser`
  +`countVersesPerBook`+`calculateProgress`가 모두 writing 도메인) → `UserService`가 얇은
  pass-through → `UserController` `GET me/progress`. `UserModule`이 `WritingModule` import(순환 없음).
  **진척률 = 정경 커버리지로 확정**(번역본별 아님): 밤하늘 UI가 "31,102절 밤하늘 = 절 주소당 별 하나"라
  같은 절을 여러 언어로 필사해도 주소로 dedupe(현 `findPassedRangesByUser`가 translation 무관이라 정합).
- [x] `npm run build` 통과 + `jest` 36/36 통과 + 앱 부팅 시 DI 순환 없음·라우트 매핑 확인.
  실제 Supabase 토큰으로 `GET /api/users/me/progress` Postman 인증 실요청 검증 완료(기대 응답
  `{coveredVerses,completedBooks,progressRate}` 일치).

**다음 세션 할 일**: ①실제 Supabase 토큰으로 `GET /api/users/me/progress` 인증 실요청 스모크
테스트(위 참고) → ②PR 정리/머지. 상세는 plan 파일(`~/.claude/plans/supabase-humble-barto.md`) 참고.

> `verses` 테이블의 주소/텍스트 정규화는 **보류**로 결정(성능 문제가 아니라 데이터 무결성 문제이고,
> 이미 라이브 FK(`writing_sessions.key_verse_id`, `daily_verses.verse_id`)가 걸려 있어 리스크가 큼 —
> 두 번째 번역본을 실제로 적재하게 될 때 재검토). `GET /verses` 성능 실측(포트폴리오용)은 프로젝트
> 밖 메모리(`project_verses_perf_benchmark`)에 별도 기록.

## 최근 세션
- 2026-07-17: **QT(묵상/적용/기도제목) 저장 — complete에 통합**. 필사 기록 입력 화면(QT 단계) 대응.
  태그 제안형 대신 **자유 텍스트 + 전부 선택 입력**으로 확정(텍스트→태그 확장은 가능하나 역방향
  불가라 되돌릴 수 있는 쪽 선택). ①마이그레이션 `20260717000000_writing_session_qt.sql`
  (nullable text ×3, 500자 check) — `supabase db push` 원격 반영 완료(컬럼 조회로 검증) ②`POST
  /writing-sessions/:id/complete` body에 optional `meditation`/`application`/`prayer`
  (claim 시점 저장, 재시도가 덮어씀) ③service `normalizeQtText`: trim 후 공백만이면 null
  (최근 기록 화면 "(묵상 미작성)" 판단이 null 의존) — Learn-by-Doing으로 직접 구현.
  완료 후 QT 수정 API는 기획상 없음(필요 시 PATCH 추가). jest 52/52 + API_SUMMARY 동기화.
- 2026-07-16: **API 문서 전면 개편 + 프로필·설정 화면 대조**. `API_SUMMARY.md`에 기능별
  소제목(`###`)·상단 목차·전 엔드포인트 실측 응답 예시 추가(노션 팀 공유용) + CLAUDE.md에
  "API 변경 시 문서 동기화" 규칙 추가. 프로필·설정 화면 대조 결과 **백엔드 갭 없음** 확인
  (완필 표시는 `completedBooks` 숫자로 충분, 데모 초기화는 백엔드 불요, 스탬프/알림/백업은
  추후). 최초 프로비저닝 시 provider full_name으로 `display_name` 시딩(c761c01)도 이 브랜치에 포함.
- 2026-07-16: **잔디 페이지 대응 — `writing_sessions.client_date` 저장 + `/stats/me`에 `streakStart` 추가**.
  잔디 페이지 배너("2개월 전 시편 1편으로 시작…")에 필요한 "스트릭 시작일에 뭘 필사했나"를 지원.
  ①마이그레이션: `client_date date` 컬럼 + 통과분 부분 인덱스(테이블 비어 있어 소급 문제 없음)
  ②claim 시점에 client_date 저장(재시도 complete가 덮어씀) ③`/stats/me` 응답에
  `streakStart { date, bookNo, bookName, chapter } | null` — `streakStartDate` 순수 함수(역산) +
  `StatsRepository.findFirstPassedWriting`(writing_sessions 읽기 — WritingModule↔StatsModule 순환
  회피로 stats 쪽 배치) + `BooksService.findByBookNo`(null 반환형 내부 API 신설, BooksModule 첫 export).
  "올해 기록일"은 기존 `/stats/activity` 행 수로 충분 확인. build + jest 51/51.
- 2026-07-16: **통계/잔디 기획 대조 완료 + 과거 날짜 streak 정책 확정**. 기획 확인: freeze 미구현
  의도적, 통과만 잔디 반영, 같은 날 중복은 잔디 진하기(모두 현행과 일치). 시차 이동으로 clientDate가
  lastWrittenDate보다 과거인 경우 **같은 날 취급으로 확정**(streak 유지 + lastWrittenDate 후퇴 금지로
  이중 적립 봉쇄 — 기존은 리셋이라 시차 사용자가 벌 받는 버그성 동작). `streak-calculator.spec.ts`
  신설(9케이스, 백로그의 테스트 보강 항목 해소). UTC 잔재 주석·deprecated `.returns()` 정리.
  build + jest 46/46 통과. 남은 공백: `stats.service` 계층 테스트 없음(lastWrittenDate 후퇴 방지는
  순수함수 밖 로직이라 미검증).
- 2026-07-16: **잔디/streak 기준일을 서버 UTC → 클라이언트 로컬 날짜로 변경** ⚠️ 팀원 공유 필요
  (stats/잔디 흐름은 다른 팀원 작업 영역). ①`POST /writing-sessions/:id/complete` body에 `date`
  (YYYY-MM-DD) **필수 필드 추가** — 프론트 breaking change, `/verses/today`와 동일 방침.
  ②`StatsService.recordWriting`에 서버 UTC 대신 이 clientDate가 전달됨(세션 DB엔 저장 안 하고
  complete→백그라운드 검사로 메모리 전달 — 재시도 시 새 요청이 다시 가져오므로 수명 일치).
  ③검증은 실존 날짜만(2026-02-31 등 400) — 서버 시간과의 오차 검증은 지금 단계에선 과하다고
  판단해 **의도적으로 생략**(클라이언트 신고 신뢰, MVP). 부수: `ProgressSnapshot`에 `totalVerses`
  (진척률 분모) 필드 추가. build + 전체 jest 37/37 통과.
- 2026-07-15: **실제 구글 OAuth 로그인 활성화** — Supabase 대시보드에 Google provider 등록
  (구글 콘솔에서 OAuth 클라이언트 생성 → Client ID/Secret을 Supabase에 저장, 콜백 URL 교환),
  브라우저 authorize 흐름으로 발급받은 **진짜 토큰이 백엔드 인증 통과 확인**(mock의 provider 강제
  주입 불필요 — 실제 OAuth는 `app_metadata.provider=google` 자동). 백엔드 코드 변경 0(리소스
  서버라 provider만 켜면 동작). 카카오는 동일 절차로 provider만 켜면 됨(미설정) — `users.provider`
  CHECK 제약·`AUTH_PROVIDERS`·`getLinkedProviders`가 이미 카카오 대비 완료라 테이블 변경 불필요.
  클라이언트 연동 가이드 `docs/CLIENT_AUTH_FLOW.md`에 구글/카카오 반영. `seed-mock-user.mjs` 테스트 curl `/api` prefix 정정.
- 2026-07-15: **`GET /users/me/progress` 진척률 엔드포인트 배선 완료**(progress만 반환, streak 분리).
  오케스트레이션은 `WritingService.getMyProgress` → `UserService` pass-through → `UserController`.
  진척률 = 정경 커버리지(번역본 통합)로 확정 — 밤하늘 UI 목업(31,102절=주소당 별)이 근거. build/jest
  36/36/부팅 DI·라우트 확인. 밤하늘 밝기(절별 필사 횟수) 엔드포인트·절수 라벨(31,102 vs 31,088) 정합은
  백로그로. 실제 토큰 인증 스모크만 남음(비대칭 JWKS라 mock 불가).
- 2026-07-15: 계정 연결 상태 조회를 **별도 엔드포인트로 분리** 구현·검증
  (`GET /users/me/linked-providers`, repository/service/controller 3계층 + Postman 확인).
  프로필 집계는 무겁지 않게 유지하려 계정 연결을 떼어냄. auth JWT 검증 흐름(비대칭 서명/JWKS
  공개키/RLS 우회 service_role) 학습 정리. `API_SUMMARY.md`에 신규 엔드포인트 반영.
- 2026-07-14 ~ 07-15: 프로필 집계 API(Feature ①) 진행 — `users.language` 코드 반영,
  `progress-calculator.ts`(완필/진척률 순수함수) 구현+jest 6종 통과, RPC 첫 도입
  (`count_verses_per_book`, 원격 반영+실동작 검증 완료), `.returns()` deprecated → `overrideTypes`
  전환. 필사기록 목록 기능은 `stats.totalCount`로 충분하다고 판단해 범위에서 제외. 상세는 위
  "진행 중" 섹션 참고.
- 2026-07-06 ~ 07-13: W1/W2 수직 슬라이스, 성경 전체 시딩(31,088절)+`translation_code` 체계,
  프로덕션 배포/CI/CD 인프라(레지스트리 빌드 전환 포함), `books` 모듈+`book_infos`(복합 PK) —
  상세는 위 "완료" 섹션들과 git log 참고.
