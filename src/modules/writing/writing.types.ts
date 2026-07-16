export const WRITING_SESSION_STATUSES = [
  'pending',
  'uploaded',
  'processing',
  'completed',
  'failed',
] as const;
export type WritingSessionStatus = (typeof WRITING_SESSION_STATUSES)[number];

/**
 * 유사도 통과 최소 점수. 점수 가이드(docs/HANDWRITING_CHECK_POLICY.md)상
 * 60~84는 "알아볼 수 있는 같은 구절"이므로 습관 형성 앱 특성상 관대하게 60을
 * 기준으로 잡는다. 오탈자 몇 개로 잔디를 안 주면 UX가 가혹해진다.
 */
export const PASS_MIN_SIMILARITY_SCORE = 60;

/** 필사 언어. 프로토타입의 한/영 '병행' 모드는 제외하고 ko·en 택1로 단순화. */
export const WRITING_LANGUAGES = ['ko', 'en'] as const;
export type WritingLanguage = (typeof WRITING_LANGUAGES)[number];

export interface WritingSession {
  id: string;
  userId: string;
  bookNo: number;
  chapter: number;
  startVerseNo: number;
  endVerseNo: number;
  /** 범위 중 대표 절. 생성 시엔 null이고 complete(기록 저장) 때 채워진다. */
  keyVerseId: number | null;
  language: WritingLanguage;
  objectKey: string;
  status: WritingSessionStatus;
  recognizedText: string | null;
  similarityScore: number | null;
  passed: boolean | null;
  /** complete 요청의 클라이언트 로컬 날짜(YYYY-MM-DD). 잔디/streak 기준일. complete 전에는 null. */
  clientDate: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** 진척률 계산 입력 — 통과(passed=true)한 필사 세션의 범위만 추출한 값. */
export interface PassedWritingRange {
  bookNo: number;
  chapter: number;
  startVerseNo: number;
  endVerseNo: number;
}
