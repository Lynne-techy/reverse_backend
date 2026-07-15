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

/** 프로필 언어 설정(한국어/영어). writing_sessions.language 와 달리 유저의 기본 선호값이다. */
export const LANGUAGES = ['ko', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * 계정 연결 상태. provider별 연결 여부 boolean 맵.
 * 예: { google: true, kakao: false } — 구글은 연결됨, 카카오는 미연결.
 */
export type LinkedProviders = Record<AuthProvider, boolean>;

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
  language: Language;
  createdAt: string;
  updatedAt: string;
}
