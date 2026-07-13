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
- [~] `books` 모듈 스캐폴딩 완료(`types/repository/service/controller/module.ts`, `app.module.ts`
  등록까지 완료, 빌드 통과) — `data/books.json`·`scripts/seed-books.mjs` 미작성.
- [ ] 프로필 집계 API(Feature ①) 전체 — 착수 전.
- [ ] `docs/DATABASE.md`에 `book_infos`/`users.language` 반영 — 착수 전.

**다음 세션 할 일**: 대표 5권(창세기/시편/요한복음/로마서/요한계시록) `data/books.json` 작성
(book_no는 실제 verses 테이블 기준 창세기=1/시편=19/요한복음=43/로마서=45/요한계시록=66으로 확인 완료)
+ `seed-books.mjs` → Feature ① 구현 → 문서/빌드/테스트 검증. 상세는 plan 파일 참고.

## 최근 세션
- 2026-07-13: **성경 전체 시딩(31,088절)+`translation_code` 체계+PR #3 merge** (완료 섹션 참조).
  새 브랜치 `feat/profile-book-info` 착수 — 프로필 집계 + 책 배경 정보 API 계획 승인, 마이그레이션
  2건 작성+원격 반영, `books` 모듈 스캐폴딩+앱 등록까지 완료. **브랜치 분기 시점이 낡아있던 문제
  발견**(로컬이 fetch 안 해서 `origin/main`이 PR #3·배포 완료 커밋들보다 뒤처진 지점) → `git fetch` +
  `origin/main` 병합(충돌 없음, fast-forward)으로 최신화.
- 2026-07-13: **프로덕션 전체 스택 라이브 + CI/CD 완성** — VM에 실키 배치, GitHub Actions로 매일 1회
  자동 배포(WIF+IAP, 변경 시에만 재빌드) 실동작 검증. 팀원 IAM+IAP 터널 전환(SSH 전세계 개방 방화벽
  삭제). 프론트 Docker화 브랜치 main 병합 + VM 전환(신규 페이지 라우팅은 팀원 몫). 로컬 dev 매뉴얼 추가.
- 2026-07-06 ~ 07-12: W2 수직 슬라이스(verse/writing/stats 모듈, Gemini 유사도 검사, Docker화,
  배포 인프라 구축) — 상세는 위 "완료" 섹션과 git log 참고.
