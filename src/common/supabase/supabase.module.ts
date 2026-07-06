import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { Env } from '../../config/env.validation';
import { SUPABASE_CLIENT } from './supabase.constants';

/**
 * service-role Supabase 클라이언트를 앱 전역에 단일 인스턴스로 제공한다.
 * @Global 이므로 어느 모듈에서든 @Inject(SUPABASE_CLIENT) 로 주입할 수 있다.
 *
 * - service-role 키는 RLS를 우회하므로 신뢰 서버(백엔드)에서만 사용한다.
 * - 서버 환경에선 세션 저장/자동 갱신이 불필요하므로 끈다.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        return createClient(
          config.get('SUPABASE_URL', { infer: true }),
          config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }),
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
      },
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
