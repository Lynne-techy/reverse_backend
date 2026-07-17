import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ConcurrencyLimiter } from '../../common/concurrency-limiter';
import type { Env } from '../../config/env.validation';
import { HandwritingCheckService } from '../handwriting-check/handwriting-check.service';
import { StatsService } from '../stats/stats.service';
import { VerseService } from '../verse/verse.service';
import { calculateProgress, ProgressSnapshot } from './progress-calculator';
import { WritingRepository } from './writing.repository';
import {
  PASS_MIN_SIMILARITY_SCORE,
  QtInput,
  WritingLanguage,
  WritingListItem,
  WritingSession,
  WritingSessionStatus,
} from './writing.types';

/** complete로 검사를 시작할 수 있는 상태. failed를 포함해 재시도를 허용한다. */
const CLAIMABLE_STATUSES: WritingSessionStatus[] = [
  'pending',
  'uploaded',
  'failed',
];

/** 진척률 분모로 쓸 기준 번역본. 다중 번역본 지원 전까지 단일 하드코딩. */
const DEFAULT_TRANSLATION_CODE = 'KO_GAEGAEJEONG';

@Injectable()
export class WritingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WritingService.name);

  /**
   * 백그라운드 유사도 검사의 동시 실행 상한. 각 검사가 이미지 버퍼 + base64 사본을
   * 메모리에 들고 Gemini를 호출하므로, 업로드 폭주 시 병렬 개수를 제한해 메모리를 보호한다.
   */
  private readonly similarityLimiter: ConcurrencyLimiter;

  constructor(
    private readonly writingRepository: WritingRepository,
    private readonly statsService: StatsService,
    private readonly verseService: VerseService,
    private readonly handwritingCheckService: HandwritingCheckService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.similarityLimiter = new ConcurrencyLimiter(
      this.config.get('SIMILARITY_MAX_CONCURRENCY', { infer: true }),
    );
  }

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
   * 내 진척률(완필 권수/전체 진척/점등 절수)을 계산한다.
   * 통과한 필사 범위(주소 기준, 번역본 무관)를 기준 번역본의 절수와 대조한다 —
   * 같은 절을 여러 언어로 필사해도 주소가 같으면 하나로 dedupe된다(정경 커버리지).
   */
  async getMyProgress(userId: string): Promise<ProgressSnapshot> {
    const passedRanges =
      await this.writingRepository.findPassedRangesByUser(userId);
    const verseTotals = await this.verseService.countVersesPerBook(
      DEFAULT_TRANSLATION_CODE,
    );
    return calculateProgress(passedRanges, verseTotals);
  }

  /**
   * 내 필사 기록 목록(통과분만, 최신순). 홈 "최근 필사 기록"·타임라인 화면용 —
   * 날짜 그룹핑·건수 카운트는 프론트 몫이라 flat 목록으로 준다. 접근 제어는
   * repository 쿼리의 user_id 필터가 담당하므로 여기서 추가 검사는 없다.
   */
  async listMyWritings(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<WritingListItem[]> {
    return this.writingRepository.findPassedListByUser(userId, limit, offset);
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
    clientDate: string,
    qt: QtInput,
  ): Promise<WritingSession> {
    // clientDate(클라이언트 로컬 날짜)가 잔디/streak의 기록 기준일이 된다.
    // DTO 정규식은 형식만 보장하므로 2026-02-31처럼 실존하지 않는 날짜를 여기서
    // 거른다. 값 자체는 클라이언트 신고를 그대로 신뢰한다(MVP 단순화).
    const parsedDate = new Date(`${clientDate}T00:00:00Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== clientDate
    ) {
      throw new BadRequestException('date가 실존하지 않는 날짜입니다.');
    }

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
      clientDate,
      {
        meditation: this.normalizeQtText(qt.meditation),
        application: this.normalizeQtText(qt.application),
        prayer: this.normalizeQtText(qt.prayer),
      },
      CLAIMABLE_STATUSES,
    );
    if (!claimed) {
      // 위의 상태 검사 이후 동시 요청이 먼저 선점한 경우.
      throw new ConflictException('이미 처리 중이거나 완료된 세션입니다.');
    }

    // 백그라운드 검사는 동시성 상한(SIMILARITY_MAX_CONCURRENCY) 안에서 실행한다.
    // 한도를 넘으면 큐에 쌓였다가 슬롯이 날 때 실행돼, 업로드 폭주 시 이미지 버퍼가
    // 메모리에 무제한으로 누적되는 것을 막는다. 세션은 이미 processing으로 선점돼
    // 있으므로 클라이언트 폴링에는 (대기 중이든 실행 중이든) 동일하게 보인다.
    // 의도적으로 await하지 않는다. processSimilarity가 내부에서 모든 오류를 삼켜
    // run()도 reject되지 않으므로 unhandled rejection이 없다.
    if (this.similarityLimiter.pending > 0) {
      this.logger.debug(
        `유사도 검사 대기열 ${this.similarityLimiter.pending}건 (동시성 상한 도달)`,
      );
    }
    void this.similarityLimiter.run(() =>
      this.processSimilarity(claimed, clientDate),
    );

    return claimed;
  }

  /**
   * QT(묵상/적용/기도제목) 입력을 저장용 값으로 정규화한다.
   * DTO 검증은 형식(문자열, 500자)만 보장하므로, "사실상 미작성"인 입력을
   * 여기서 null로 통일한다 — 최근 필사 기록 화면의 "(묵상 미작성)" 판단이
   * null 여부에 의존하기 때문이다.
   */
  private normalizeQtText(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  /**
   * 백그라운드 유사도 검사. Storage의 이미지와 필사 범위 원문을 Gemini로 대조해
   * completed(통과/불통과) 또는 failed(검사 자체 실패, 재시도 가능)로 마감한다.
   */
  /**
   * @param clientDate 잔디/streak 기준일. claim 시점에 세션의 client_date로도
   *   저장된다("그날 뭘 필사했는지" 역추적용 — 스트릭 시작 배너 등). 검사 흐름
   *   자체는 세션을 다시 읽지 않도록 메모리 값을 그대로 쓴다.
   */
  private async processSimilarity(
    session: WritingSession,
    clientDate: string,
  ): Promise<void> {
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

      // 통과한 필사만 잔디/streak에 반영한다. 기준일은 클라이언트 로컬 날짜
      // (complete 요청의 clientDate) — 사용자가 체감하는 "오늘"에 잔디가 칠해진다.
      if (completed.passed) {
        await this.statsService.recordWriting(session.userId, clientDate);
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
