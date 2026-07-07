export const WRITING_SESSION_STATUSES = [
  'pending',
  'uploaded',
  'processing',
  'completed',
  'failed',
] as const;
export type WritingSessionStatus = (typeof WRITING_SESSION_STATUSES)[number];

export interface WritingSession {
  id: string;
  userId: string;
  verseId: number;
  objectKey: string;
  status: WritingSessionStatus;
  recognizedText: string | null;
  similarityScore: number | null;
  passed: boolean | null;
  createdAt: string;
  completedAt: string | null;
}
