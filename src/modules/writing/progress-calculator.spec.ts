import { calculateProgress } from './progress-calculator';
import { PassedWritingRange } from './writing.types';

describe('calculateProgress', () => {
  it('필사 기록이 없으면 전부 0이다', () => {
    const verseTotals = new Map([
      [1, 3],
      [2, 2],
    ]);

    const result = calculateProgress([], verseTotals);

    expect(result).toEqual({
      coveredVerses: 0,
      totalVerses: 5,
      completedBooks: 0,
      progressRate: 0,
    });
  });

  it('책 일부만 커버하면 완필로 세지 않는다', () => {
    const verseTotals = new Map([
      [1, 3],
      [2, 2],
    ]);
    const ranges: PassedWritingRange[] = [
      { bookNo: 1, chapter: 1, startVerseNo: 1, endVerseNo: 2 }, // 1권 3절 중 2절만
    ];

    const result = calculateProgress(ranges, verseTotals);

    expect(result.coveredVerses).toBe(2);
    expect(result.totalVerses).toBe(5);
    expect(result.completedBooks).toBe(0);
    expect(result.progressRate).toBeCloseTo((2 / 5) * 100);
  });

  it('책 전체를 커버하면 완필로 센다', () => {
    const verseTotals = new Map([
      [1, 3],
      [2, 2],
    ]);
    const ranges: PassedWritingRange[] = [
      { bookNo: 1, chapter: 1, startVerseNo: 1, endVerseNo: 3 }, // 1권 3절 전부
    ];

    const result = calculateProgress(ranges, verseTotals);

    expect(result.coveredVerses).toBe(3);
    expect(result.completedBooks).toBe(1);
    expect(result.progressRate).toBeCloseTo((3 / 5) * 100);
  });

  it('겹치는 범위는 중복 없이 한 번만 센다', () => {
    const verseTotals = new Map([[1, 3]]);
    const ranges: PassedWritingRange[] = [
      { bookNo: 1, chapter: 1, startVerseNo: 1, endVerseNo: 3 },
      { bookNo: 1, chapter: 1, startVerseNo: 2, endVerseNo: 3 }, // 2~3절 재필사(중복)
    ];

    const result = calculateProgress(ranges, verseTotals);

    expect(result.coveredVerses).toBe(3);
    expect(result.completedBooks).toBe(1);
  });

  it('verseTotals에 없는 bookNo는 완필 판정에서 제외된다', () => {
    const verseTotals = new Map([[1, 3]]);
    const ranges: PassedWritingRange[] = [
      { bookNo: 1, chapter: 1, startVerseNo: 1, endVerseNo: 3 },
      { bookNo: 99, chapter: 1, startVerseNo: 1, endVerseNo: 1 }, // 존재하지 않는 책
    ];

    const result = calculateProgress(ranges, verseTotals);

    expect(result.coveredVerses).toBe(4);
    expect(result.completedBooks).toBe(1);
  });

  it('전체 절수가 0이면 진척률은 0으로 방어한다', () => {
    const result = calculateProgress([], new Map());

    expect(result.progressRate).toBe(0);
    expect(result.totalVerses).toBe(0);
  });
});
