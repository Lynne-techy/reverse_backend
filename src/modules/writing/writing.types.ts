export const WRITING_SESSION_STATUSES = [
  'pending',
  'uploaded',
  'processing',
  'completed',
  'failed',
] as const;
export type WritingSessionStatus = (typeof WRITING_SESSION_STATUSES)[number];

/** 필사 언어. 프로토타입의 한/영 '병행' 모드는 제외하고 ko·en 택1로 단순화. */
export const WRITING_LANGUAGES = ['ko', 'en'] as const;
export type WritingLanguage = (typeof WRITING_LANGUAGES)[number];

export interface WritingSession {
  id: string;
  userId: string;
  verseId: number;
  language: WritingLanguage;
  objectKey: string;
  status: WritingSessionStatus;
  recognizedText: string | null;
  similarityScore: number | null;
  passed: boolean | null;
  createdAt: string;
  completedAt: string | null;
}
