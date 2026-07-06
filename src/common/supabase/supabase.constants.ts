/**
 * Supabase 클라이언트 주입 토큰.
 * repository 에서 @Inject(SUPABASE_CLIENT) 로 주입받아 사용한다.
 */
export const SUPABASE_CLIENT = Symbol('SUPABASE_CLIENT');
