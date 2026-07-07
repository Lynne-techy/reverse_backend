import { z } from 'zod';

/**
 * 애플리케이션 환경변수 스키마.
 * ConfigModule 로딩 시점에 검증하여, 잘못된 설정으로 부팅되는 것을 방지한다.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Supabase
  SUPABASE_URL: z.url(),
  // service-role 키: 신뢰 서버(백엔드)에서만 사용. 절대 클라이언트에 노출 금지.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // JWKS 검증에 사용할 Supabase Auth 발급자(issuer) 및 JWKS 엔드포인트.
  // 보통 `${SUPABASE_URL}/auth/v1`.
  SUPABASE_JWT_ISSUER: z.url(),
  // 필사 이미지를 저장하는 Storage 버킷 이름 (Private, presigned URL로만 접근).
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/**
 * @nestjs/config 의 validate 훅.
 * 검증 실패 시 상세 메시지와 함께 예외를 던져 부팅을 중단한다.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`환경변수 검증에 실패했습니다:\n${issues}`);
  }
  return parsed.data;
}
