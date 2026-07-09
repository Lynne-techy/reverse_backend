# Postman 수동 테스트 가이드 (임시)

로그인 → 성경 구절 선택 → 필사 세션 생성 → 완료까지 Postman으로 손수 쏴보는 순서입니다.
수직 슬라이스 검증용 임시 문서라, 흐름이 안정되면 지워도 됩니다.

- **Base URL**: `http://localhost:3000` (로컬 dev 서버가 떠 있어야 함)
- **Swagger로도 가능**: 이 문서 대신 브라우저에서 `http://localhost:3000/api-docs`를 열면
  같은 API를 UI로 쏠 수 있습니다(우측 상단 **Authorize**에 토큰만 넣으면 됨).

> ⚠️ 이 백엔드엔 "로그인 엔드포인트"가 없습니다. Supabase가 발급한 JWT 자체가 자격증명이고,
> 인증된 첫 요청이 JIT(Just-In-Time)로 `public.users` 행을 만듭니다.
> 그래서 아래 **0단계(토큰 발급)는 터미널**에서 하고, 1단계부터 Postman으로 진행합니다.

---

## Postman 준비 (컬렉션 변수 2개)

컬렉션 또는 Environment에 변수 2개를 만들어두면 편합니다.

| 변수 | 값 |
|---|---|
| `base_url` | `http://localhost:3000` |
| `token` | (0단계에서 받은 access_token 붙여넣기) |

이후 요청에서 URL은 `{{base_url}}/...`, 인증은 각 요청 **Authorization 탭 → Type: Bearer Token → Token: `{{token}}`** 으로 지정합니다.
(매 요청 헤더에 직접 `Authorization: Bearer {{token}}`를 넣어도 동일합니다.)

---

## 0단계 — 토큰 발급 (터미널)

프로젝트 루트에서:

```bash
node --env-file=.env scripts/seed-mock-user.mjs
```

출력 맨 아래 `--- ACCESS TOKEN ---` 밑의 긴 문자열(`ey...`로 시작)이 access_token입니다.
이 값을 복사해 Postman의 `token` 변수에 붙여넣습니다.

> 토큰이 잘리거나 줄바꿈이 섞이면 서명 검증에 실패해 401이 납니다. 한 줄 전체를 정확히 복사하세요.

---

## 1단계 — 로그인 확인 (JIT 프로비저닝)

토큰이 유효한지, 그리고 내 유저 행이 생성되는지 확인합니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `{{base_url}}/users/me` |
| Auth | Bearer Token = `{{token}}` |

**기대 응답 (200)** — 대략 이런 형태:
```json
{ "id": "…uuid…", "email": "mock@reverse.test", "nickname": null, ... }
```
토큰이 잘못됐다면 `401 Unauthorized`가 납니다. 여기서 200이 나오면 "로그인 성공"입니다.

---

## 2단계 — 필사 세션 생성 (범위·언어 선택 + 업로드 URL 발급)

필사 단위는 **같은 장 안의 절 범위**입니다(예: 시편 23:1-6). 이 시점엔 범위와 언어만
정하고, **key verse는 아직 안 고릅니다**(업로드 후 4단계에서 선택).

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `{{base_url}}/writing-sessions/upload-url` |
| Auth | Bearer Token = `{{token}}` |
| Headers | `Content-Type: application/json` |
| Body | raw → JSON (아래) |

```json
{ "book": 19, "chapter": 23, "startVerseNo": 1, "endVerseNo": 6, "language": "ko" }
```

> - `book`/`chapter`: 필사 범위의 책 번호·장.
> - `startVerseNo`/`endVerseNo`: 절 범위(같은 장). `start <= end` 아니면 `400`.
> - `language`: `"ko"` 또는 `"en"`. (누락/오값 `400`)

**기대 응답 (201)**:
```json
{
  "sessionId": "…uuid…",
  "objectKey": "…userId/…sessionId.jpg",
  "uploadUrl": "https://…supabase…/object/upload/sign/…"
}
```

> 응답의 `sessionId`를 복사해 두세요(4단계에서 사용). Postman **Tests 탭**에 아래를 넣으면
> 자동으로 `session_id` 변수에 저장돼 편합니다:
> ```js
> pm.collectionVariables.set("session_id", pm.response.json().sessionId);
> ```

---

## 3단계 — (선택) 실제 이미지 업로드

기록 저장(4단계)은 현재 **유사도 검사 스텁**이라 실제 업로드 없이도 통과합니다.
그래도 진짜 필사 이미지를 올려보고 싶다면, 위 `uploadUrl`로 파일을 올립니다:

| 항목 | 값 |
|---|---|
| Method | `PUT` |
| URL | `uploadUrl` 값 전체 (토큰이 쿼리에 포함돼 있음) |
| Body | binary → 이미지 파일 선택 |
| Headers | `Content-Type: image/jpeg` |

이 단계는 스텁 완료엔 필수가 아니므로 건너뛰어도 됩니다.

---

## 4단계 — 범위 절 조회 → key verse 골라 기록 저장

**4-1. 범위 절 목록 조회** — 클라이언트가 이 목록을 보여주고 사용자가 대표 절을 고릅니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `{{base_url}}/verses?book=19&chapter=23&from=1&to=6` |
| Auth | Bearer Token = `{{token}}` |

**기대 응답 (200)**:
```json
[
  { "id": 2, "verseNo": 1, "text": "…" },
  { "id": 7, "verseNo": 2, "text": "…" },
  … { "verseNo": 6 }
]
```
이 중 대표로 고른 절(예: `verseNo` 4)의 `id`를 아래 `keyVerseId`로 씁니다.
(id 값은 시드 상태에 따라 다르니 위 응답에서 실제 값을 확인하세요.)

**4-2. 기록 저장(완료 처리)**

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `{{base_url}}/writing-sessions/{{session_id}}/complete` |
| Auth | Bearer Token = `{{token}}` |
| Headers | `Content-Type: application/json` |
| Body | raw → JSON (아래) |

```json
{ "keyVerseId": 9 }
```

> `keyVerseId`는 세션의 범위(같은 책·장 + 1~6절) **안**의 절이어야 합니다.
> 범위 밖 절이면 `400`, 없는 id면 `404`가 납니다.

**기대 응답 (201)**:
```json
{
  "id": "…sessionId…",
  "status": "completed",
  "keyVerseId": 9,
  "recognizedText": "(stub) Gemini 연동 전 임시 통과 처리",
  "similarityScore": 100,
  "passed": true,
  "completedAt": "…"
}
```

이 시점에 잔디/streak도 함께 갱신됩니다(통과한 필사만 반영).

---

## 5단계 — (확인용) 통계·잔디 조회

필사가 통계에 반영됐는지 확인합니다.

**내 통계**
| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `{{base_url}}/stats/me` |

→ `currentStreak`, `longestStreak`, `totalCount`, `lastWrittenDate` 확인.

**잔디(일자별 활동)**
| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `{{base_url}}/stats/activity?from=2026-07-01&to=2026-07-31` |

→ `[{ "date": "YYYY-MM-DD", "count": N }, ...]` 형태로 그날 통과한 필사 수를 반환.

---

## 에러 케이스 (원하면 같이 확인)

| 시도 | 기대 결과 |
|---|---|
| 4-2를 **같은 sessionId로 두 번** 호출 | `409 Conflict` (이미 완료된 세션) |
| 존재하지 않는 sessionId로 완료 호출 | `404 Not Found` |
| 2단계에서 `startVerseNo > endVerseNo`(범위 뒤집힘) | `400 Bad Request` |
| 4-2에서 범위 밖 절을 `keyVerseId`로 전달 | `400 Bad Request` |
| Authorization 헤더 없이 아무 요청 | `401 Unauthorized` |
