// 개발용: mock 유저를 만들고 진짜 Supabase access_token을 발급받는다.
// 프론트 없이 로그인 흐름(AuthGuard → JIT 프로비저닝)을 테스트하기 위한 도구.
//
// 실행: node --env-file=.env scripts/seed-mock-user.mjs
//
// 동작:
//   1. admin API로 mock 유저 생성(이미 있으면 재사용).
//   2. app_metadata.provider='google' 강제 주입 (방법 A — 프로덕션 코드는 google/kakao만 허용).
//   3. password grant로 로그인해 access_token 수령.
//   4. 토큰의 주요 클레임을 출력(= auth.service.ts가 검증하는 값들).
//
// 이 스크립트는 개발 편의용이라 service_role 키를 쓴다. 절대 프로덕션/클라이언트로 반출 금지.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. --env-file=.env 로 실행하세요.');
  process.exit(1);
}

// 고정 mock 계정 (재실행해도 같은 유저 재사용).
const MOCK_EMAIL = 'mock@reverse.test';
const MOCK_PASSWORD = 'mock-password-1234';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** mock 유저를 보장(생성 or 조회)하고 id를 반환. */
async function ensureMockUser() {
  const created = await supabase.auth.admin.createUser({
    email: MOCK_EMAIL,
    password: MOCK_PASSWORD,
    email_confirm: true, // 확인 메일 없이 바로 로그인 가능하게
    app_metadata: { provider: 'google', providers: ['google'] },
  });

  if (!created.error) {
    return created.data.user.id;
  }

  // 이미 등록된 이메일이면 목록에서 찾아 재사용.
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const existing = data.users.find((u) => u.email === MOCK_EMAIL);
  if (!existing) throw created.error; // 다른 원인의 에러
  return existing.id;
}

async function main() {
  const userId = await ensureMockUser();

  // 방법 A: 로그인 직전에 provider=google 을 다시 못박는다.
  // (비밀번호 유저는 기본 provider='email' 이라, 강제하지 않으면 AuthGuard가 401.)
  await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { provider: 'google', providers: ['google'] },
  });

  const { data, error } = await supabase.auth.signInWithPassword({
    email: MOCK_EMAIL,
    password: MOCK_PASSWORD,
  });
  if (error) throw error;

  const accessToken = data.session.access_token;

  // JWT payload(가운데 세그먼트)를 디코드해 주요 클레임을 확인한다.
  // payload 는 암호화가 아니라 base64url 인코딩일 뿐이라 비밀키 없이 읽을 수 있다
  // (신뢰는 서명에서 나온다 — auth.service.ts 가 JWKS 로 서명을 검증한다).
  const claims = JSON.parse(
    Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf-8'),
  );
  console.log('--- 토큰 클레임 ---');
  console.log({
    sub: claims.sub,
    email: claims.email,
    provider: claims.app_metadata?.provider,
    aud: claims.aud,
    iss: claims.iss,
    exp: new Date(claims.exp * 1000).toISOString(),
  });

  console.log('\n--- ACCESS TOKEN (아래 값을 Bearer 로 사용) ---');
  console.log(accessToken);
  console.log('\n테스트:');
  console.log(`  curl -s http://localhost:3000/users/me -H "Authorization: Bearer ${accessToken}"`);
}

main().catch((err) => {
  console.error('시드 실패:', err.message ?? err);
  process.exit(1);
});
