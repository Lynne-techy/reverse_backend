import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { HandwritingCheckService } from '../handwriting-check/handwriting-check.service';
import { StatsService } from '../stats/stats.service';
import { VerseService } from '../verse/verse.service';
import { WritingRepository } from './writing.repository';
import {
  PASS_MIN_SIMILARITY_SCORE,
  WritingLanguage,
  WritingSession,
  WritingSessionStatus,
} from './writing.types';

/** complete로 검사를 시작할 수 있는 상태. failed를 포함해 재시도를 허용한다. */
const CLAIMABLE_STATUSES: WritingSessionStatus[] = [
  'pending',
  'uploaded',
  'failed',
];

@Injectable()
export class WritingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WritingService.name);

  constructor(
    private readonly writingRepository: WritingRepository,
    private readonly statsService: StatsService,
    private readonly verseService: VerseService,
    private readonly handwritingCheckService: HandwritingCheckService,
  ) {}

  /**
   * 서버가 유사도 검사 도중 죽으면 processing 세션이 영구히 남는다.
   * 부팅 시 일괄 failed 처리해 사용자가 complete를 재시도할 수 있게 한다.
   * (단일 인스턴스 전제 — 상세는 repository.failStaleProcessing 주석 참고)
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.writingRepository.failStaleProcessing();
    } catch (error) {
      // 정리 실패가 부팅을 막을 일은 아니다. 로그만 남긴다.
      this.logger.error('잔류 processing 세션 정리 실패', error);
    }
  }

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

  /** 세션 단건 조회. 비동기 검사 결과를 클라이언트가 폴링하는 용도. */
  async getById(userId: string, sessionId: string): Promise<WritingSession> {
    const session = await this.writingRepository.findById(sessionId);
    if (!session) {
      throw new NotFoundException('필사 세션을 찾을 수 없습니다.');
    }
    if (session.userId !== userId) {
      throw new ForbiddenException('본인의 필사 세션만 조회할 수 있습니다.');
    }
    return session;
  }

  /**
   * 기록 저장(완료 요청). key verse를 확정하고 세션을 processing으로 선점한 뒤
   * 즉시 응답한다. Gemini 유사도 검사는 요청을 붙잡지 않도록 백그라운드에서
   * 수행하고(ADR 6.11), 클라이언트는 GET /writing-sessions/:id 폴링으로
   * completed/failed 전환을 확인한다.
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
    if (session.status === 'processing') {
      throw new ConflictException('유사도 검사가 진행 중인 세션입니다.');
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
      throw new BadRequestException(
        'key verse는 필사 범위 안의 절이어야 합니다.',
      );
    }

    const claimed = await this.writingRepository.claimForProcessing(
      sessionId,
      keyVerseId,
      CLAIMABLE_STATUSES,
    );
    if (!claimed) {
      // 위의 상태 검사 이후 동시 요청이 먼저 선점한 경우.
      throw new ConflictException('이미 처리 중이거나 완료된 세션입니다.');
    }

    // 의도적으로 await하지 않는다. processSimilarity는 내부에서 모든 오류를
    // 삼키고 세션을 failed로 남기므로 unhandled rejection이 없다.
    void this.processSimilarity(claimed);

    return claimed;
  }

  /**
   * 백그라운드 유사도 검사. Storage의 이미지와 필사 범위 원문을 Gemini로 대조해
   * completed(통과/불통과) 또는 failed(검사 자체 실패, 재시도 가능)로 마감한다.
   */
  private async processSimilarity(session: WritingSession): Promise<void> {
    try {
      const [image, verses] = await Promise.all([
        this.writingRepository.downloadImage(session.objectKey),
        // 현재 verses는 단일 번역본이라 session.language로 원문을 좁히지 않는다.
        // TODO: 영어 번역본 시드 후 language → translation_code 매핑 추가.
        this.verseService.getRange(
          session.bookNo,
          session.chapter,
          session.startVerseNo,
          session.endVerseNo,
        ),
      ]);
      if (verses.length === 0) {
        throw new Error('필사 범위에 해당하는 원문 구절이 없습니다.');
      }
      const originalText = verses.map((verse) => verse.text).join(' ');

      const result = await this.handwritingCheckService.checkAndLog(
        {
          buffer: image.buffer,
          mimetype: image.mimetype,
          originalname: session.objectKey,
          size: image.buffer.length,
        },
        originalText,
      );

      // 펜 손글씨가 아니거나 점수가 null(판독 불가)이면 불통과. 점수 기준은
      // PASS_MIN_SIMILARITY_SCORE 주석 참고.
      const passed =
        result.isPenHandwriting &&
        result.similarityScore !== null &&
        result.similarityScore >= PASS_MIN_SIMILARITY_SCORE;

      const completed = await this.writingRepository.markCompleted(session.id, {
        recognizedText: result.text,
        similarityScore: result.similarityScore,
        passed,
      });

      // 통과한 필사만 잔디/streak에 반영한다. 하루 경계는 서버 UTC 기준(MVP 단순화).
      if (completed.passed) {
        const todayUtc = new Date().toISOString().slice(0, 10);
        await this.statsService.recordWriting(session.userId, todayUtc);
      }
    } catch (error) {
      this.logger.error(`유사도 검사 실패: session=${session.id}`, error);
      try {
        await this.writingRepository.markFailed(session.id);
      } catch (markError) {
        this.logger.error(
          `failed 마킹조차 실패: session=${session.id}`,
          markError,
        );
      }
    }
  }
}
