import { StreakSnapshot, StreakUpdate } from './stats.types';

/**
 * 두 'YYYY-MM-DD' 날짜(UTC 기준) 사이의 일수 차이(to - from).
 * 예: diffInUtcDays('2026-07-07', '2026-07-08') === 1
 */
export function diffInUtcDays(from: string, to: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

/**
 * 직전 streak 상태와 "오늘"을 받아 새 streak 상태를 계산하는 순수 함수.
 * 부수효과 없음 — DB/시간 조회는 호출자(StatsService)가 담당하고, 여기선
 * 규칙만 다룬다. today는 서버 UTC 오늘 날짜('YYYY-MM-DD').
 */
export function calculateStreak(
  snapshot: StreakSnapshot,
  today: string,
): StreakUpdate {
  // TODO(human)
  // - lastWrittenDate가 null(첫 필사) → streak 1로 시작
  // - 차이가 0(오늘 이미 필사함) → streak 그대로, alreadyCountedToday: true
  // - 차이가 1(어제 필사함, 연속) → currentStreak + 1
  // - 차이가 2 이상(공백으로 끊김) → 1로 리셋
  if (!snapshot.lastWrittenDate) {
    return { currentStreak: 1, longestStreak: 1, alreadyCountedToday: false };
  }

  const diff = diffInUtcDays(snapshot.lastWrittenDate, today);
  if (diff == 0) {
    return {
      currentStreak: snapshot.currentStreak,
      longestStreak: snapshot.longestStreak,
      alreadyCountedToday: true,
    };
  }
  if (diff == 1) {
    return {
      currentStreak: snapshot.currentStreak + 1,
      longestStreak: Math.max(
        snapshot.longestStreak,
        snapshot.currentStreak + 1,
      ),
      alreadyCountedToday: false,
    };
  }

  //  diff >= 2 이거나 음수(미래 날짜 등 이상값) → 끊긴 것으로 보고 리셋
  return {
    currentStreak: 1,
    longestStreak: snapshot.longestStreak,
    alreadyCountedToday: false,
  };
}
