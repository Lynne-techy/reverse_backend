/** public.user_statistics 1행에 대응하는 앱 객체(camelCase). */
export interface UserStatistics {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalCount: number;
  lastWrittenDate: string | null;
  freezeAvailable: number;
}

/** streak 계산 순수 함수의 입력(직전 상태). */
export interface StreakSnapshot {
  /** 마지막으로 필사한 날짜 'YYYY-MM-DD'(UTC). 첫 필사면 null. */
  lastWrittenDate: string | null;
  currentStreak: number;
  longestStreak: number;
}

/** streak 계산 순수 함수의 출력(새 상태). */
export interface StreakUpdate {
  currentStreak: number;
  longestStreak: number;
  /** 오늘 이미 필사 기록이 있어 streak가 그대로인 경우 true(멱등 재호출 구분용). */
  alreadyCountedToday: boolean;
}

/** 잔디 한 칸(특정 날짜의 통과 필사 수). */
export interface DailyActivity {
  date: string;
  count: number;
}
