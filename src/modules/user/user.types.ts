/**
 * 지원하는 소셜 로그인 provider. Supabase Auth 의 provider 값과 매핑된다.
 */
export const AUTH_PROVIDERS = ['google', 'kakao'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export function isAuthProvider(value: unknown): value is AuthProvider {
  return (
    typeof value === 'string' &&
    (AUTH_PROVIDERS as readonly string[]).includes(value)
  );
}

/**
 * 앱 사용자 프로필. id 는 Supabase auth.users.id 와 동일하다.
 * (평범한 데이터 객체 — 프레임워크/DB와 무관)
 */
export interface User {
  id: string;
  email: string;
  provider: AuthProvider;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
