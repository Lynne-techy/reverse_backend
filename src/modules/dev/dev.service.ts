import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.constants';
import type { Env } from '../../config/env.validation';

/** 고정 mock 계정 — scripts/seed-mock-user.mjs 와 동일 유저를 재사용한다. */
const MOCK_EMAIL = 'mock@reverse.test';
const MOCK_PASSWORD = 'mock-password-1234';

export interface MockTokenResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: { id: string; email: string };
}

/**
 * 개발 편의용 토큰 발급 서비스.
 * scripts/seed-mock-user.mjs 를 HTTP 엔드포인트로 옮긴 것 — 프론트/클라이언트가
 * 터미널 없이 mock access_token 을 받아 인증 흐름을 테스트할 수 있게 한다.
 *
 * ⚠️ 인증 없이 유효한 세션 토큰을 발급하므로, 반드시 개발 환경에서만 동작해야 한다.
 */
@Injectable()
export class DevService {
  private readonly logger = new Logger(DevService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** mock 유저의 access_token 을 발급한다. 프로덕션에서는 차단된다. */
  async issueMockToken(): Promise<MockTokenResult> {
    this.assertDevOnly();

    const userId = await this.ensureMockUser();

    // 방법 A: 로그인 직전에 provider=google 을 못박는다.
    // (비밀번호 유저 기본 provider='email' 이라, 강제하지 않으면 AuthGuard가 401.)
    await this.supabase.auth.admin.updateUserById(userId, {
      app_metadata: { provider: 'google', providers: ['google'] },
    });

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: MOCK_EMAIL,
      password: MOCK_PASSWORD,
    });
    if (error || !data.session) {
      throw new Error(`mock 로그인 실패: ${error?.message ?? '세션 없음'}`);
    }

    const { access_token: accessToken, expires_at: expiresAt } = data.session;
    this.logger.log(`mock 토큰 발급: userId=${userId}`);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresAt: new Date((expiresAt ?? 0) * 1000).toISOString(),
      user: { id: userId, email: MOCK_EMAIL },
    };
  }

  /** mock 유저를 보장(생성 or 조회)하고 id를 반환. */
  private async ensureMockUser(): Promise<string> {
    const created = await this.supabase.auth.admin.createUser({
      email: MOCK_EMAIL,
      password: MOCK_PASSWORD,
      email_confirm: true,
      app_metadata: { provider: 'google', providers: ['google'] },
    });
    if (!created.error) {
      return created.data.user.id;
    }

    // 이미 등록된 이메일이면 목록에서 찾아 재사용.
    const { data, error } = await this.supabase.auth.admin.listUsers();
    if (error) throw error;
    const existing = data.users.find((u) => u.email === MOCK_EMAIL);
    if (!existing) throw created.error;
    return existing.id;
  }

  /**
   * 이 엔드포인트가 개발 환경에서만 동작하도록 강제한다.
   * 프로덕션(NODE_ENV === 'production')이면 라우트가 없는 것처럼 막아야 한다.
   */
  private assertDevOnly(): void {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    if (nodeEnv !== 'development') {
      throw new NotFoundException();
    }
  }
}
