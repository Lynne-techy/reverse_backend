# 진행 상황 로그 (세션 인수인계용)

> 세션 시작 시 먼저 읽고, 의미 있는 진행이 있으면 마무리 전에 갱신. **간결하게 유지** — 상세 배경은
> git log / `docs/DATABASE.md` / `docs/ARCHITECTURE.md`에 있으니 여기엔 한두 줄 요약만 남긴다.

## 상태
`main` 최신. **프로덕션 전체 스택 라이브** — https://reverse-growthlog.com
(web/api/health/db 모두 200). CI/CD는 **레지스트리 빌드로 전환 완료**(GitHub Actions가 빌드해
Artifact Registry push, VM은 pull만 — 매일 1회 자동 배포). 로컬 `.env` 있음(개발/시딩 가능).
현재 작업 브랜치: **`feat/profile-book-info`**(아래 "진행 중" 참고). 남은 것: 프론트
`RecommendPage` 실제 구현(팀원), 모니터링 알림 정책(선택), e2-medium 리사이즈(부하 시).
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
- [ ] 구절 검색/목록 API 확장 — 현재 `GET /verses`는 같은 장 범위 조회만.
- [ ] (미정) QT(묵상/적용/기도) — 자유 텍스트 vs 태그 제안형 미확정.
- [ ] (이후) emotion_tags, verse_emotion_tags, quests, user_quests
- [ ] streak-calculator 연속(+1)/끊김(리셋) 케이스 jest 보강(첫필사/같은날만 검증됨)
- [ ] 프론트 신규 페이지(Login/pilsa/heatmap 등) 라우터 배선 — 팀원 작업

## 진행 중: `feat/profile-book-info` (프로필 조회 API + 책 배경 정보 API)
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
- [ ] **진척률 전용 엔드포인트 `GET /users/me/progress`** — streak/완필권수/진척률 반환.
  `GET /me/profile` 번들 집계는 **폐기(완전 분리로 결정)**: 계정 연결을 뗀 "무거우면 분리" 원칙을
  진척률에도 동일 적용. 마이페이지는 `GET /users/me`(기본,이미 있음) + `/progress`(신규) +
  `/linked-providers`(완료) **3개를 프론트에서 병렬 호출**. 남은 배선: `calculateProgress`
  (순수함수, 완료)를 실제로 호출하는 오케스트레이션 서비스 메서드 — 입력 `findPassedRangesByUser`
  (writing.repo, 완료)+`countVersesPerBook`(verse.service, 완료)를 조합 → 컨트롤러 핸들러.
  `StatsService.getMyStatistics`(streak/총필사)와 합쳐 한 응답으로 줄지, progress만 줄지는
  착수 시 결정.
- [ ] 최종 `npm run build`/`jest` 전체 재확인 + mock 토큰으로 `GET /api/users/me/progress` 수동 검증.

**다음 세션 할 일**: ①`GET /users/me/progress` 진척률 오케스트레이션+컨트롤러(번들 집계 없음) →
②빌드/테스트/수동 검증. 상세는 plan 파일(`~/.claude/plans/supabase-humble-barto.md`) 참고.

> `verses` 테이블의 주소/텍스트 정규화는 **보류**로 결정(성능 문제가 아니라 데이터 무결성 문제이고,
> 이미 라이브 FK(`writing_sessions.key_verse_id`, `daily_verses.verse_id`)가 걸려 있어 리스크가 큼 —
> 두 번째 번역본을 실제로 적재하게 될 때 재검토). `GET /verses` 성능 실측(포트폴리오용)은 프로젝트
> 밖 메모리(`project_verses_perf_benchmark`)에 별도 기록.

## 최근 세션
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
