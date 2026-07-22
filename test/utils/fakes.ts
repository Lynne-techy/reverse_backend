import type { AuthenticatedUser } from '../../src/modules/auth/current-user.decorator';
import type { Verse } from '../../src/modules/verse/verse.types';

/** AuthService.verifyToken 대체가 반환하는 가짜 인증 주체. */
export const FAKE_USER: AuthenticatedUser = {
  userId: 'e2e-user-id',
  email: 'e2e@example.com',
  provider: 'google',
  fullName: 'E2E Tester',
};

function verse(id: number): Verse {
  return {
    id,
    translationCode: 'KO_GAEGAEJEONG',
    bookNo: 19,
    bookName: '시편',
    chapter: 23,
    verseNo: id,
    text: `테스트 구절 ${id}`,
    createdAt: '2026-07-22T00:00:00.000Z',
  };
}

export const SAMPLE_VERSES: Verse[] = Array.from({ length: 8 }, (_, i) =>
  verse(i + 1),
);

/** VerseService 가 호출하는 메서드만 채운 인메모리 페이크(DB 경계 차단). */
export const fakeVerseRepository = {
  findEmotionVerseCandidates: async () => SAMPLE_VERSES,
  findDailyVerseByDate: async () => verse(1),
  findRandomVerse: async () => verse(1),
  assignDailyVerseIfAbsent: async () => undefined,
  findById: async (id: number) => verse(id),
  findRange: async () => SAMPLE_VERSES.slice(0, 3),
  countVersesPerBook: async () => new Map<number, number>([[19, 150]]),
};

/**
 * supabase-js 쿼리 빌더 페이크. 어떤 메서드 체인이든(`.select().eq().limit()`,
 * `.update().eq().lt()` 등) 자기 자신을 돌려주고, await 하면 `{ data, error: null }` 로
 * 해소된다(PostgREST 빌더가 thenable인 점을 흉내). health/db·부팅 훅 등 모든 경로를 조용히 통과.
 * 실제 데이터는 Repository 페이크가 담당하므로, 여기선 "무해한 성공"만 반환하면 된다.
 */
type FakeQuery = PromiseLike<{ data: unknown[]; error: null }>;

function makeQuery(): FakeQuery {
  const result = { data: [{ id: 1 }] as unknown[], error: null };
  const target: Record<string, unknown> = {
    then: (onfulfilled: (v: typeof result) => unknown) =>
      Promise.resolve(result).then(onfulfilled),
  };
  const proxy = new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      return () => proxy; // 미정의 메서드 → 프록시 자신을 돌려줘 체인 계속
    },
  }) as unknown as FakeQuery;
  return proxy;
}

export const fakeSupabase = { from: () => makeQuery() };

/**
 * stats/writing은 서비스 로직(스트릭 계산·Storage presign·Gemini 트리거)이 무거워
 * 컨트롤러 계약(라우팅·DTO·인증·직렬화) 검증엔 서비스 경계 페이크가 적절하다.
 * (verse는 서비스를 실제로 태우고 repo만 페이크 → 두 방식 혼용)
 */
export const fakeStatsService = {
  getMyStatistics: async () => ({
    currentStreak: 3,
    longestStreak: 7,
    totalCount: 42,
    streakStart: null,
  }),
  getActivityCalendar: async () => [{ date: '2026-07-22', count: 2 }],
};

export const fakeWritingService = {
  listMyWritings: async () => [],
  getById: async () => ({ id: 'sess-1', status: 'completed' }),
  createUploadUrl: async () => ({
    sessionId: 'sess-1',
    objectKey: 'writings/e2e/sess-1.jpg',
    uploadUrl: 'https://example.test/upload',
  }),
  complete: async () => ({ id: 'sess-1', status: 'processing' }),
};
