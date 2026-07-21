import { VerseService } from './verse.service';
import type { VerseRepository } from './verse.repository';
import { Verse } from './verse.types';

function verse(id: number): Verse {
  return {
    id,
    translationCode: 'KO_GAEGAEJEONG',
    bookNo: 19,
    bookName: '시편',
    chapter: 23,
    verseNo: id,
    text: `구절 ${id}`,
    createdAt: '2026-07-22T00:00:00Z',
  };
}

describe('VerseService', () => {
  let repo: {
    findDailyVerseByDate: jest.Mock;
    findRandomVerse: jest.Mock;
    assignDailyVerseIfAbsent: jest.Mock;
    findEmotionVerseCandidates: jest.Mock;
  };
  let service: VerseService;

  beforeEach(() => {
    repo = {
      findDailyVerseByDate: jest.fn(),
      findRandomVerse: jest.fn(),
      assignDailyVerseIfAbsent: jest.fn().mockResolvedValue(undefined),
      findEmotionVerseCandidates: jest.fn(),
    };
    service = new VerseService(repo as unknown as VerseRepository);
  });

  describe('getToday — 원자적 배정 레이스', () => {
    it('이미 배정된 날짜면 그대로 반환하고 새로 배정하지 않는다', async () => {
      repo.findDailyVerseByDate.mockResolvedValue(verse(7));

      await expect(service.getToday('2026-07-22')).resolves.toEqual(verse(7));
      expect(repo.findRandomVerse).not.toHaveBeenCalled();
      expect(repo.assignDailyVerseIfAbsent).not.toHaveBeenCalled();
    });

    it('미배정이면 후보를 골라 if-absent로 배정한다', async () => {
      repo.findDailyVerseByDate
        .mockResolvedValueOnce(null) // 최초 조회: 없음
        .mockResolvedValueOnce(verse(3)); // 배정 후 재조회: 내 후보가 승자
      repo.findRandomVerse.mockResolvedValue(verse(3));

      await expect(service.getToday('2026-07-22')).resolves.toEqual(verse(3));
      expect(repo.assignDailyVerseIfAbsent).toHaveBeenCalledWith(
        '2026-07-22',
        3,
      );
    });

    it('동시 요청이 먼저 배정하면 내 후보가 아니라 배정된 승자를 반환한다', async () => {
      // 핵심: if-absent 배정은 조용히 무시되고(먼저 들어온 배정 유지),
      // 재조회로 실제 확정된 값을 돌려줘야 한다 — 두 동시 요청이 같은 말씀을 본다.
      repo.findDailyVerseByDate
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(verse(99)); // 다른 요청이 먼저 배정한 승자
      repo.findRandomVerse.mockResolvedValue(verse(3)); // 내가 고른 후보

      await expect(service.getToday('2026-07-22')).resolves.toEqual(verse(99));
      expect(repo.assignDailyVerseIfAbsent).toHaveBeenCalledWith(
        '2026-07-22',
        3,
      );
    });

    it('배정 직후 재조회가 비면(경계) 내 후보로 폴백한다', async () => {
      repo.findDailyVerseByDate
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      repo.findRandomVerse.mockResolvedValue(verse(3));

      await expect(service.getToday('2026-07-22')).resolves.toEqual(verse(3));
    });
  });

  describe('getRecommendations', () => {
    it('후보가 6개보다 많아도 최대 6개만, 모두 후보 안에서 반환한다', async () => {
      const candidates = Array.from({ length: 10 }, (_, i) => verse(i + 1));
      repo.findEmotionVerseCandidates.mockResolvedValue(candidates);

      const result = await service.getRecommendations('joy');
      const ids = new Set(candidates.map((v) => v.id));

      expect(result).toHaveLength(6);
      expect(new Set(result.map((v) => v.id)).size).toBe(6); // 중복 없음
      expect(result.every((v) => ids.has(v.id))).toBe(true);
      expect(repo.findEmotionVerseCandidates).toHaveBeenCalledWith(
        'joy',
        'KO_GAEGAEJEONG',
      );
    });

    it('후보가 6개 미만이면 있는 만큼만 반환한다', async () => {
      repo.findEmotionVerseCandidates.mockResolvedValue([verse(1), verse(2)]);
      await expect(service.getRecommendations('fear')).resolves.toHaveLength(2);
    });
  });
});
