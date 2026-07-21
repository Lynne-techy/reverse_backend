# API 요약 (팀 공유용)

지금까지 완료된 API 목록입니다. 상세 스펙은 Swagger UI(`/api-docs`)에서 확인할 수 있고,
요청/응답 예시가 필요하면 `docs/CLIENT_TEST_GUIDE.md`(Postman 따라하기용)를 참고하세요.

- **Base URL**: `https://reverse-growthlog.com/api` (프로덕션) / `http://localhost:3000/api` (로컬)
  — 로컬도 글로벌 프리픽스 `/api`가 붙습니다. `http://localhost:3000/users/me`처럼 프리픽스 없이
  호출하면 404가 납니다.
- **인증**: 별도 로그인 API 없음. Supabase 소셜 로그인으로 받은 토큰을 `Authorization: Bearer <token>`
  헤더에 담아 요청. **구글 로그인 활성화 완료**(실제 로그인 → 백엔드 검증 통과 확인), 카카오는 백엔드
  허용되어 있으나 Supabase 대시보드 provider 설정 대기. 상세는 `docs/CLIENT_AUTH_FLOW.md` 참고.

## 목차

- [users — 내 프로필](#users--내-프로필)
  - [내 프로필 조회](#내-프로필-조회) — `GET /users/me`
  - [계정 연결 상태 조회](#계정-연결-상태-조회) — `GET /users/me/linked-providers`
  - [내 진척률 조회](#내-진척률-조회) — `GET /users/me/progress`
  - [내 프로필 수정](#내-프로필-수정) — `PATCH /users/me`
- [verses — 구절](#verses--구절)
  - [오늘의 말씀 조회](#오늘의-말씀-조회) — `GET /verses/today`
  - [절 범위 조회](#절-범위-조회) — `GET /verses`
  - [감정 기반 구절 추천](#감정-기반-구절-추천) — `GET /verses/recommendations`
- [writing-sessions — 필사](#writing-sessions--필사)
  - [업로드 URL 발급 (세션 생성)](#업로드-url-발급-세션-생성) — `POST /writing-sessions/upload-url`
  - [기록 저장 (완료 요청)](#기록-저장-완료-요청) — `POST /writing-sessions/:id/complete`
  - [필사 세션 조회 (검사 결과 폴링)](#필사-세션-조회-검사-결과-폴링) — `GET /writing-sessions/:id`
  - [최근 필사 기록 목록](#최근-필사-기록-목록) — `GET /writing-sessions`
- [stats — 통계/잔디](#stats--통계잔디)
  - [내 통계 조회 (streak)](#내-통계-조회-streak) — `GET /stats/me`
  - [활동 기록 조회 (잔디)](#활동-기록-조회-잔디) — `GET /stats/activity`
- [books — 책 배경 정보](#books--책-배경-정보)
  - [책 정보 조회](#책-정보-조회) — `GET /books/:bookNo`
- [개발 편의 (프로덕션 미노출)](#개발-편의-프로덕션-미노출)
  - [개발용 토큰 발급](#개발용-토큰-발급) — `POST /dev/token`
  - [손글씨 검사 단독 실행](#손글씨-검사-단독-실행) — `POST /handwriting-check/debug`

## **공통 에러 응답** — 모든 엔드포인트가 실패 시 아래 형태로 응답합니다.

```json
{
  "statusCode": 404,
  "message": "필사 세션을 찾을 수 없습니다.",
  "error": "Not Found",
  "path": "/api/writing-sessions/xxx",
  "timestamp": "2026-07-16T14:00:37.323Z"
}
```

## users — 내 프로필

### 내 프로필 조회

- [x] `GET /users/me`

로그인한 사용자의 프로필을 반환합니다. `displayName`은 최초 가입 시 소셜 프로필 이름으로
자동 시딩되므로, 별도 설정 없이도 처음부터 이름이 채워져 있습니다.

```json
{
  "id": "bb20c3da-7668-45df-a030-9d726d9799cc",
  "email": "user@example.com",
  "provider": "google",
  "displayName": "홍길동",
  "avatarUrl": null,
  "language": "ko",
  "createdAt": "2026-07-06T11:02:46.483481+00:00",
  "updatedAt": "2026-07-16T13:50:49.292+00:00"
}
```

### 계정 연결 상태 조회

- [x] `GET /users/me/linked-providers`

이 계정에 어떤 소셜 로그인이 연결돼 있는지 반환합니다. 캐시가 아니라 Supabase
`auth.users.identities`를 실시간 조회하므로 연결 직후에도 바로 반영됩니다.
마이페이지의 "계정 연동" 화면용.

```json
{
  "google": true,
  "kakao": false
}
```

### 내 진척률 조회

- [x] `GET /users/me/progress`

성경 전체 대비 필사 진척률을 반환합니다. **통과(passed)한** 필사 범위만 집계하며, 같은 절을
여러 번(또는 여러 언어로) 필사해도 절 주소 기준으로 한 번만 셉니다(정경 커버리지).
streak/총 필사 수는 여기 없고 `GET /stats/me`를 따로 호출합니다.

```json
{
  "coveredVerses": 9, // 필사한(통과) 절 수
  "totalVerses": 31088, // 전체 절 수 (개역개정 기준)
  "completedBooks": 0, // 완필한 책 수
  "progressRate": 0.028950077200205867 // 전체 진척률(%) = coveredVerses / totalVerses * 100
}
```

### 내 프로필 수정

- [x] `PATCH /users/me`

프로필을 부분 수정합니다. `displayName`, `avatarUrl`, `language` 모두 선택 필드 —
**보낸 필드만** 갱신됩니다. 응답은 갱신된 프로필 전체(`GET /users/me`와 동일 형태).

```json
// Request
{ "displayName": "새 이름" }
```

> 마이페이지는 `GET /users/me`·`/progress`·`/linked-providers`(+ `/stats/me`)를 프론트에서 병렬 호출합니다.
> 하나로 묶는 집계 엔드포인트는 두지 않습니다 — 무거운 조회(identities/진척률)는 각자 분리해 "이름만 필요한" 호출에 비용을 얹지 않기 위함.

## verses — 구절

### 오늘의 말씀 조회

- [x] `GET /verses/today?date=YYYY-MM-DD`

해당 날짜의 "오늘의 말씀" 한 절을 반환합니다. `date`는 클라이언트 로컬 날짜.
그 날짜에 배정된 적 없으면 무작위로 한 절을 배정한 뒤 고정하므로, 같은 날 다시 호출해도
항상 같은 절이 나옵니다.

```json
{
  "id": 21512,
  "translationCode": "KO_GAEGAEJEONG",
  "bookNo": 26,
  "bookName": "에스겔",
  "chapter": 40,
  "verseNo": 17,
  "text": "그가 나를 데리고 바깥뜰에 들어가니 뜰 삼면에 박석 깔린 땅이 있고 그 박석 깔린 땅 위에 여러 방이 있는데 모두 서른이며",
  "createdAt": "2026-07-13T09:44:02.819705+00:00"
}
```

### 절 범위 조회

- [x] `GET /verses?book=&chapter=&from=&to=`

같은 책·장 안의 절 범위를 목록으로 반환합니다. 필사할 범위의 원문을 보여주거나,
complete 때 보낼 key verse(대표 절)를 고르는 화면에서 사용합니다.

```json
// GET /verses?book=19&chapter=23&from=1&to=2
[
  {
    "id": 14261,
    "translationCode": "KO_GAEGAEJEONG",
    "bookNo": 19,
    "bookName": "시편",
    "chapter": 23,
    "verseNo": 1,
    "text": "여호와는 나의 목자시니 내게 부족함이 없으리로다",
    "createdAt": "2026-07-13T09:44:01.815177+00:00"
  },
  {
    "id": 14262,
    "translationCode": "KO_GAEGAEJEONG",
    "bookNo": 19,
    "bookName": "시편",
    "chapter": 23,
    "verseNo": 2,
    "text": "그가 나를 푸른 풀밭에 누이시며 쉴 만한 물 가로 인도하시는도다",
    "createdAt": "2026-07-13T09:44:01.815177+00:00"
  }
]
```

### 감정 기반 구절 추천

- [x] `GET /verses/recommendations?emotion=depression`

선택한 감정에 큐레이션된 구절들 중 **무작위 최대 6개**를 유저 번역본(현재 개역개정 고정)으로
반환합니다. 감정별 추천 화면용. 후보가 6개보다 적으면 있는 만큼만, 매 호출마다 구성이 바뀝니다.
`emotion`은 아래 8종 중 하나여야 하며(그 외 값은 400), 표시 라벨("우울할 때" 등)은 프론트가
코드로 렌더링합니다.

- `depression`(우울할 때) · `fear`(두려울 때) · `gratitude`(감사할 때) · `love`(사랑할 때)
- `anxiety`(불안할 때) · `joy`(기쁠 때) · `loneliness`(외로울 때) · `weariness`(지칠 때)

```json
// GET /verses/recommendations?emotion=depression — 응답 형태는 절 범위 조회와 동일(최대 6개)
[
  {
    "id": 14290,
    "translationCode": "KO_GAEGAEJEONG",
    "bookNo": 19,
    "bookName": "시편",
    "chapter": 34,
    "verseNo": 18,
    "text": "여호와는 마음이 상한 자를 가까이 하시고 충심으로 통회하는 자를 구원하시는도다",
    "createdAt": "2026-07-13T09:44:01.815177+00:00"
  },
  {
    "id": 23145,
    "translationCode": "KO_GAEGAEJEONG",
    "bookNo": 40,
    "bookName": "마태복음",
    "chapter": 11,
    "verseNo": 28,
    "text": "수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라",
    "createdAt": "2026-07-13T09:44:01.815177+00:00"
  }
]
```

## writing-sessions — 필사

### 업로드 URL 발급 (세션 생성)

- [x] `POST /writing-sessions/upload-url`

필사 이미지를 올릴 presigned URL을 발급하면서 필사 세션을 만듭니다.
필사 단위는 "같은 장 안의 절 범위"이고 이 시점에 확정됩니다. 응답의 `uploadUrl`로
이미지를 PUT 업로드한 뒤 아래 complete를 호출하는 흐름입니다.

```json
// Request
{
    "book": 19,
    "chapter": 23,
    "startVerseNo": 1,
    "endVerseNo": 3,
    "language": "ko"
}

// Response — uploadUrl로 이미지를 PUT 업로드한 뒤 complete를 호출
{
    "sessionId": "2bc15f28-c487-4b81-8a57-4ad3699bdeb2",
    "objectKey": "bb20c3da-.../2bc15f28-....jpg",
    "uploadUrl": "https://xxxx.supabase.co/storage/v1/object/upload/sign/writing-images/...?token=..."
}
```

### 기록 저장 (완료 요청)

- [x] `POST /writing-sessions/:id/complete`

업로드를 마친 세션의 검사를 시작합니다. Gemini 유사도 검사는 백그라운드로 돌고
즉시 `processing` 상태로 응답하므로, 결과는 아래 세션 조회를 폴링해 확인합니다.
**요청 필드는 `date`** (응답의 `clientDate`와 이름이 다름에 주의).
`date`(YYYY-MM-DD, 클라이언트 로컬 날짜)가 잔디/streak 기준일 — `/verses/today`와 동일 방침.
`failed` 세션은 같은 요청으로 재시도 가능.

QT(`meditation` 묵상 / `application` 적용 / `prayer` 기도제목)는 **모두 선택 입력**(각 최대 500자).
공백만 보내면 미작성(null)으로 저장됩니다. 완료 후 별도 수정 API는 없습니다(기획상 완료 후 작성 불가).

```json
// Request
{
    "keyVerseId": 14261,       // 필사 범위 안의 절이어야 함
    "date": "2026-07-15",      // 클라이언트 로컬 날짜
    "meditation": "한/영 나란히 적으니 trust의 무게가 다르게 읽힌다.",  // 선택
    "application": "오늘 결정할 일을 내 명철 대신 기도로 시작한다.",    // 선택
    "prayer": "흔들리는 진로 앞에서 주님을 신뢰하게 하소서."           // 선택
}

// Response — 검사 결과는 아직 없음(폴링으로 확인)
{
    "id": "2bc15f28-c487-4b81-8a57-4ad3699bdeb2",
    "userId": "bb20c3da-7668-45df-a030-9d726d9799cc",
    "bookNo": 19,
    "chapter": 23,
    "startVerseNo": 1,
    "endVerseNo": 3,
    "keyVerseId": 14261,
    "language": "ko",
    "objectKey": "bb20c3da-.../2bc15f28-....jpg",
    "status": "processing",
    "recognizedText": null,
    "similarityScore": null,
    "passed": null,
    "clientDate": "2026-07-15",
    "meditation": "한/영 나란히 적으니 trust의 무게가 다르게 읽힌다.",
    "application": "오늘 결정할 일을 내 명철 대신 기도로 시작한다.",
    "prayer": "흔들리는 진로 앞에서 주님을 신뢰하게 하소서.",
    "createdAt": "2026-07-16T12:53:13.871186+00:00",
    "completedAt": null
}
```

### 필사 세션 조회 (검사 결과 폴링)

- [x] `GET /writing-sessions/:id`

세션 단건을 조회합니다. complete 후 `status`가 `processing → completed/failed`로 바뀌는 걸
폴링으로 확인하는 용도. `completed`여도 `passed: false`(불통과)일 수 있음 — 잔디에는 통과만 반영.

```json
// 검사 완료 후 응답
{
  "id": "2bc15f28-c487-4b81-8a57-4ad3699bdeb2",
  "userId": "bb20c3da-7668-45df-a030-9d726d9799cc",
  "bookNo": 19,
  "chapter": 23,
  "startVerseNo": 1,
  "endVerseNo": 3,
  "keyVerseId": 14261,
  "language": "ko",
  "objectKey": "bb20c3da-.../2bc15f28-....jpg",
  "status": "completed",
  "recognizedText": "여호와는 나의 목자시니 내게 부족함이 없으리로다 ...",
  "similarityScore": 100,
  "passed": true,
  "clientDate": "2026-07-15",
  "meditation": "한/영 나란히 적으니 trust의 무게가 다르게 읽힌다.",
  "application": "오늘 결정할 일을 내 명철 대신 기도로 시작한다.",
  "prayer": "흔들리는 진로 앞에서 주님을 신뢰하게 하소서.",
  "createdAt": "2026-07-16T12:53:13.871186+00:00",
  "completedAt": "2026-07-16T13:42:22.6+00:00"
}
```

### 최근 필사 기록 목록

- [x] `GET /writing-sessions?limit=10&offset=0`

통과(`passed: true`)한 내 필사 기록을 최신순(`clientDate` → 같은 날은 `completedAt`)으로
반환합니다. 홈 "최근 필사 기록"·"필사 타임라인" 화면용. 날짜 그룹핑·"N건" 카운트는 클라이언트 몫.
`limit` 기본 10·최대 50, `offset` 기본 0 — 받은 개수가 `limit`보다 적으면 마지막 페이지입니다.
`meditation`이 `null`이면 "(묵상 미작성)"으로 표시. `keyVerse`는 complete 때 고른 대표 절의 주소.

```json
[
  {
    "id": "f2ffd7b7-ec1c-4879-a74f-17271587aba7",
    "bookNo": 20,
    "chapter": 1,
    "startVerseNo": 1,
    "endVerseNo": 3,
    "language": "ko",
    "clientDate": "2026-07-16",
    "meditation": "한/영 나란히 적으니 trust의 무게가 다르게 읽힌다.",
    "keyVerse": { "chapter": 1, "verseNo": 1 },
    "completedAt": "2026-07-16T13:47:16.404+00:00"
  },
  {
    "id": "435b2fcf-1237-407c-a312-2781fcadfd29",
    "bookNo": 22,
    "chapter": 1,
    "startVerseNo": 1,
    "endVerseNo": 3,
    "language": "ko",
    "clientDate": "2026-07-15",
    "meditation": null,
    "keyVerse": { "chapter": 1, "verseNo": 1 },
    "completedAt": "2026-07-16T13:43:01.042+00:00"
  }
]
```

## stats — 통계/잔디

### 내 통계 조회 (streak)

- [x] `GET /stats/me`

현재 streak, 최고 기록, 총 통과 필사 수를 반환합니다. `streakStart`는 스트릭 시작일에
처음 통과한 필사 정보로, "N일 연속 기록 중! M개월 전 ○○ ×장으로 시작한 흐름" 배너용 —
못 찾으면 null이 옵니다.

```json
// 필사 기록이 있는 경우 (7/15 통과 2회 + 7/16 통과 1회)
{
    "userId": "bb20c3da-7668-45df-a030-9d726d9799cc",
    "currentStreak": 2,          // 연속 일수
    "longestStreak": 2,          // 최장 연속 일수
    "totalCount": 3,             // 총 통과 필사 수
    "lastWrittenDate": "2026-07-16",
    "freezeAvailable": 0,        // 스트릭 보호권(로직 미구현, 항상 0)
    "streakStart": {             // 스트릭 시작일에 처음 통과한 필사
        "date": "2026-07-15",
        "bookNo": 19,
        "bookName": "시편",
        "chapter": 23
    }
}

// 필사 기록이 없는 경우
{
    "userId": "bb20c3da-7668-45df-a030-9d726d9799cc",
    "currentStreak": 0,
    "longestStreak": 0,
    "totalCount": 0,
    "lastWrittenDate": null,
    "freezeAvailable": 0,
    "streakStart": null
}
```

### 활동 기록 조회 (잔디)

- [x] `GET /stats/activity?from=&to=`

구간 내 날짜별 통과 필사 수를 반환합니다 — 잔디 그래프의 원본 데이터.
활동이 있는 날만 행이 존재하므로, "올해 기록일" 카드는 `from=1월1일`로 받아
행 수를 세면 됩니다. 같은 날 여러 번 통과하면 `count`가 올라갑니다(잔디 색 진해짐).

```json
// GET /stats/activity?from=2026-07-01&to=2026-07-16
[
  { "date": "2026-07-15", "count": 2 },
  { "date": "2026-07-16", "count": 1 }
]
```

## books — 책 배경 정보

### 책 정보 조회

- [x] `GET /books/:bookNo`

책(1~66)의 배경 정보를 반환합니다. 필사 시작 전 책 소개 화면용.
유튜브 링크는 현재 전부 null(데이터 미입력). 1~66 밖이면 404.

```json
// GET /books/19
{
  "translationCode": "KO_GAEGAEJEONG",
  "bookNo": 19,
  "bookName": "시편",
  "summary": "다윗을 비롯한 여러 저자가 쓴 150편의 시로 이루어진 모음집. 찬양, 감사, 탄식, 회개, 지혜의 노래를 통해 다양한 삶의 순간에서 하나님을 향한 인간의 신앙 고백을 담고 있다.",
  "author": "다윗 외 여러 저자 (아삽, 고라 자손, 솔로몬, 모세 등)",
  "writtenPeriod": "기원전 15세기~5세기 (오랜 기간에 걸쳐 편찬)",
  "writtenPlace": "이스라엘 각지",
  "audience": "이스라엘 공동체 (예배자)",
  "coreTheme": "찬양과 탄원을 통한 하나님과의 인격적 교제",
  "youtubeUrl": null
}
```

## 개발 편의 (프로덕션 미노출)

### 개발용 토큰 발급

- [x] `POST /dev/token`

mock 사용자의 액세스 토큰을 발급합니다(개발 환경 전용, 인증 불필요).
로컬에서 소셜 로그인 없이 API를 테스트할 때 사용합니다.

```json
{
  "accessToken": "eyJhbGciOi...",
  "tokenType": "Bearer",
  "expiresAt": "2026-07-16T15:07:44.000Z",
  "user": {
    "id": "bb20c3da-7668-45df-a030-9d726d9799cc",
    "email": "mock@reverse.test"
  }
}
```

### 손글씨 검사 단독 실행

- [x] `POST /handwriting-check/debug`

필사 세션 없이 손글씨 검사만 돌려봅니다(디버그용, 개발 환경 전용·인증 불필요).
multipart로 `image` 파일 + `originalText` 텍스트를 받아 Gemini 판독 결과를 바로 반환 —
검사 품질을 확인할 때 사용합니다.

```json
{
  "isPenHandwriting": true,
  "text": "여호와는 나의 목자시니 내게 부족함이 없으리로다",
  "similarityScore": 92,
  "scriptureReference": "시편 23:1",
  "confidence": "high",
  "notes": null
}
```
