# 진행 상황 로그 (세션 인수인계용)

> 세션 시작 시 먼저 읽고, 의미 있는 진행이 있으면 마무리 전에 갱신. **간결하게 유지** — 상세 배경은
> git log / `docs/DATABASE.md` / `docs/ARCHITECTURE.md`에 있으니 여기엔 한두 줄 요약만 남긴다.

## 상태
`main` 최신(2026-07-13). **프로덕션 전체 스택 라이브** — https://reverse-growthlog.com
(web/api/health/db 모두 200). CI/CD(GitHub Actions, 매일 1회 자동 배포) 실동작 검증 완료.
로컬 `.env` 있음(개발/시딩 가능). 현재 작업 브랜치: **`feat/profile-book-info`**(아래 "진행 중" 참고).
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
전역 `/api` prefix). CI/CD(GitHub Actions, Workload Identity + IAP, 매일 1회 배포·변경 시에만
재빌드) 실동작 검증 완료. 팀원 IAM+SSH IAP 전환(22번 포트 전세계 개방 방화벽 삭제).
Gemini 유사도 검사 인프로세스 백그라운드 배선(원자적 선점, 인프라 오류 시 재시도 가능).
프론트(`reverse_app`) Docker화 + `feat/docker-nginx`→main 병합, VM이 main 추종(단, 신규 페이지는
라우터 미배선이라 화면은 기존 대시보드 그대로 — 팀원 작업 필요). 로컬 dev 매뉴얼 `docs/LOCAL_DEV.md`.

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
- [ ] 프로필 집계 API(Feature ①) 전체 — 착수 전. **다음 세션 시작 지점.**

**다음 세션 할 일**: 프로필 집계 API(Feature ①) 구현 — `GET /users/me/profile`
(이름/이메일/streak/완필권수/진척률/필사기록/계정연결/언어설정). 상세는 plan 파일(`~/.claude/plans/supabase-humble-barto.md`) 참고.

> `verses` 테이블의 주소/텍스트 정규화는 **보류**로 결정(성능 문제가 아니라 데이터 무결성 문제이고,
> 이미 라이브 FK(`writing_sessions.key_verse_id`, `daily_verses.verse_id`)가 걸려 있어 리스크가 큼 —
> 두 번째 번역본을 실제로 적재하게 될 때 재검토). `GET /verses` 성능 실측(포트폴리오용)은 프로젝트
> 밖 메모리(`project_verses_perf_benchmark`)에 별도 기록.

## 최근 세션
- 2026-07-13: **`book_infos` 다국어 대응 확정** — 번역본별 콘텐츠(특히 `book_name` 표기 차이)를
  담기 위해 PK를 `book_no` 단일 → `(translation_code, book_no)` 복합으로 확장(신규 마이그레이션,
  원격 반영), `books` 모듈/`data/books.json`/`seed-books.mjs` 반영+재시딩, `GET /books/:bookNo`
  실동작 확인, `docs/DATABASE.md`에 `book_infos`/`users.language` 반영까지 완료. 곁가지로 `verses`
  정규화(주소/텍스트 분리)도 검토했으나 이 규모(3만~31만 행)에선 성능 이득이 없고 라이브 FK
  리스크만 있어 보류.
- 2026-07-13: **성경 전체 시딩(31,088절)+`translation_code` 체계+PR #3 merge** (완료 섹션 참조).
  새 브랜치 `feat/profile-book-info` 착수 — 프로필 집계 + 책 배경 정보 API 계획 승인, 마이그레이션
  2건 작성+원격 반영, `books` 모듈 스캐폴딩+앱 등록까지 완료. **브랜치 분기 시점이 낡아있던 문제
  발견**(로컬이 fetch 안 해서 `origin/main`이 PR #3·배포 완료 커밋들보다 뒤처진 지점) → `git fetch` +
  `origin/main` 병합(충돌 없음, fast-forward)으로 최신화. 이어서 **성경 66권 전체 배경 정보 시딩**
  (`data/books.json` + `seed-books.mjs`, `book_infos` 테이블 66건 적재 확인).
- 2026-07-13: **프로덕션 전체 스택 라이브 + CI/CD 완성** — VM에 실키 배치, GitHub Actions로 매일 1회
  자동 배포(WIF+IAP, 변경 시에만 재빌드) 실동작 검증. 팀원 IAM+IAP 터널 전환(SSH 전세계 개방 방화벽
  삭제). 프론트 Docker화 브랜치 main 병합 + VM 전환(신규 페이지 라우팅은 팀원 몫). 로컬 dev 매뉴얼 추가.
- 2026-07-06 ~ 07-12: W2 수직 슬라이스(verse/writing/stats 모듈, Gemini 유사도 검사, Docker화,
  배포 인프라 구축) — 상세는 위 "완료" 섹션과 git log 참고.
