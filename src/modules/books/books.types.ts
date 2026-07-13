/**
 * 성경 각 권(66권)의 배경 정보. (평범한 데이터 객체 — 프레임워크/DB와 무관)
 * summary/bookName 외 배경 필드는 자료 미비 시 null 일 수 있다.
 */
export interface Book {
  translationCode: string;
  bookNo: number;
  bookName: string;
  summary: string;
  author: string | null;
  writtenPeriod: string | null;
  writtenPlace: string | null;
  audience: string | null;
  coreTheme: string | null;
  youtubeUrl: string | null;
}
