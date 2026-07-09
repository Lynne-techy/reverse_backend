import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.constants';
import { DailyActivity, UserStatistics } from './stats.types';

/** public.user_statistics 테이블의 행(snake_case). */
interface UserStatisticsRow {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  total_count: number;
  last_written_date: string | null;
  freeze_available: number;
  updated_at: string;
}

/** public.user_daily_activity 테이블의 행(snake_case). */
interface DailyActivityRow {
  activity_date: string;
  count: number;
}

function toUserStatistics(row: UserStatisticsRow): UserStatistics {
  return {
    userId: row.user_id,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    totalCount: row.total_count,
    lastWrittenDate: row.last_written_date,
    freezeAvailable: row.freeze_available,
  };
}

/**
 * 통계(streak 요약)와 잔디(일자별 활동) 데이터 접근 계층.
 * user_statistics는 트리거로 자동 생성되지 않으므로 첫 필사 때 upsert로 만든다.
 */
@Injectable()
export class StatsRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /** 사용자의 통계 1행 조회(없으면 null). */
  async findStatistics(userId: string): Promise<UserStatistics | null> {
    const { data, error } = await this.supabase
      .from('user_statistics')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle<UserStatisticsRow>();

    if (error) {
      throw new Error(`통계 조회 실패: ${error.message}`);
    }
    return data ? toUserStatistics(data) : null;
  }

  /** 계산된 streak/카운트 상태를 저장한다(첫 필사면 새로 생성). */
  async saveStatistics(
    userId: string,
    stats: {
      currentStreak: number;
      longestStreak: number;
      totalCount: number;
      lastWrittenDate: string;
    },
  ): Promise<UserStatistics> {
    const { data, error } = await this.supabase
      .from('user_statistics')
      .upsert(
        {
          user_id: userId,
          current_streak: stats.currentStreak,
          longest_streak: stats.longestStreak,
          total_count: stats.totalCount,
          last_written_date: stats.lastWrittenDate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single<UserStatisticsRow>();

    if (error || !data) {
      throw new Error(`통계 저장 실패: ${error?.message ?? '데이터 없음'}`);
    }
    return toUserStatistics(data);
  }

  /**
   * 해당 날짜의 잔디 칸 count를 1 증가시킨다(없으면 1로 생성).
   * MVP 단계라 read-modify-write로 처리한다(단일 사용자 저부하 전제).
   */
  async incrementDailyActivity(userId: string, date: string): Promise<void> {
    const { data, error: readError } = await this.supabase
      .from('user_daily_activity')
      .select('count')
      .eq('user_id', userId)
      .eq('activity_date', date)
      .maybeSingle<{ count: number }>();

    if (readError) {
      throw new Error(`잔디 조회 실패: ${readError.message}`);
    }

    const nextCount = (data?.count ?? 0) + 1;
    const { error: writeError } = await this.supabase
      .from('user_daily_activity')
      .upsert(
        { user_id: userId, activity_date: date, count: nextCount },
        { onConflict: 'user_id,activity_date' },
      );

    if (writeError) {
      throw new Error(`잔디 갱신 실패: ${writeError.message}`);
    }
  }

  /** [from, to] 구간의 일자별 활동을 조회한다(잔디 렌더링용). */
  async findActivityRange(
    userId: string,
    from: string,
    to: string,
  ): Promise<DailyActivity[]> {
    const { data, error } = await this.supabase
      .from('user_daily_activity')
      .select('activity_date, count')
      .eq('user_id', userId)
      .gte('activity_date', from)
      .lte('activity_date', to)
      .order('activity_date', { ascending: true })
      .returns<DailyActivityRow[]>();

    if (error) {
      throw new Error(`잔디 구간 조회 실패: ${error.message}`);
    }
    return (data ?? []).map((row) => ({
      date: row.activity_date,
      count: row.count,
    }));
  }
}
