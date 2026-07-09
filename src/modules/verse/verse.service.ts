import { Injectable } from '@nestjs/common';
import { VerseRepository } from './verse.repository';
import { Verse } from './verse.types';

/**
 * Verse 비즈니스 로직. controller 와 repository 사이에서 규칙을 처리한다.
 */
@Injectable()
export class VerseService {
  constructor(private readonly verseRepository: VerseRepository) {}

  /**
   * 오늘의 말씀 조회. date는 클라이언트가 보낸 로컬 날짜 문자열이며
   * 서버는 타임존을 계산하지 않고 그대로 키로 사용한다.
   * 아직 배정된 적 없는 날짜면 무작위로 하나 골라 배정한다.
   */
  async getToday(date: string): Promise<Verse> {
    const existing = await this.verseRepository.findDailyVerseByDate(date);
    if (existing) {
      return existing;
    }

    const candidate = await this.verseRepository.findRandomVerse();
    await this.verseRepository.assignDailyVerseIfAbsent(date, candidate.id);

    // 동시 요청이 먼저 배정했을 수 있으므로 확정된 값을 다시 조회한다.
    const assigned = await this.verseRepository.findDailyVerseByDate(date);
    return assigned ?? candidate;
  }

  /** id로 단일 verse 조회 (없으면 null). writing 모듈의 key verse 검증에 쓰인다. */
  findById(id: number): Promise<Verse | null> {
    return this.verseRepository.findById(id);
  }

  /**
   * 같은 책·장 안의 절 범위를 조회한다. 클라이언트가 key verse를 고르도록
   * 각 절을 화면에 뿌리는 용도. from>to면 컨트롤러(DTO)에서 이미 걸러진다.
   */
  getRange(
    bookNo: number,
    chapter: number,
    from: number,
    to: number,
  ): Promise<Verse[]> {
    return this.verseRepository.findRange(bookNo, chapter, from, to);
  }
}
