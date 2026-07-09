# 클라이언트 개발자용 API 테스트 가이드

프론트 붙이기 전에 백엔드 API를 **직접 쏴보며** 흐름을 익히는 문서입니다.
"로그인 → 구절 선택 → 필사 세션 생성 → 완료 → 통계 확인"까지 순서대로 따라 하면 됩니다.

- **Base URL**: `http://localhost:3000` (백엔드 dev 서버가 떠 있어야 함)
- **더 쉬운 방법(추천)**: 브라우저에서 **`http://localhost:3000/api-docs`** (Swagger UI)를 열면
  아래 API를 클릭만으로 쏠 수 있습니다. 우측 상단 **Authorize** 버튼에 토큰만 넣으면 인증도 자동 적용됩니다.

> ℹ️ **로그인 API가 따로 없습니다.** 실제 서비스에서는 앱이 Supabase로 구글 로그인을 하고
> 토큰을 받지만, 프론트가 아직 없으니 **개발용 토큰 발급 API**(`POST /dev/token`)로 대신합니다.
> 이 API는 개발 환경에서만 동작하며, 배포 환경에서는 막혀 있습니다.

---

## 준비 — 토큰 변수 하나만 기억

모든 요청은 헤더에 `Authorization: Bearer <토큰>` 을 넣어야 합니다(단, 0단계 제외).
Postman을 쓴다면 컬렉션 변수 2개를 만들어두면 편합니다.

| 변수 | 값 |
|---|---|
| `base_url` | `http://localhost:3000` |
| `token` | (0단계 응답의 `accessToken` 붙여넣기) |

---

## 0단계 — 토큰 받기 ⭐

가장 먼저 이 API를 한 번 호출해서 토큰을 받습니다. **인증이 필요 없는 유일한 요청입니다.**

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `{{base_url}}/dev/token` |
| Auth | 없음 |

**응답 (201)**:
```json
{
  "accessToken": "eyJhbGc...(긴 문자열)",
  "tokenType": "Bearer",
  "expiresAt": "2026-07-09T06:47:46.000Z",
  "user": { "id": "…uuid…", "email": "mock@reverse.test" }
}
```

- `accessToken` 값을 복사해 이후 모든 요청의 `Authorization: Bearer <여기>` 에 사용합니다.
- **`expiresAt` 시각이 지나면 만료**됩니다(약 1시간). 요청이 갑자기 `401` 이 나면 이 0단계를
  다시 호출해 새 토큰을 받으세요.

> 💡 Postman **Tests 탭**에 아래를 넣으면 응답 토큰이 `token` 변수에 자동 저장됩니다:
> ```js
> pm.collectionVariables.set("token", pm.response.json().accessToken);
> ```

---

## 1단계 — 내 정보 확인 (로그인 성공 확인)

토큰이 유효한지 확인합니다. 여기서 200이 나오면 "로그인된 상태"입니다.

| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `{{base_url}}/users/me` |
| Auth | Bearer Token = `{{token}}` |

**응답 (200)**:
```json
{ "id": "…uuid…", "email": "mock@reverse.test", "displayName": null, ... }
```
`401` 이 나오면 토큰이 없거나 만료된 것 — 0단계를 다시 하세요.

---

## 2단계 — 필사할 구절 고르기

필사할 성경 구절을 고릅니다. 각 구절은 고유한 `verseId` 숫자를 가집니다.
현재 테스트용으로 시드된 구절(6건):

| verseId | 구절 |
|---|---|
| 1 | 창세기 1:1 |
| 2 | 시편 23:1 |
| 3 | 시편 119:105 |
| 4 | 요한복음 3:16 |
| 5 | 로마서 8:28 |
| 6 | 빌립보서 4:13 |

> 실제 서비스에서는 성경 전체가 들어가고, 사용자가 UI에서 성경·장·절을 고르면
> 그 선택이 하나의 `verseId` 로 정해집니다. 지금은 목록 조회 API가 없어 위 표에서 고릅니다.

아래 예시는 **1번(창세기 1:1)** 기준입니다.

---

## 3단계 — 필사 세션 생성 + 업로드 URL 받기

"이 구절을 필사하겠다"고 세션을 만들고, 이미지를 올릴 **업로드용 URL**을 받습니다.

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `{{base_url}}/writing-sessions/upload-url` |
| Auth | Bearer Token = `{{token}}` |
| Headers | `Content-Type: application/json` |
| Body | raw → JSON (아래) |

```json
{ "verseId": 1 }
```

**응답 (201)**:
```json
{
  "sessionId": "…uuid…",
  "objectKey": "…userId/…sessionId.jpg",
  "uploadUrl": "https://…supabase…/object/upload/sign/…"
}
```

- `sessionId` → 4단계에서 사용 (복사해 두기)
- `uploadUrl` → 이미지를 올릴 주소 (아래 3-1단계)
- `objectKey` → 파일이 저장될 경로 (참고용, 업로드엔 불필요)

> 💡 Postman **Tests 탭**: `pm.collectionVariables.set("session_id", pm.response.json().sessionId);`

### 3-1단계 — 실제 이미지 업로드 (선택)

받은 `uploadUrl` 로 필사 이미지를 **직접** 올립니다(백엔드를 거치지 않고 Storage로 직행).

| 항목 | 값 |
|---|---|
| Method | `PUT` |
| URL | `uploadUrl` 값 전체 |
| Headers | `Content-Type: image/jpeg` |
| Body | binary → 이미지 파일 선택 |

> 현재 유사도 검사가 **스텁**(항상 통과)이라, 이 업로드를 건너뛰어도 4단계는 성공합니다.
> 실제 흐름을 그대로 밟아보고 싶을 때만 하면 됩니다.

---

## 4단계 — 필사 완료 처리

이미지 업로드를 마쳤다고 서버에 알려 세션을 마무리합니다.
(이미지는 클라이언트가 Storage로 직접 올리므로, 서버는 이 요청으로 "끝났음"을 알게 됩니다.)

| 항목 | 값 |
|---|---|
| Method | `POST` |
| URL | `{{base_url}}/writing-sessions/{{session_id}}/complete` |
| Auth | Bearer Token = `{{token}}` |

> `{{session_id}}` 대신 3단계에서 받은 `sessionId` 를 직접 넣어도 됩니다.

**응답 (201)**:
```json
{
  "id": "…sessionId…",
  "status": "completed",
  "recognizedText": "(stub) Gemini 연동 전 임시 통과 처리",
  "similarityScore": 100,
  "passed": true,
  "completedAt": "…"
}
```
이 순간 잔디/연속기록(streak)도 함께 갱신됩니다.

---

## 5단계 — 통계·잔디 확인

**내 통계**
| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `{{base_url}}/stats/me` |

→ `currentStreak`(현재 연속), `longestStreak`(최장 연속), `totalCount`(총 필사 수), `lastWrittenDate`

**잔디(일자별 활동)**
| 항목 | 값 |
|---|---|
| Method | `GET` |
| URL | `{{base_url}}/stats/activity?from=2026-07-01&to=2026-07-31` |

→ `[{ "date": "YYYY-MM-DD", "count": N }, ...]` — 그날 통과한 필사 수

---

## 자주 만나는 응답 코드

| 상황 | 코드 |
|---|---|
| 정상 조회 | `200` |
| 정상 생성/완료 | `201` |
| 토큰 없음/만료 → 0단계 다시 | `401` |
| 잘못된 입력(예: `verseId` 가 문자열/음수) | `400` |
| 없는 세션 완료 시도 | `404` |
| 이미 완료된 세션 다시 완료 | `409` |
