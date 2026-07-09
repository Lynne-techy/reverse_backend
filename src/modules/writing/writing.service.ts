import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { StatsService } from '../stats/stats.service';
import { WritingRepository } from './writing.repository';
import { WritingLanguage, WritingSession } from './writing.types';

@Injectable()
export class WritingService {
  constructor(
    private readonly writingRepository: WritingRepository,
    private readonly statsService: StatsService,
  ) {}

  /** 업로드용 presigned URL을 발급하고, 그 대상 경로로 세션을 만든다. */
  async createUploadUrl(
    userId: string,
    verseId: number,
    language: WritingLanguage,
  ): Promise<{ sessionId: string; objectKey: string; uploadUrl: string }> {
    const sessionId = randomUUID();
    const objectKey = `${userId}/${sessionId}.jpg`;

    await this.writingRepository.create({
      id: sessionId,
      userId,
      verseId,
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
  async complete(userId: string, sessionId: string): Promise<WritingSession> {
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

    const completed = await this.writingRepository.markCompleted(sessionId, {
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
