import {
  calculateStreak,
  diffInUtcDays,
  streakStartDate,
} from './streak-calculator';
import { StreakSnapshot } from './stats.types';

describe('diffInUtcDays', () => {
  it('하루 차이는 1이다', () => {
    expect(diffInUtcDays('2026-07-15', '2026-07-16')).toBe(1);
  });

  it('to가 과거면 음수다', () => {
    expect(diffInUtcDays('2026-07-16', '2026-07-15')).toBe(-1);
  });

  it('월 경계를 넘어도 정확하다', () => {
    expect(diffInUtcDays('2026-06-30', '2026-07-01')).toBe(1);
  });
});

describe('streakStartDate', () => {
  it('58일 스트릭이면 마지막 날에서 57일 되돌린 날이 시작일이다', () => {
    expect(streakStartDate('2026-07-16', 58)).toBe('2026-05-20');
  });

  it('1일 스트릭이면 시작일은 마지막 필사일 그 자체다', () => {
    expect(streakStartDate('2026-07-16', 1)).toBe('2026-07-16');
  });

  it('연 경계를 넘어 역산해도 정확하다', () => {
    expect(streakStartDate('2026-01-03', 5)).toBe('2025-12-30');
  });

  it('기록이 없으면(첫 필사 전) null이다', () => {
    expect(streakStartDate(null, 0)).toBeNull();
  });

  it('streak이 0이면 날짜가 있어도 null이다', () => {
    expect(streakStartDate('2026-07-16', 0)).toBeNull();
  });
});

describe('calculateStreak', () => {
  it('첫 필사면 streak 1로 시작한다', () => {
    const snapshot: StreakSnapshot = {
      lastWrittenDate: null,
      currentStreak: 0,
      longestStreak: 0,
    };

    expect(calculateStreak(snapshot, '2026-07-16')).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      alreadyCountedToday: false,
    });
  });

  it('같은 날 재필사면 streak을 유지하고 alreadyCountedToday를 표시한다', () => {
    const snapshot: StreakSnapshot = {
      lastWrittenDate: '2026-07-16',
      currentStreak: 5,
      longestStreak: 7,
    };

    expect(calculateStreak(snapshot, '2026-07-16')).toEqual({
      currentStreak: 5,
      longestStreak: 7,
      alreadyCountedToday: true,
    });
  });

  it('어제 필사했으면 +1 하고 최고 기록을 갱신한다', () => {
    const snapshot: StreakSnapshot = {
      lastWrittenDate: '2026-07-15',
      currentStreak: 7,
      longestStreak: 7,
    };

    expect(calculateStreak(snapshot, '2026-07-16')).toEqual({
      currentStreak: 8,
      longestStreak: 8,
      alreadyCountedToday: false,
    });
  });

  it('연속해도 기존 최고 기록보다 낮으면 최고 기록은 그대로다', () => {
    const snapshot: StreakSnapshot = {
      lastWrittenDate: '2026-07-15',
      currentStreak: 2,
      longestStreak: 10,
    };

    expect(calculateStreak(snapshot, '2026-07-16')).toEqual({
      currentStreak: 3,
      longestStreak: 10,
      alreadyCountedToday: false,
    });
  });

  it('이틀 이상 공백이면 1로 리셋하되 최고 기록은 남긴다', () => {
    const snapshot: StreakSnapshot = {
      lastWrittenDate: '2026-07-13',
      currentStreak: 5,
      longestStreak: 5,
    };

    expect(calculateStreak(snapshot, '2026-07-16')).toEqual({
      currentStreak: 1,
      longestStreak: 5,
      alreadyCountedToday: false,
    });
  });

  it('시차 이동으로 로컬 날짜가 과거로 가도 streak을 잃지 않는다', () => {
    // 7/16 서울에서 필사(streak 5) 후 LA로 이동, 로컬 7/15에 또 필사한 시나리오.
    const snapshot: StreakSnapshot = {
      lastWrittenDate: '2026-07-16',
      currentStreak: 5,
      longestStreak: 5,
    };

    expect(calculateStreak(snapshot, '2026-07-15')).toEqual({
      currentStreak: 5,
      longestStreak: 5,
      alreadyCountedToday: true,
    });
  });
});
