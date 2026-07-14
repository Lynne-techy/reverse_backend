import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.constants';
import { AuthProvider, isAuthProvider, Language, User } from './user.types';

/** public.users 테이블의 행(snake_case). */
interface UserRow {
  id: string;
  email: string;
  provider: string;
  display_name: string | null;
  avatar_url: string | null;
  language: Language;
  created_at: string;
  updated_at: string;
}

/** DB 행(snake_case) → 앱 객체(camelCase) 변환. */
function toUser(row: UserRow): User {
  if (!isAuthProvider(row.provider)) {
    throw new Error(`알 수 없는 provider 값입니다: ${row.provider}`);
  }
  return {
    id: row.id,
    email: row.email,
    provider: row.provider,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    language: row.language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * User 데이터 접근 계층. Supabase 쿼리만 담당하고 비즈니스 로직은 두지 않는다.
 */
@Injectable()
export class UserRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle<UserRow>();

    if (error) {
      throw new Error(`사용자 조회 실패: ${error.message}`);
    }
    return data ? toUser(data) : null;
  }

  /**
   * 로그인한 사용자 정보로 프로필을 생성하거나, 이미 있으면 갱신(멱등 upsert).
   */
  async upsertFromAuth(input: {
    id: string;
    email: string;
    provider: AuthProvider;
  }): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .upsert(
        {
          id: input.id,
          email: input.email,
          provider: input.provider,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single<UserRow>();

    if (error || !data) {
      throw new Error(
        `사용자 프로비저닝 실패: ${error?.message ?? '데이터 없음'}`,
      );
    }
    return toUser(data);
  }

  async updateProfile(
    id: string,
    changes: {
      displayName?: string | null;
      avatarUrl?: string | null;
      language?: Language;
    },
  ): Promise<User> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (changes.displayName !== undefined) {
      patch.display_name = changes.displayName;
    }
    if (changes.avatarUrl !== undefined) {
      patch.avatar_url = changes.avatarUrl;
    }
    if (changes.language !== undefined) {
      patch.language = changes.language;
    }

    const { data, error } = await this.supabase
      .from('users')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single<UserRow>();

    if (error || !data) {
      throw new Error(`프로필 수정 실패: ${error?.message ?? '데이터 없음'}`);
    }
    return toUser(data);
  }
}
