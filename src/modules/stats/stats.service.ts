import { Injectable } from '@nestjs/common';
import { BooksService } from '../books/books.service';
import { StatsRepository } from './stats.repository';
import { calculateStreak, streakStartDate } from './streak-calculator';
import {
  DailyActivity,
  MyStatistics,
  StreakSnapshot,
  StreakStartInfo,
  UserStatistics,
} from './stats.types';

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
  constructor(
    private readonly statsRepository: StatsRepository,
    private readonly booksService: BooksService,
  ) {}

  /** 내 통계 조회(없으면 기본값) + 스트릭 시작 배너 정보. */
  async getMyStatistics(userId: string): Promise<MyStatistics> {
    const stats =
      (await this.statsRepository.findStatistics(userId)) ??
      EMPTY_STATISTICS(userId);
    return { ...stats, streakStart: await this.findStreakStart(stats) };
  }

  /**
   * 스트릭 시작일에 처음 통과한 필사(책/장/책 이름)를 찾는다.
   * 어느 단계에서든 못 찾으면 null — 배너는 콘텐츠 문구 없이 그려진다.
   * (client_date 도입 전 세션이 시작점인 경우가 대표적.)
   */
  private async findStreakStart(
    stats: UserStatistics,
  ): Promise<StreakStartInfo | null> {
    const startDate = streakStartDate(
      stats.lastWrittenDate,
      stats.currentStreak,
    );
    if (!startDate) {
      return null;
    }

    const writing = await this.statsRepository.findFirstPassedWriting(
      stats.userId,
      startDate,
    );
    if (!writing) {
      return null;
    }

    const book = await this.booksService.findByBookNo(writing.bookNo);
    if (!book) {
      return null;
    }

    return {
      date: startDate,
      bookNo: writing.bookNo,
      bookName: book.bookName,
      chapter: writing.chapter,
    };
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
   * 필사 통과 시 호출한다. 해당 날짜의 잔디 칸을 +1 하고, 순수 함수로 새
   * streak을 계산해 통계를 갱신한다. today는 클라이언트 로컬 날짜
   * ('YYYY-MM-DD') — complete 요청의 date가 그대로 전달된다.
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

    // 시차 이동으로 today가 마지막 기록보다 과거일 수 있다. lastWrittenDate를
    // 뒤로 돌리면 같은 날짜로 streak이 이중 적립될 수 있으므로 더 큰 값을 유지
    // (YYYY-MM-DD는 문자열 비교가 곧 날짜 비교).
    const lastWrittenDate =
      snapshot.lastWrittenDate && snapshot.lastWrittenDate > today
        ? snapshot.lastWrittenDate
        : today;

    return this.statsRepository.saveStatistics(userId, {
      currentStreak: update.currentStreak,
      longestStreak: update.longestStreak,
      totalCount: (existing?.totalCount ?? 0) + 1,
      lastWrittenDate,
    });
  }
}
