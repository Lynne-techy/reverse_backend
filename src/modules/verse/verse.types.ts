/**
 * 성경 구절 원문. (평범한 데이터 객체 — 프레임워크/DB와 무관)
 */
export interface Verse {
  id: number;
  translationCode: string;
  bookNo: number;
  bookName: string;
  chapter: number;
  verseNo: number;
  text: string;
  createdAt: string;
}
