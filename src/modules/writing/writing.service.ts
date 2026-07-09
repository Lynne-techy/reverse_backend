import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StatsService } from '../stats/stats.service';
import { VerseService } from '../verse/verse.service';
import { WritingRepository } from './writing.repository';
import { WritingLanguage, WritingSession } from './writing.types';

@Injectable()
export class WritingService {
  constructor(
    private readonly writingRepository: WritingRepository,
    private readonly statsService: StatsService,
    private readonly verseService: VerseService,
  ) {}

  /**
   * 업로드용 presigned URL을 발급하고, 그 대상 경로로 세션을 만든다.
   * 필사 단위는 '같은 장 안의 절 범위(book/chapter + startVerseNo~endVerseNo)'이고,
   * 언어와 함께 이 시점에 정해진다. key verse는 아직 없다(complete 때 고름).
   */
  async createUploadUrl(
    userId: string,
    bookNo: number,
    chapter: number,
    startVerseNo: number,
    endVerseNo: number,
    language: WritingLanguage,
  ): Promise<{ sessionId: string; objectKey: string; uploadUrl: string }> {
    if (startVerseNo > endVerseNo) {
      throw new BadRequestException('시작 절이 종료 절보다 뒤일 수 없습니다.');
    }

    const sessionId = randomUUID();
    const objectKey = `${userId}/${sessionId}.jpg`;

    await this.writingRepository.create({
      id: sessionId,
      userId,
      bookNo,
      chapter,
      startVerseNo,
      endVerseNo,
      language,
      objectKey,
    });
    const { signedUrl } =
      await this.writingRepository.createSignedUploadUrl(objectKey);

    return { sessionId, objectKey, uploadUrl: signedUrl };
  }

  /**
   * 업로드 완료 처리. 실제 Gemini 유사도 검사는 아직 붙지 않아 항상 통과로
   * 고정하는 스텁이다 (④-2 stub 단계 — 후속 작업에서 Gemini 연동 예정).
   */
  async complete(
    userId: string,
    sessionId: string,
    keyVerseId: number,
  ): Promise<WritingSession> {
    const session = await this.writingRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('필사 세션을 찾을 수 없습니다.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException(
        '본인의 필사 세션만 완료 처리할 수 있습니다.',
      );
    }
    if (session.status === 'completed') {
      throw new ConflictException('이미 완료 처리된 세션입니다.');
    }

    const keyVerse = await this.verseService.findById(keyVerseId);
    if (!keyVerse) {
      throw new NotFoundException('key verse를 찾을 수 없습니다.');
    }

    // 대표 절은 이 세션에 저장된 필사 범위(같은 책·장 + verse_no ∈ [start, end]) 안의 절이어야 한다.
    const inRange =
      keyVerse.bookNo === session.bookNo &&
      keyVerse.chapter === session.chapter &&
      keyVerse.verseNo >= session.startVerseNo &&
      keyVerse.verseNo <= session.endVerseNo;
    if (!inRange) {
      throw new BadRequestException('key verse는 필사 범위 안의 절이어야 합니다.');
    }

    const completed = await this.writingRepository.markCompleted(sessionId, {
      keyVerseId,
      recognizedText: '(stub) Gemini 연동 전 임시 통과 처리',
      similarityScore: 100,
      passed: true,
    });

    // 통과한 필사만 잔디/streak에 반영한다. 하루 경계는 서버 UTC 기준(MVP 단순화).
    if (completed.passed) {
      const todayUtc = new Date().toISOString().slice(0, 10);
      await this.statsService.recordWriting(userId, todayUtc);
    }

    return completed;
  }
}
