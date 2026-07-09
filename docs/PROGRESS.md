# 진행 상황 로그 (세션 인수인계용)

> 세션 시작 시 먼저 읽고, 의미 있는 진행이 있으면 마무리 전에 갱신. **간결하게 유지** — 상세 배경은
> git log / `docs/DATABASE.md` / `docs/ARCHITECTURE.md`에 있으니 여기엔 한두 줄 요약만 남긴다.

## 상태
브랜치 `feat/w2-verse-writing-streak` (2026-07-07 기준)

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
