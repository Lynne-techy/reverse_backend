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
 * 현재 스트릭이 시작된 날짜('YYYY-MM-DD')를 계산하는 순수 함수.
 * 예: lastWrittenDate '2026-07-16', currentStreak 58 → '2026-05-20'
 * (스트릭 마지막 날에서 (streak - 1)일을 되돌린 날이 시작일).
 * 스트릭이 없어 시작일 자체가 성립하지 않으면 null.
 */
export function streakStartDate(
  lastWrittenDate: string | null,
  currentStreak: number,
): string | null {
  if (lastWrittenDate == null || currentStreak <= 0) {
    return null;
  }

  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const lastMs = Date.parse(`${lastWrittenDate}T00:00:00Z`);
  const startMs = lastMs - (currentStreak - 1) * MS_PER_DAY;

  const startDate = new Date(startMs).toISOString().slice(0, 10);

  return startDate;
}

/**
 * 직전 streak 상태와 "오늘"을 받아 새 streak 상태를 계산하는 순수 함수.
 * 부수효과 없음 — DB/시간 조회는 호출자(StatsService)가 담당하고, 여기선
 * 규칙만 다룬다. today는 클라이언트 로컬 날짜('YYYY-MM-DD').
 *
 * 규칙:
 * - lastWrittenDate가 null(첫 필사) → streak 1로 시작
 * - 차이가 0 이하(오늘 이미 필사했거나, 시차 이동으로 로컬 날짜가 과거로
 *   간 경우) → streak 그대로, alreadyCountedToday: true
 * - 차이가 1(어제 필사함, 연속) → currentStreak + 1
 * - 차이가 2 이상(공백으로 끊김) → 1로 리셋
 */
export function calculateStreak(
  snapshot: StreakSnapshot,
  today: string,
): StreakUpdate {
  if (!snapshot.lastWrittenDate) {
    return { currentStreak: 1, longestStreak: 1, alreadyCountedToday: false };
  }

  const diff = diffInUtcDays(snapshot.lastWrittenDate, today);
  if (diff <= 0) {
    // 0: 같은 날 재필사. 음수: 클라이언트 로컬 날짜가 마지막 기록보다 과거
    // (동→서 시차 이동 등) — 벌 주지 않고 같은 날 취급해 streak을 유지한다.
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

  // diff >= 2 → 하루 이상 공백, 끊긴 것으로 보고 리셋
  return {
    currentStreak: 1,
    longestStreak: snapshot.longestStreak,
    alreadyCountedToday: false,
  };
}
