import { Injectable } from '@nestjs/common';
import { StatsRepository } from './stats.repository';
import { calculateStreak } from './streak-calculator';
import { DailyActivity, StreakSnapshot, UserStatistics } from './stats.types';

/** 통계가 아직 없는 사용자에게 돌려줄 기본값. */
const EMPTY_STATISTICS = (userId: string): UserStatistics => ({
  userId,
  currentStreak: 0,
  longestStreak: 0,
  totalCount: 0,
  lastWrittenDate: null,
  freezeAvailable: 0,
});

@Injectable()
export class StatsService {
  constructor(private readonly statsRepository: StatsRepository) {}

  /** 내 통계 조회(없으면 기본값). */
  async getMyStatistics(userId: string): Promise<UserStatistics> {
    const stats = await this.statsRepository.findStatistics(userId);
    return stats ?? EMPTY_STATISTICS(userId);
  }

  /** 잔디(일자별 활동) 구간 조회. */
  getActivityCalendar(
    userId: string,
    from: string,
    to: string,
  ): Promise<DailyActivity[]> {
    return this.statsRepository.findActivityRange(userId, from, to);
  }

  /**
   * 필사 통과 시 호출한다. 오늘 잔디 칸을 +1 하고, 순수 함수로 새 streak을
   * 계산해 통계를 갱신한다. today는 서버 UTC 오늘('YYYY-MM-DD').
   */
  async recordWriting(userId: string, today: string): Promise<UserStatistics> {
    const existing = await this.statsRepository.findStatistics(userId);
    const snapshot: StreakSnapshot = existing
      ? {
          lastWrittenDate: existing.lastWrittenDate,
          currentStreak: existing.currentStreak,
          longestStreak: existing.longestStreak,
        }
      : { lastWrittenDate: null, currentStreak: 0, longestStreak: 0 };

    const update = calculateStreak(snapshot, today);

    await this.statsRepository.incrementDailyActivity(userId, today);

    return this.statsRepository.saveStatistics(userId, {
      currentStreak: update.currentStreak,
      longestStreak: update.longestStreak,
      totalCount: (existing?.totalCount ?? 0) + 1,
      lastWrittenDate: today,
    });
  }
}
