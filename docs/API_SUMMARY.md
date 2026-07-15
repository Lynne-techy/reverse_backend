# API 요약 (팀 공유용)

지금까지 완료된 API 목록입니다. 상세 스펙은 Swagger UI(`/api-docs`)에서 확인할 수 있고,
요청/응답 예시가 필요하면 `docs/CLIENT_TEST_GUIDE.md`(Postman 따라하기용)를 참고하세요.

- **Base URL**: `https://reverse-growthlog.com/api` (프로덕션) / `http://localhost:3000` (로컬)
- **인증**: 별도 로그인 API 없음. Supabase 구글 로그인으로 받은 토큰을 `Authorization: Bearer <token>`
  헤더에 담아 요청. 로컬 개발 중엔 `POST /dev/token`(개발 환경 전용, 인증 불필요)으로 mock 토큰 발급 가능.

## users — 내 프로필

- [x] `GET /users/me` — 내 프로필 조회
- [x] `GET /users/me/linked-providers` — 계정 연결 상태 (`{ google, kakao }` boolean 맵). `auth.users.identities` 실시간 조회
- [x] `PATCH /users/me` — 내 프로필 수정 (`displayName`, `avatarUrl`, `language` — 모두 선택, 보낸 필드만 갱신)

## verses — 구절

- [x] `GET /verses/today?date=YYYY-MM-DD` — 오늘의 말씀. 클라이언트 로컬 날짜 기준, 해당 날짜에 배정된 적 없으면 무작위 배정
- [x] `GET /verses?book=&chapter=&from=&to=` — 같은 책·장 안의 절 범위 조회 (key verse 선택용 목록)

## writing-sessions — 필사

- [x] `POST /writing-sessions/upload-url` — 필사 이미지 업로드용 presigned URL + 세션 생성 (`book`, `chapter`, `startVerseNo`, `endVerseNo`, `language`)
- [x] `GET /writing-sessions/:id` — 세션 조회. `status`가 `processing → completed/failed`로 바뀌는 걸 폴링으로 확인
- [x] `POST /writing-sessions/:id/complete` — 기록 저장 (`keyVerseId`). Gemini 유사도 검사가 백그라운드로 시작되고 즉시 응답 반환

## stats — 통계/잔디

- [x] `GET /stats/me` — 현재 streak, 최고 기록, 총 필사 수
- [x] `GET /stats/activity?from=&to=` — 구간 내 날짜별 통과 필사 수 (잔디 데이터)

## books — 책 배경 정보

- [x] `GET /books/:bookNo` — 책(1~66) 요약·저자·기록시기·기록장소·수신대상·핵심주제·유튜브 링크(현재 전부 null)

## 진행 중 (아직 미완료)

- [ ] `GET /users/me/profile` — streak/완필권수/진척률을 묶은 프로필 집계 API. 계산 로직(완필/진척률)은 완료, 오케스트레이션+컨트롤러 연결이 남음. (계정 연결은 별도 `GET /users/me/linked-providers`로 분리 완료 — 무거운 admin API 호출을 프로필에서 떼어냄)
