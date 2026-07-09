# 1차 MVP TODO

> **1차 MVP 범위**만 담은 도메인별 체크리스트. 완료된 것(W1 기반·Auth·User·스키마)은
> 여기 넣지 않는다 — 완료 이력은 `docs/PROGRESS.md`가 담당한다.
> 게임화(Quest)·감정 추천·전체 성경 임포트·OCI 교체 등 후순위/보류 항목은
> **범위 밖** — `docs/ARCHITECTURE.md` C-4(6주 로드맵) 및 git 히스토리 참고.
> 출처: `docs/PROGRESS.md`(수직 슬라이스 잔여) · `docs/ARCHITECTURE.md` C-3/C-4.

## 우선순위 범례
- `[슬라이스]` — 지금 관통 중인 수직 슬라이스(로그인→필사 업로드→잔디) 잔여. **최우선**.
- `[MVP]` — 슬라이스 이후 1차 MVP 완성에 필요.

---

## Bible (구절 / 오늘의 말씀)
모듈 미생성 — `src/modules/bible/` 신설 필요.

- [ ] `[MVP]` verses 조회 API (`VerseService.getVerse`, 번역본·책·장·절 기준)
- [ ] `[MVP]` 오늘의 말씀 **전역 배정** 배치 (`assignDailyVerse`) + 조회 (`GetDailyVerse`)

## Writing (필사) — 핵심
모듈 미생성 — `src/modules/writing/` 신설 필요.

- [ ] `[슬라이스]` 이미지 업로드 URL 발급 — 슬라이스는 **Supabase Storage** presigned (`POST /writings/upload-url`)
- [ ] `[슬라이스]` `CreateWritingSession` — `object_key` + `verse_id`로 세션 생성 (`POST /writings`)
- [ ] `[슬라이스]` 유사도 **stub** — 세션 생성 시 무조건 통과 처리(Gemini 호출 붙일 seam만 남김)
- [ ] `[MVP]` **Gemini 유사도 검사 연동** — 백그라운드 잡이 `uploaded` 세션 클레임(→`processing`) → `GeminiClient`로 이미지+원문 비교 → `recognized_text`/`similarity_score` 저장 → 통과 판정(`applySimilarityResult`) → `completed`/`failed`
  - **이미지 전달 방식(주의)**: Gemini에 Supabase의 signed read URL을 넘겨선 안 됨. Gemini API의 이미지 입력은 `inline_data`(base64 바이트) 또는 Google 스토리지 참조(Files API URI / Vertex의 `gs://`)만 받고, 임의의 외부 HTTPS URL은 이미지 입력으로 못 받는다(프롬프트에 URL을 텍스트로 넣으면 모델이 fetch하지 않고 문자열로만 인식 → 할루시네이션 위험). → **서버가 `object_key`로 Storage에서 바이트를 직접 download 후 base64 inline으로 전달.** private 버킷 폐쇄성 유지 + Gemini가 Supabase에 접근할 필요 없음. (`url_context` 도구는 웹페이지 grounding용이라 이 용도엔 부적합.)
- [ ] `[MVP]` 세션 상태/결과 폴링 조회 (`GET /writings/:id`)
- [ ] `[MVP]` 내 필사 목록 조회 (`listMyWritings`, `(user_id, created_at desc)` 인덱스 활용)

## Streak (연속 기록)
모듈 미생성 — `src/modules/streak/`. 필사 완료 후 Writing이 직접 순차 호출.

- [ ] `[MVP]` `StreakCalculator` 순수 함수(연속/끊김 판정) — **테스트 우선** 작성
- [ ] `[슬라이스]` 필사 통과 시 `user_statistics` 갱신(current/longest_streak, total_count, last_written_date)

## Stats (통계 / 잔디)
모듈 미생성 — `src/modules/stats/`.

- [ ] `[슬라이스]` `user_daily_activity` 집계(그날 통과 count) → **잔디** 데이터
- [ ] `[MVP]` 통계 조회 API (`getMyStatistics`) + 활동 캘린더 조회 (`getActivityCalendar`)

## 인프라 · 배포 · 하드닝
- [ ] `[슬라이스]` `Dockerfile` + `.env.example` — 팀원 배포 인계 (수직 슬라이스 마지막 단계 ⑤)
- [ ] `[MVP]` RLS 최소 정책 적용(소유 테이블 `auth.uid()=user_id` 읽기, verses 공개 읽기)
- [ ] `[MVP]` 예외 필터 / 로깅 보강
- [ ] `[MVP]` e2e 테스트

## 데이터 / 스키마
- [ ] `[슬라이스]` 미니 시드(5~10절) 적재·검증 (`scripts/seed-verses.mjs` + `data/verses.sample.json`)

---

## 선행 결정 필요 (1차 MVP에 영향)
상세는 `docs/ARCHITECTURE.md` §열린 질문 · `docs/DATABASE.md` §5 참고.

1. 필사 단위: 단일 절 vs 다중 절(passage) — Writing/verses 스키마에 영향
2. Gemini 계약 + 통과 임계치: 프롬프트·기대 응답 스키마(전사/유사도), 정규화 규칙, 임계치(초안 85%) — Gemini 연동 시 필요(슬라이스 stub 단계에선 불필요)
3. `GEMINI_API_KEY` 등 env 추가 + `@google/genai`·`@nestjs/schedule` 의존성 설치
