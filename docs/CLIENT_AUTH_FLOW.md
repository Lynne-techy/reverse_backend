# 클라이언트 로그인·인증 흐름 (실제 서비스 기준)

프론트엔드가 실제 서비스에서 로그인을 어떻게 처리하고, 그 토큰으로 우리 백엔드와
어떻게 통신하는지 정리한 문서입니다.

> 테스트용 임시 토큰(`POST /dev/token`)은 이 흐름을 개발 중에 흉내 낸 것입니다.
> 실제 배포 앱은 아래 흐름을 따릅니다. 테스트 절차는 `CLIENT_TEST_GUIDE.md` 참고.

---

## 핵심 요약

- **로그인은 클라이언트 ↔ Supabase(↔ Google) 사이에서 일어납니다. 우리 백엔드는 관여하지 않습니다.**
- Supabase가 로그인 성공 시 **access_token(JWT)** 을 발급합니다.
- 클라이언트는 그 토큰을 모든 백엔드 요청 헤더에 `Authorization: Bearer <token>` 으로 넣습니다.
- 우리 백엔드는 토큰 **서명만 검증**하고, 그 유저의 프로필 행을 **첫 요청 때 자동 생성(JIT)** 합니다.
- 우리 백엔드엔 **로그인/회원가입 API가 없습니다.**

---

## 전체 흐름

```
[클라이언트 앱]
   │  ① supabase.auth.signInWithOAuth({ provider: 'google' })
   ▼
[Supabase Auth] ──② 구글 로그인 페이지로 리다이렉트──▶ [Google]
   │                                                     │
   │  ◀───③ 사용자 동의, 구글이 신원 확인─────────────────┘
   ▼
[Supabase] ──④ auth.users 생성/갱신 + 세션 발급──▶ [클라이언트 앱]
   │                            (access_token + refresh_token)
   │
   │  ⑤ 우리 API 호출: Authorization: Bearer <access_token>
   ▼
[우리 백엔드]
     ⑥ 토큰 서명 검증(JWKS 공개키)
     ⑦ 첫 요청이면 public.users 행 자동 생성(JIT 프로비저닝)
     ⑧ 응답
```

---

## 클라이언트 구현 (예시)

클라이언트도 Supabase JS SDK(`@supabase/supabase-js`)를 사용합니다.
단, **anon(공개) 키**를 씁니다 — 백엔드의 service_role 키와 다릅니다(아래 "키 구분" 참고).

```js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY); // 공개 키 (앱에 넣어도 안전)

// 1) 로그인 버튼 클릭 시 — 구글 OAuth 시작
async function login() {
  await supabase.auth.signInWithOAuth({ provider: 'google' });
  // 구글 로그인 페이지로 이동 → 동의 → 앱으로 리다이렉트되어 돌아옴
}

// 2) 돌아온 뒤 현재 세션(토큰) 획득
const { data: { session } } = await supabase.auth.getSession();
const accessToken = session?.access_token;

// 3) 우리 백엔드 호출 시 헤더에 토큰 첨부
async function getMyProfile() {
  const res = await fetch('http://localhost:3000/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.json();
}
```

---

## 우리 백엔드 쪽에서 일어나는 일

클라이언트가 토큰을 첨부해 아무 API나 처음 호출하면:

1. **AuthGuard**(모든 비공개 라우트에 자동 적용)가 `Authorization` 헤더에서 토큰을 꺼냅니다.
2. **서명 검증**: Supabase의 JWKS 공개키로 토큰이 진짜 Supabase가 서명한 것인지 확인합니다.
   (Supabase에 매번 물어보지 않습니다 — 토큰이 self-contained라 공개키만으로 검증됩니다.)
3. **JIT 프로비저닝**: 그 유저가 우리 `public.users` 에 아직 없으면 즉석에서 행을 생성합니다.
   그래서 **회원가입 API가 없어도** 첫 요청에서 유저 프로필이 만들어집니다.

> ⚠️ 우리 `public.users` 행은 **Supabase 로그인 시점이 아니라, 로그인 후 첫 백엔드 요청 시점**에
> 생성됩니다. 로그인만 하고 API를 한 번도 호출하지 않으면 우리 DB엔 아직 유저가 없습니다.

### 두 개의 users 테이블

| 테이블 | 관리 주체 | 담는 것 |
|---|---|---|
| `auth.users` | Supabase | 인증 정보(로그인 수단, 세션 등) — ④에서 생성 |
| `public.users` | 우리 백엔드 | 도메인 프로필(닉네임·아바타 등) — ⑦(JIT)에서 생성 |

둘은 같은 `id`(= JWT의 `sub`)로 연결됩니다.

---

## 토큰 만료와 갱신

- access_token 은 발급 후 **약 1시간** 뒤 만료됩니다.
- 실제 클라이언트 SDK는 함께 받은 **refresh_token** 으로 만료 전 **자동 갱신**합니다
  (`autoRefreshToken`). 사용자가 매시간 재로그인할 필요는 없습니다.
- 갱신된 토큰도 같은 Supabase 키로 서명되므로, 우리 백엔드는 **아무 변경 없이** 그대로 검증·통과시킵니다.
  (백엔드는 토큰 갱신 과정에 관여하지 않습니다.)

---

## 키 구분 (중요)

| 키 | 사용처 | 권한 |
|---|---|---|
| **anon** (공개) | 클라이언트 앱 | 로그인 등 공개 동작. 남의 데이터 접근 불가(RLS 적용) |
| **service_role** (비밀) | 백엔드 서버만 | RLS 우회, 모든 유저 조작 가능. **절대 클라이언트 노출 금지** |

클라이언트는 anon 키만 사용합니다. service_role 키는 백엔드 전용입니다.
