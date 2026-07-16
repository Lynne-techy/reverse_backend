import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { HandwritingCheckService } from '../handwriting-check/handwriting-check.service';
import { HandwritingCheckResult } from '../handwriting-check/handwriting-check.types';
import { StatsService } from '../stats/stats.service';
import { VerseService } from '../verse/verse.service';
import { Verse } from '../verse/verse.types';
import { WritingRepository } from './writing.repository';
import { WritingService } from './writing.service';
import { WritingSession } from './writing.types';

/** fire-and-forget으로 시작된 백그라운드 검사가 끝날 때까지 이벤트 루프를 비운다. */
const flushBackgroundJobs = () =>
  new Promise((resolve) => setImmediate(resolve));

/** complete 요청에 실리는 클라이언트 로컬 날짜. 잔디/streak 기준일이 된다. */
const clientDate = '2026-07-12';

const baseSession: WritingSession = {
  id: 'session-1',
  userId: 'user-1',
  bookNo: 20,
  chapter: 4,
  startVerseNo: 20,
  endVerseNo: 27,
  keyVerseId: null,
  language: 'ko',
  objectKey: 'user-1/session-1.jpg',
  status: 'pending',
  recognizedText: null,
  similarityScore: null,
  passed: null,
  createdAt: '2026-07-12T00:00:00Z',
  completedAt: null,
};

const keyVerse: Verse = {
  id: 7,
  translationCode: 'KRV',
  bookNo: 20,
  bookName: '잠언',
  chapter: 4,
  verseNo: 23,
  text: '모든 지킬 만한 것 중에 더욱 네 마음을 지키라',
  createdAt: '2026-07-01T00:00:00Z',
};

const passingCheckResult: HandwritingCheckResult = {
  isPenHandwriting: true,
  text: '모든 지킬 만한 것 중에 더욱 네 마음을 지키라',
  similarityScore: 92,
  scriptureReference: '잠언 4:23',
  confidence: 'high',
  notes: null,
};

describe('WritingService', () => {
  let repository: jest.Mocked<
    Pick<
      WritingRepository,
      | 'findById'
      | 'claimForProcessing'
      | 'markCompleted'
      | 'markFailed'
      | 'failStaleProcessing'
      | 'downloadImage'
    >
  >;
  let statsService: jest.Mocked<Pick<StatsService, 'recordWriting'>>;
  let verseService: jest.Mocked<Pick<VerseService, 'findById' | 'getRange'>>;
  let handwritingCheckService: jest.Mocked<
    Pick<HandwritingCheckService, 'checkAndLog'>
  >;
  let service: WritingService;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      claimForProcessing: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
      failStaleProcessing: jest.fn(),
      downloadImage: jest.fn(),
    };
    statsService = { recordWriting: jest.fn() };
    verseService = { findById: jest.fn(), getRange: jest.fn() };
    handwritingCheckService = { checkAndLog: jest.fn() };

    const config = {
      get: jest.fn().mockReturnValue(3), // SIMILARITY_MAX_CONCURRENCY
    } as unknown as ConfigService<Env, true>;

    service = new WritingService(
      repository as unknown as WritingRepository,
      statsService as unknown as StatsService,
      verseService as unknown as VerseService,
      handwritingCheckService as unknown as HandwritingCheckService,
      config,
    );

    // 정상 경로 기본값. 개별 테스트에서 필요한 부분만 덮어쓴다.
    repository.findById.mockResolvedValue(baseSession);
    verseService.findById.mockResolvedValue(keyVerse);
    verseService.getRange.mockResolvedValue([keyVerse]);
    repository.claimForProcessing.mockResolvedValue({
      ...baseSession,
      status: 'processing',
      keyVerseId: keyVerse.id,
    });
    repository.downloadImage.mockResolvedValue({
      buffer: Buffer.from('image-bytes'),
      mimetype: 'image/jpeg',
    });
    handwritingCheckService.checkAndLog.mockResolvedValue(passingCheckResult);
    repository.markCompleted.mockImplementation((id, result) =>
      Promise.resolve({
        ...baseSession,
        status: 'completed',
        keyVerseId: keyVerse.id,
        recognizedText: result.recognizedText,
        similarityScore: result.similarityScore,
        passed: result.passed,
      }),
    );
  });

  describe('complete', () => {
    it('세션이 없으면 404', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(
        service.complete('user-1', 'session-1', keyVerse.id, clientDate),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('실존하지 않는 날짜면 400 (형식은 DTO 정규식을 통과하는 값)', async () => {
      await expect(
        service.complete('user-1', 'session-1', keyVerse.id, '2026-02-31'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.claimForProcessing).not.toHaveBeenCalled();
    });

    it('남의 세션이면 403', async () => {
      await expect(
        service.complete('other-user', 'session-1', keyVerse.id, clientDate),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('이미 완료된 세션이면 409', async () => {
      repository.findById.mockResolvedValue({
        ...baseSession,
        status: 'completed',
      });
      await expect(
        service.complete('user-1', 'session-1', keyVerse.id, clientDate),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('검사가 진행 중이면 409', async () => {
      repository.findById.mockResolvedValue({
        ...baseSession,
        status: 'processing',
      });
      await expect(
        service.complete('user-1', 'session-1', keyVerse.id, clientDate),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('key verse가 없으면 404', async () => {
      verseService.findById.mockResolvedValue(null);
      await expect(
        service.complete('user-1', 'session-1', 999, clientDate),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('key verse가 필사 범위 밖이면 400', async () => {
      verseService.findById.mockResolvedValue({ ...keyVerse, verseNo: 1 });
      await expect(
        service.complete('user-1', 'session-1', keyVerse.id, clientDate),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('동시 요청이 먼저 선점해 클레임이 비면 409', async () => {
      repository.claimForProcessing.mockResolvedValue(null);
      await expect(
        service.complete('user-1', 'session-1', keyVerse.id, clientDate),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('선점 후 processing 세션을 즉시 반환한다', async () => {
      const result = await service.complete('user-1', 'session-1', keyVerse.id, clientDate);

      expect(result.status).toBe('processing');
      expect(repository.claimForProcessing).toHaveBeenCalledWith(
        'session-1',
        keyVerse.id,
        ['pending', 'uploaded', 'failed'],
      );
      await flushBackgroundJobs();
    });

    it('통과 점수면 completed(passed=true)로 마감하고 잔디/streak에 반영한다', async () => {
      await service.complete('user-1', 'session-1', keyVerse.id, clientDate);
      await flushBackgroundJobs();

      expect(handwritingCheckService.checkAndLog).toHaveBeenCalledWith(
        expect.objectContaining({ mimetype: 'image/jpeg' }),
        keyVerse.text,
      );
      expect(repository.markCompleted).toHaveBeenCalledWith('session-1', {
        recognizedText: passingCheckResult.text,
        similarityScore: 92,
        passed: true,
      });
      // 잔디 기준일은 서버 시간이 아니라 요청에 실린 클라이언트 로컬 날짜다.
      expect(statsService.recordWriting).toHaveBeenCalledWith(
        'user-1',
        clientDate,
      );
    });

    it('점수 미달이면 passed=false로 마감하고 잔디에 반영하지 않는다', async () => {
      handwritingCheckService.checkAndLog.mockResolvedValue({
        ...passingCheckResult,
        similarityScore: 40,
      });

      await service.complete('user-1', 'session-1', keyVerse.id, clientDate);
      await flushBackgroundJobs();

      expect(repository.markCompleted).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ passed: false }),
      );
      expect(statsService.recordWriting).not.toHaveBeenCalled();
    });

    it('펜 손글씨가 아니면 점수와 무관하게 passed=false', async () => {
      handwritingCheckService.checkAndLog.mockResolvedValue({
        ...passingCheckResult,
        isPenHandwriting: false,
      });

      await service.complete('user-1', 'session-1', keyVerse.id, clientDate);
      await flushBackgroundJobs();

      expect(repository.markCompleted).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ passed: false }),
      );
      expect(statsService.recordWriting).not.toHaveBeenCalled();
    });

    it('점수가 null(판독 불가)이면 passed=false', async () => {
      handwritingCheckService.checkAndLog.mockResolvedValue({
        ...passingCheckResult,
        similarityScore: null,
      });

      await service.complete('user-1', 'session-1', keyVerse.id, clientDate);
      await flushBackgroundJobs();

      expect(repository.markCompleted).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ passed: false, similarityScore: null }),
      );
      expect(statsService.recordWriting).not.toHaveBeenCalled();
    });

    it('Gemini 호출이 실패하면 세션을 failed로 남긴다(재시도 가능)', async () => {
      handwritingCheckService.checkAndLog.mockRejectedValue(
        new Error('Gemini down'),
      );

      await service.complete('user-1', 'session-1', keyVerse.id, clientDate);
      await flushBackgroundJobs();

      expect(repository.markFailed).toHaveBeenCalledWith('session-1');
      expect(repository.markCompleted).not.toHaveBeenCalled();
      expect(statsService.recordWriting).not.toHaveBeenCalled();
    });

    it('범위 원문이 비어 있으면 failed로 남긴다', async () => {
      verseService.getRange.mockResolvedValue([]);

      await service.complete('user-1', 'session-1', keyVerse.id, clientDate);
      await flushBackgroundJobs();

      expect(repository.markFailed).toHaveBeenCalledWith('session-1');
      expect(repository.markCompleted).not.toHaveBeenCalled();
    });

    it('failed 세션은 complete 재시도를 허용한다', async () => {
      repository.findById.mockResolvedValue({
        ...baseSession,
        status: 'failed',
      });

      const result = await service.complete('user-1', 'session-1', keyVerse.id, clientDate);

      expect(result.status).toBe('processing');
      await flushBackgroundJobs();
    });
  });

  describe('getById', () => {
    it('세션이 없으면 404', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getById('user-1', 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('남의 세션이면 403', async () => {
      await expect(
        service.getById('other-user', 'session-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('본인 세션이면 그대로 반환한다', async () => {
      await expect(service.getById('user-1', 'session-1')).resolves.toEqual(
        baseSession,
      );
    });
  });

  describe('onApplicationBootstrap', () => {
    it('잔류 processing 세션을 정리한다', async () => {
      await service.onApplicationBootstrap();
      expect(repository.failStaleProcessing).toHaveBeenCalled();
    });

    it('정리 실패가 부팅을 막지 않는다', async () => {
      repository.failStaleProcessing.mockRejectedValue(new Error('db down'));
      await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    });
  });
});
