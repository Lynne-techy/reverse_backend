import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../common/supabase/supabase.constants';
import { Public } from '../modules/auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  @Public()
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * DB까지 실제로 찌르는 헬스체크. Supabase 무료 플랜은 "DB 활동" 기준으로
   * 7일 비활성 정지를 판정하므로, 프로세스 생존만 보는 GET /health 로는
   * 정지를 못 막는다. 크론은 이 경로를 호출할 것 (deploy/README.md §7).
   */
  @Public()
  @Get('db')
  async checkDb(): Promise<{ status: string; timestamp: string }> {
    const { error } = await this.supabase.from('verses').select('id').limit(1);
    if (error) {
      throw new ServiceUnavailableException(`DB 응답 없음: ${error.message}`);
    }
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
