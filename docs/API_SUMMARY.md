# API 요약 (팀 공유용)

지금까지 완료된 API 목록입니다. 상세 스펙은 Swagger UI(`/api-docs`)에서 확인할 수 있고,
요청/응답 예시가 필요하면 `docs/CLIENT_TEST_GUIDE.md`(Postman 따라하기용)를 참고하세요.

- **Base URL**: `https://reverse-growthlog.com/api` (프로덕션) / `http://localhost:3000` (로컬)
- **인증**: 별도 로그인 API 없음. Supabase 소셜 로그인으로 받은 토큰을 `Authorization: Bearer <token>`
  헤더에 담아 요청. **구글 로그인 활성화 완료**(실제 로그인 → 백엔드 검증 통과 확인), 카카오는 백엔드
  허용되어 있으나 Supabase 대시보드 provider 설정 대기. 상세는 `docs/CLIENT_AUTH_FLOW.md` 참고. 로컬
  개발 중엔 `POST /dev/token`(개발 환경 전용, 인증 불필요)으로 mock 토큰 발급 가능.

## users — 내 프로필

- [x] `GET /users/me` — 내 프로필 조회
- [x] `GET /users/me/linked-providers` — 계정 연결 상태 (`{ google, kakao }` boolean 맵). `auth.users.identities` 실시간 조회
- [x] `GET /users/me/progress` — 내 진척률 (`{ coveredVerses, totalVerses, completedBooks, progressRate }`). 통과 필사 범위를 정경 절 커버리지로 계산(번역본 무관, 절 주소 dedupe). streak/총필사는 `GET /stats/me` 별도 호출
- [x] `PATCH /users/me` — 내 프로필 수정 (`displayName`, `avatarUrl`, `language` — 모두 선택, 보낸 필드만 갱신)

> 마이페이지는 `GET /users/me`·`/progress`·`/linked-providers`(+ `/stats/me`)를 프론트에서 병렬 호출합니다.
> 하나로 묶는 집계 엔드포인트는 두지 않습니다 — 무거운 조회(identities/진척률)는 각자 분리해 "이름만 필요한" 호출에 비용을 얹지 않기 위함.

## verses — 구절

- [x] `GET /verses/today?date=YYYY-MM-DD` — 오늘의 말씀. 클라이언트 로컬 날짜 기준, 해당 날짜에 배정된 적 없으면 무작위 배정
- [x] `GET /verses?book=&chapter=&from=&to=` — 같은 책·장 안의 절 범위 조회 (key verse 선택용 목록)

## writing-sessions — 필사

- [x] `POST /writing-sessions/upload-url` — 필사 이미지 업로드용 presigned URL + 세션 생성 (`book`, `chapter`, `startVerseNo`, `endVerseNo`, `language`)
- [x] `GET /writing-sessions/:id` — 세션 조회. `status`가 `processing → completed/failed`로 바뀌는 걸 폴링으로 확인
- [x] `POST /writing-sessions/:id/complete` — 기록 저장 (`keyVerseId`, `date`). `date`(YYYY-MM-DD, 클라이언트 로컬 날짜)가 잔디/streak 기준일 — `/verses/today`와 동일 방침. Gemini 유사도 검사가 백그라운드로 시작되고 즉시 응답 반환

## stats — 통계/잔디

- [x] `GET /stats/me` — 현재 streak, 최고 기록, 총 필사 수
- [x] `GET /stats/activity?from=&to=` — 구간 내 날짜별 통과 필사 수 (잔디 데이터)

## books — 책 배경 정보

- [x] `GET /books/:bookNo` — 책(1~66) 요약·저자·기록시기·기록장소·수신대상·핵심주제·유튜브 링크(현재 전부 null)
