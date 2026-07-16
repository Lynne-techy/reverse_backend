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
  /** 마지막으로 필사한 날짜 'YYYY-MM-DD'(클라이언트 로컬). 첫 필사면 null. */
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

/** 현재 스트릭이 시작된 날의 첫 통과 필사(배너 문구용). */
export interface StreakStartInfo {
  /** 스트릭 시작일 'YYYY-MM-DD'(클라이언트 로컬). */
  date: string;
  bookNo: number;
  bookName: string;
  chapter: number;
}

/** GET /stats/me 응답 — 통계 + 스트릭 시작 정보(없으면 null). */
export interface MyStatistics extends UserStatistics {
  /**
   * 스트릭 시작일에 필사한 책/장. 스트릭이 없거나 시작일 세션을 찾지 못하면
   * null — 클라이언트는 이때 배너의 콘텐츠 문구를 생략한다.
   */
  streakStart: StreakStartInfo | null;
}
