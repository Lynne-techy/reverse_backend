# 진행 상황 로그 (세션 인수인계용)

> 세션 시작 시 먼저 읽고, 의미 있는 진행이 있으면 마무리 전에 갱신. **간결하게 유지** — 상세 배경은
> git log / `docs/DATABASE.md` / `docs/ARCHITECTURE.md`에 있으니 여기엔 한두 줄 요약만 남긴다.

## 상태
브랜치 `feat/w1-foundation-auth` (2026-07-06 기준)

## 완료 (W1)
기반구조·의존성, Auth/User 모듈(controller/service/repository 구조), DB 모델링 문서,
MVP 7개 테이블 마이그레이션(users/verses/daily_verses/writing_sessions/user_statistics/
user_daily_activity/streak_freeze_events). 커밋 5개로 분리 완료.
ARCHITECTURE.md·README.md도 실제 단순 구조에 맞게 정리 완료.

## 보류
`ocr_jobs`, 별(밤하늘) 시각화 컬럼 — 방식 미확정 (`docs/DATABASE.md` 6장).
진짜 OCR 워커(Python), OCI Object Storage, 전체 성경 임포트 — 수직 슬라이스 이후.

## 다음 목표: 수직 슬라이스 (walking skeleton)
로그인 → 필사 업로드 → 잔디까지 얇게 한 번 관통. 확정된 결정:
- **JWT**: JWKS(비대칭). `auth.service.ts` 기존 구현 그대로 사용.
- **이미지 저장**: Supabase Storage(임시, presigned URL). OCI는 나중에 교체.
- **OCR**: stub — 세션 생성 시 무조건 통과 처리. 진짜 워커 붙일 seam만 남김.
- **mock 유저**: 시드 스크립트에서 `app_metadata.provider='google'` 주입(방법 A).
  이유: 코드의 provider 허용목록은 `google`/`kakao`뿐이라, email/password 유저 토큰은
  `auth.service.ts`에서 401. 프로덕션 코드 안 건드리고 테스트 데이터만 구글 유저처럼 흉내.
- **시딩**: 우선 미니 시드(5~10절)만. 저작권 있는 번역본(GAE/NIV) 사용은 별도 확정 필요.

진행 순서: ① 마이그레이션 적용+부팅 스모크 → ② mock 유저 토큰으로 Auth/JIT 검증
→ ③ 미니 시드 → ④ 업로드~잔디 관통(OCR stub) → ⑤ Dockerfile/.env.example로 팀원 배포 인계.

## 다음 단계 (진행 중)
- [x] Supabase 프로젝트 생성 + login/link → `db push` (7개 테이블 원격 적용, in-sync)
- [x] 앱 부팅 스모크 테스트 (env 검증 통과, /health 200, AuthGuard 401 확인)
- [x] ② mock 유저 시드(`scripts/seed-mock-user.mjs`, provider='google' 주입) → /users/me 200, JIT 프로비저닝으로 users INSERT 확인(DB write 실연결), 변조 토큰 401
- [ ] ③ 미니 시드(5~10절) → ④ 업로드~잔디 관통(OCR stub) → ⑤ Dockerfile/.env.example 배포 인계
- [ ] (이후) emotion_tags, verse_emotion_tags, quests, user_quests

## 최근 세션
- 2026-07-06: 수직 슬라이스 전략·결정 확정(위 참조). Supabase CLI 설치+`supabase init`
  (config.toml 생성). 마이그레이션 SQL 검토 완료(push 정합성 OK). 사용자 login/link 대기 중.
- 2026-07-06: writing_sessions 완성, DB 문서 정리, 커밋 5개, PROGRESS.md/CLAUDE.md 신설,
  ARCHITECTURE.md·README.md 4계층→단순구조로 정리
