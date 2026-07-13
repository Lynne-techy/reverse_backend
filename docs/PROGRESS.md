# 진행 상황 로그 (세션 인수인계용)

> 세션 시작 시 먼저 읽고, 의미 있는 진행이 있으면 마무리 전에 갱신. **간결하게 유지** — 상세 배경은
> git log / `docs/DATABASE.md` / `docs/ARCHITECTURE.md`에 있으니 여기엔 한두 줄 요약만 남긴다.

## 상태
`main` 최신 (2026-07-12, w3 브랜치 머지 완료). **블로커: Supabase 키 미확보** —
로컬 `.env` 부재 + VM의 `.env`도 더미 값. 키만 채우면 VM 기동(런북 §5) 가능.
인프라: GCE VM `reverse-vm`(서울, e2-small) + 도메인 `reverse-growthlog.com` +
Cloudflare(프록시 ON, Full strict, Origin CA ~2041) **구축 완료, §5 기동 직전 상태**.
쉬는 동안 VM 중지 권장: `gcloud compute instances stop reverse-vm --zone=asia-northeast3-a`

## 완료 (W1)
기반구조·의존성, Auth/User 모듈(controller/service/repository 구조), DB 모델링 문서,
MVP 7개 테이블 마이그레이션(users/verses/daily_verses/writing_sessions/user_statistics/
user_daily_activity/streak_freeze_events). 커밋 5개로 분리 완료.
ARCHITECTURE.md·README.md도 실제 단순 구조에 맞게 정리 완료.

## 보류
별(밤하늘) 시각화 컬럼 — 방식 미확정 (`docs/DATABASE.md` 6장).
OCI Object Storage, 전체 성경 임포트 — 수직 슬라이스 이후.
(`ocr_jobs`/Python OCR 워커는 **폐기** — Gemini API 직접 호출로 대체, 2026-07-06.)

## 다음 목표: 수직 슬라이스 (walking skeleton)
로그인 → 필사 업로드 → 잔디까지 얇게 한 번 관통. 확정된 결정:
- **JWT**: JWKS(비대칭). `auth.service.ts` 기존 구현 그대로 사용.
- **이미지 저장**: Supabase Storage(임시, presigned URL). OCI는 나중에 교체.
- **유사도 검사**: 슬라이스는 stub(세션 생성 시 무조건 통과). 정식은 **Gemini API 직접 호출**(백그라운드 잡)로 seam만 남김 — 별도 OCR 워커 폐기.
- **mock 유저**: 시드 스크립트에서 `app_metadata.provider='google'` 주입(방법 A).
  이유: 코드의 provider 허용목록은 `google`/`kakao`뿐이라, email/password 유저 토큰은
  `auth.service.ts`에서 401. 프로덕션 코드 안 건드리고 테스트 데이터만 구글 유저처럼 흉내.
- **시딩**: 우선 미니 시드(5~10절)만. 저작권 있는 번역본(GAE/NIV) 사용은 별도 확정 필요.

진행 순서: ① 마이그레이션 적용+부팅 스모크 → ② mock 유저 토큰으로 Auth/JIT 검증
→ ③ 미니 시드 → ④ 업로드~잔디 관통(유사도 stub) → ⑤ Dockerfile/.env.example로 팀원 배포 인계.

## 다음 단계 (진행 중)
- [x] Supabase 프로젝트 생성 + login/link → `db push` (7개 테이블 원격 적용, in-sync)
- [x] 앱 부팅 스모크 테스트 (env 검증 통과, /health 200, AuthGuard 401 확인)
- [x] ② mock 유저 시드(`scripts/seed-mock-user.mjs`, provider='google' 주입) → /users/me 200, JIT 프로비저닝으로 users INSERT 확인(DB write 실연결), 변조 토큰 401
- [x] ③ 미니 시드(`scripts/seed-verses.mjs`, verses 6건 적재). `char_count` 컬럼은 미사용 판단으로 제거(`20260707000000_drop_verses_char_count.sql`)
- [x] ④-1 `verse` 모듈: `GET /verses/today?date=YYYY-MM-DD`. 전역 공통 배정, 서버는 타임존 계산 없이 클라이언트가 보낸 로컬 날짜를 그대로 키로 사용(streak과 달리 조작 리스크 없는 콘텐츠성 데이터라 신뢰). 동시성은 upsert+ignoreDuplicates로 처리. mock 토큰으로 정상/재조회 고정/400/401 케이스 검증 완료.
- [x] ④-2 `writing` 모듈: `POST /writing-sessions/upload-url`(presigned URL 발급+세션 생성), `POST /writing-sessions/:id/complete`(유사도 검사 stub — 항상 통과). Storage 버킷 `writing-images`(private) 연동. 정상/중복완료(409)/소유권없음(403)/미존재세션(404) 케이스 검증 완료.
- [~] ④-3 `stats` 모듈(streak/잔디) — **구현 완료, 아직 커밋 안 함**. `GET /stats/me`, `GET /stats/activity?from&to`. streak 계산은 `streak-calculator.ts` 순수 함수로 분리(연속/끊김/첫필사/같은날 멱등). 필사 통과 시 `writing.service.complete()`가 `StatsService.recordWriting(userId, UTC오늘)` 호출 → 잔디 +1 + streak 갱신. curl로 첫필사(streak 1)·같은날 재필사(streak 유지, total/잔디 +1) 검증 완료. **미검증 경로**: 연속(+1)·끊김(리셋) — 하루 대기/`last_written_date` 조작 필요.
  - **다음 세션 할 일**: ① `streak-calculator` jest 단위테스트(연속/끊김/미래날짜 케이스) ② PROGRESS 갱신 후 **커밋**(현재 stats 모듈 전체 + app/writing 배선 + `docs/POSTMAN_TEST.md`가 uncommitted). 사용자가 포스트맨 수동 테스트를 먼저 해본 뒤 ①②로 이어가기로 함.
- [x] streak/잔디의 타임존은 MVP 범위에서 서버 UTC로 단순화 결정(`docs/DATABASE.md` §user_daily_activity 결정 참고). 사용자별 타임존 반영은 추후 과제.
- [x] 필사 **절 범위**(같은 장, start/end_verse_no) + `key_verse_id` + 범위 조회 `GET /verses?book&chapter&from&to`. (아래 최근 세션 참조)
- [ ] (백로그) 구절 검색/목록 API 확장 — 현재 `GET /verses`는 같은 장 범위 조회만. 책/장 목록 등 브라우징은 이후.
- [ ] (미정) QT(묵상/적용/기도) — 프로토타입은 자유 텍스트지만 UX상 태그 제안형 검토 중. 방식 확정 후 태그 마스터/조인 테이블.
- [ ] (이후) emotion_tags, verse_emotion_tags, quests, user_quests

## 최근 세션
- 2026-07-12: **런북 §5 사실상 완료(web) — https://reverse-growthlog.com 라이브** 🎉 (api만 Supabase 키 대기). ① 이미지 빌드 검증: 2GB VM에서 api+web 빌드 **1분 53초, 스왑 32KiB만 사용** → 이슈 A(OOM 리스크)는 첫 빌드 기준 기우로 실증, 재배포(컨테이너 가동 중) 시나리오만 관찰 필요. ② web 단독 기동 중 발견: nginx 고정 proxy_pass는 api 부재 시 기동 실패 → **변수+resolver로 요청 시점 해석**으로 수정(양 레포 nginx conf). ③ 도메인 522 → 원인: **80/443 방화벽 규칙 부재**(태그 매칭 규칙은 콘솔 생성 시만 자동) → 규칙 생성 후 200 OK, 전체 체인(Cloudflare 프록시→GCP 방화벽→nginx TLS→SPA) 관통 확인. `/api/*`는 예상대로 502. 런북 §1에 방화벽 명령 추가. 프론트 nginx 수정은 `feat/docker-nginx`에 push(PR 반영). **VM 켜둔 상태** — 쉴 때 stop 잊지 말 것.
- 2026-07-12: **인프라 구축(런북 §1~§4 완료, 사용자 직접)** — GCP `reverse-502210`, VM `reverse-vm` 생성(최초 콘솔 생성분은 명명 불일치로 삭제 후 gcloud 재생성), TZ Seoul·스왑·Docker 확인, 코드 배치(`~/reverse/`), 도메인 `reverse-growthlog.com` + Origin CA(만료 2041-07-08) 설치, `docker compose config` 정합성 검증 통과. §5 기동은 Supabase 키 대기. **미완**: ufw/fail2ban/SSH 잠금(setup-vm.sh 일부), A레코드 프록시 ON·Full(strict) 재확인 필요. **발견 이슈(결정 대기)**: A) 2GB VM 자체 빌드 OOM 리스크 → Actions 빌드+레지스트리 pull 전환 검토, B) SSH 22 IP 제한 vs Actions 배포 모순 → IAP 터널 검토. C) 헬스체크가 DB 비활성 정지 못 막는 문제는 `GET /health/db`(실쿼리) 추가로 **해결**, 런북 크론을 09:00 KST·/health/db로 수정(D도 해결). 보안: Gemini 키 스크린샷 노출 → 재발급 완료(사용자), `cert/`는 git 미추적·ignore 확인 완료(재발급 불요), 로컬 개인키 사본 삭제 권장. Windows 함정 로그는 사용자 기록 참조.
- 2026-07-12: **배포 런북/스크립트**(`deploy/`) — GCE VM 생성 gcloud 명령, `setup-vm.sh`(스왑/ufw/fail2ban/Docker/SSH 잠금), 프로덕션 compose(TLS 종단 nginx-prod.conf, Origin CA 볼륨), GH Actions 배포 템플릿(.example — VM 준비 후 workflows로 이동). 실행 대기 조건: GCP 계정·결제, 도메인+Cloudflare, Supabase 키. 이 머신엔 gcloud/Docker 미설치.
- 2026-07-12: **Gemini 유사도 검사 배선(스텁 제거)** — complete()가 원자적 선점(pending/uploaded/failed→processing) 후 즉시 응답, 검사는 인프로세스 백그라운드(ADR 6.11): Storage 다운로드 + 범위 원문 join → HandwritingCheckService(팀원 구현, PR #2) 대조. 통과=펜 손글씨 && 점수≥60(상수 `PASS_MIN_SIMILARITY_SCORE`, 정책 문서 명문화), 통과 시에만 잔디/streak. 인프라 오류는 failed(재시도 가능), 부팅 시 잔류 processing 정리(단일 인스턴스 전제). `GET /writing-sessions/:id` 폴링 추가, 디버그 엔드포인트 dev 전용 잠금, config가 `.env.local`도 읽게 수정. 단위테스트 26개 통과·빌드 OK. **미검증**: 실제 Gemini/Storage E2E — `.env` 부재로 부팅 불가(위 상태 참고). 언어별 원문(en 번역본)은 TODO.
- 2026-07-12: **프론트 배포 판정 + 기획 문서 v2.1** — Cloudflare Pages vs nginx 검토 → **프로덕션 nginx 확정**(Pages `_redirects`는 외부 도메인 프록시 불가 → CORS/Functions 글루 필요, 대회 어필 상실; Pages는 프리뷰 채널로 공존). 대회용 아키텍처 기획 문서 개정판 `docs/ARCHITECTURE_v2.1.md` 작성(Redis+BullMQ 워커 제거 → 인프로세스 비동기 ADR 6.11 신설, 6.8 supersede, 구성도 2컨테이너화) — Notion 반영용, 레포 잔류 여부는 사용자 판단.
- 2026-07-12: **프론트 결합 compose(상위 레벨)** — `reverse/docker-compose.yml` 신설(web: nginx 정적 서빙+`/api/**` 프록시, api: ports→expose 전환). 프론트 레포(`front/reverse_app`, 별도 git)에 `Dockerfile`/`nginx.conf`/`.dockerignore` 추가 — 팀원 레포라 커밋/PR은 별도. 프론트 `npm run build`(tsc -b)는 미배선 페이지(MainPage/ProfilePage)의 깨진 import·미사용 변수로 **실패** → 도커 빌드는 `vite build`만 사용(임시, 프론트에서 tsc 오류 해소 필요). 상위 compose는 git 밖(비버전) — 위치 확정 시 이동. Docker 미설치로 이미지 빌드 여전히 미검증. 프론트는 아직 API 미호출(더미 데이터)이라 실제 연동 코드는 별도 과제. 참고: 프론트에 wrangler(Cloudflare Pages) 배포 스크립트 존재 — 최종 배포 방식(nginx vs Pages+CORS)은 팀 확정 필요.
- 2026-07-10: **Docker 컨테이너화(백엔드 단독, Option B)** — 팀 zip에서 API용 `Dockerfile`(node:22-alpine 멀티스테이지)만 채택해 루트에 추가, `.dockerignore`·백엔드 전용 `docker-compose.yml`(api만, 3000 노출) 작성. `main.ts`에 `app.setGlobalPrefix('api')` 추가(배포 시 nginx가 `/api/**`만 프록시하는 전제 — **모든 라우트가 `/api/*`로 이동**, Swagger는 `/api-docs` 유지). zip의 `.env.example`(Prisma/R2 기반)은 현재 코드와 안 맞아 채택 안 함. nginx+프론트 결합 compose는 배포 시점에 상위 레벨에서. 빌드·단위테스트 통과, Docker 미설치라 이미지 빌드는 미검증.
- 2026-07-09: **흐름 A 반영** — 실제 UX상 key verse는 세션 생성이 아니라 이미지 업로드 후 "기록 저장"(complete) 때 정해짐. `key_verse_id`를 nullable로 바꾸고 complete 바디(`{keyVerseId}`)로 이동. 생성 시엔 앵커가 없어 `book_no`/`chapter`를 세션에 저장(범위 자립). upload-url 바디 `{book,chapter,startVerseNo,endVerseNo,language}`. 마이그레이션 `20260709020000_writing_session_defer_key_verse.sql`. **key verse가 세션 범위 안인지 검증은 사용자가 직접 작성 예정(complete의 TODO).** QT는 형식 미정이라 제외.
- 2026-07-09: **필사 범위 + key verse** 도입. 필사 단위를 단일 절 → 같은 장 내 절 범위(`start_verse_no`/`end_verse_no`)로 확장하고, `verse_id`→`key_verse_id`(범위 중 대표 절, book/chapter 앵커) 이름변경. 범위는 경계 2컬럼으로 저장(1필사=1행=잔디 +1). 범위 조회 읽기 API `GET /verses?book&chapter&from&to` 추가(key verse 선택용). 마이그레이션 `20260709010000_writing_session_verse_range.sql`, 연속 절 시드(시23:1-6) 추가. upload-url 바디 `{keyVerseId,startVerseNo,endVerseNo,language}`. **범위 유효성 검증(key verse∈범위, start≤end)은 사용자가 직접 작성 예정(writing.service TODO).**
- 2026-07-09: 프론트 프로토타입(필사 흐름)과 백엔드 수직 슬라이스 비교 → 격차 도출(절 범위/언어/key verse/QT/유사도 실체/도트맵). 이번 증분은 **언어 하나만**: `writing_sessions.language`(ko/en, bilingual 제외) 추가. DTO `@IsIn` + DB `not null` + `check` 이중 방어선(사용자 입력이라). 기존 세션 행 truncate 후 not null 추가(타입 non-null과 정합). 마이그레이션 `20260709000000_writing_session_language.sql` 원격 적용, POSTMAN 400/201/400 검증. 범위·key verse·QT는 백로그로.
- 2026-07-08: `stats` 모듈 구현(위 ④-3 참조). streak-calculator 순수함수는 사용자가 직접 작성(첫필사 off-by-one 버그 잡고 미래날짜 throw 정리). 필사→잔디 관통 curl 검증. `docs/POSTMAN_TEST.md`(임시 수동테스트 가이드) 추가. **아직 커밋 안 함** — 다음 세션에 단위테스트+커밋.
- 2026-07-07: `writing` 모듈 구현+검증 완료(위 참조). Swagger로 API 문서화. `verse` 모듈 구현+검증 완료. 브랜치를 `feat/w2-verse-writing-streak`로 분리.
- 2026-07-06: **유사도 검사 방침 변경** — 별도 Python OCR 워커 → **Gemini API 직접 호출**(NestJS 인프로세스 백그라운드 잡, 비동기+폴링). 새 마이그레이션 `20260706000000_gemini_similarity.sql`(writing_sessions: `ocr_score` 드롭, `ocr_text`→`recognized_text`). ARCHITECTURE/DATABASE/TODO 문서 반영, `ocr_jobs` 폐기. **원격 적용 완료(`db push`).**
- 2026-07-06: 수직 슬라이스 전략·결정 확정(위 참조). Supabase CLI 설치+`supabase init`
  (config.toml 생성). 마이그레이션 SQL 검토 완료(push 정합성 OK). 사용자 login/link 대기 중.
- 2026-07-06: writing_sessions 완성, DB 문서 정리, 커밋 5개, PROGRESS.md/CLAUDE.md 신설,
  ARCHITECTURE.md·README.md 4계층→단순구조로 정리
