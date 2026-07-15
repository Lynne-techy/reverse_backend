import { PassedWritingRange } from './writing.types';

/** calculateProgress의 계산 결과. */
export interface ProgressSnapshot {
  /** 통과한 필사가 커버한 고유 절 수 (범위 중복 제거). */
  coveredVerses: number;
  /** 책의 모든 절을 커버해 완필로 판정된 책 수. */
  completedBooks: number;
  /** coveredVerses / 전체 절수 * 100 (0~100). */
  progressRate: number;
}

/**
 * 통과(passed=true)한 필사 범위들로 진척률을 계산하는 순수 함수.
 *
 * @param passedRanges 통과한 필사 세션들의 범위 목록(같은 절이 여러 세션에서 중복될 수 있다).
 * @param verseTotals 번역본의 book_no별 총 절수(VerseService.countVersesPerBook 결과).
 *   완필 판정("이 책의 모든 절을 커버했는가")과 진척률 분모(전체 절수 = 이 Map 값들의 합)에 쓰인다.
 */
export function calculateProgress(
  passedRanges: PassedWritingRange[],
  verseTotals: Map<number, number>,
): ProgressSnapshot {
  // book별로 커버된 절 키(chapter-verseNo) 집합을 모은다. Set이 중복 필사를 걸러준다.
  const groups = new Map<number, Set<string>>();
  for (const passedRange of passedRanges) {
    const bookNo = passedRange.bookNo;
    const chapter = passedRange.chapter;
    const startVerseNo = passedRange.startVerseNo;
    const endVerseNo = passedRange.endVerseNo;

    for (let i = startVerseNo; i <= endVerseNo; i++) {
      if (!groups.has(bookNo)) {
        groups.set(bookNo, new Set<string>());
      }
      groups.get(bookNo)!.add(`${chapter}-${i}`);
    }
  }

  const versesOfGroups = Array.from(groups.values());
  const coveredVerses = versesOfGroups.reduce((acc, cur) => acc + cur.size, 0);

  // book별 커버 절수 == 그 책 전체 절수면 완필. verseTotals에 없는 bookNo는 자연히 제외된다.
  let completedBooks = 0;
  for (const [bookNo, verseSet] of groups) {
    if (verseTotals.get(bookNo) === verseSet.size) {
      completedBooks += 1;
    }
  }

  let verseTotalCount = 0;
  for (const item of verseTotals.values()) {
    verseTotalCount += item;
  }
  const progressRate =
    verseTotalCount === 0 ? 0 : (coveredVerses / verseTotalCount) * 100;

  return {
    coveredVerses,
    completedBooks,
    progressRate,
  };
}
