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

  // Gemini (손글씨 검사 / 유사도)
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  // 인프로세스 백그라운드 유사도 검사(ADR 6.11)의 동시 실행 상한.
  // 각 검사는 이미지 버퍼 + base64 사본을 메모리에 들고 Gemini를 호출하므로,
  // 업로드 폭주 시 무제한 병렬을 막아 2GB VM의 메모리를 보호한다. VM을 키우면 상향.
  SIMILARITY_MAX_CONCURRENCY: z.coerce.number().int().positive().default(3),
  // Gemini 추론/출력 튜닝 (토큰·지연 최적화).
  // 2.5-flash는 기본 "사고(thinking)"가 켜져 있어 구조적 추출엔 불필요한
  // 토큰·지연을 유발 → 기본 0으로 끈다. (필요 시 상향)
  GEMINI_THINKING_BUDGET: z.coerce.number().int().min(0).default(0),
  // 결과가 작은 JSON이라 출력 토큰 상한으로 폭주·비용을 막는다.
  GEMINI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(512),
  // Gemini 호출 타임아웃(ms) — 무한 대기로 유사도 검사 워커 슬롯이 묶이는 것을 방지.
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
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
