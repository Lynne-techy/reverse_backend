import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.constants';
import type { Env } from '../../config/env.validation';
import {
  PassedWritingRange,
  WritingLanguage,
  WritingSession,
  WritingSessionStatus,
} from './writing.types';

/** public.writing_sessions 테이블의 행(snake_case). */
interface WritingSessionRow {
  id: string;
  user_id: string;
  book_no: number;
  chapter: number;
  start_verse_no: number;
  end_verse_no: number;
  key_verse_id: number | null;
  language: WritingLanguage;
  object_key: string;
  status: WritingSessionStatus;
  recognized_text: string | null;
  similarity_score: number | null;
  passed: boolean | null;
  client_date: string | null;
  created_at: string;
  completed_at: string | null;
}

/** DB 행(snake_case) → 앱 객체(camelCase) 변환. */
function toWritingSession(row: WritingSessionRow): WritingSession {
  return {
    id: row.id,
    userId: row.user_id,
    bookNo: row.book_no,
    chapter: row.chapter,
    startVerseNo: row.start_verse_no,
    endVerseNo: row.end_verse_no,
    keyVerseId: row.key_verse_id,
    language: row.language,
    objectKey: row.object_key,
    status: row.status,
    recognizedText: row.recognized_text,
    similarityScore: row.similarity_score,
    passed: row.passed,
    clientDate: row.client_date,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

/**
 * WritingSession 데이터 접근 계층. DB 쿼리와 Storage(업로드 URL 발급)를 함께 담당한다.
 */
@Injectable()
export class WritingRepository {
  private readonly bucket: string;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    config: ConfigService<Env, true>,
  ) {
    this.bucket = config.get('SUPABASE_STORAGE_BUCKET', { infer: true });
  }

  async create(input: {
    id: string;
    userId: string;
    bookNo: number;
    chapter: number;
    startVerseNo: number;
    endVerseNo: number;
    language: WritingLanguage;
    objectKey: string;
  }): Promise<WritingSession> {
    const { data, error } = await this.supabase
      .from('writing_sessions')
      .insert({
        id: input.id,
        user_id: input.userId,
        book_no: input.bookNo,
        chapter: input.chapter,
        start_verse_no: input.startVerseNo,
        end_verse_no: input.endVerseNo,
        language: input.language,
        object_key: input.objectKey,
      })
      .select('*')
      .single<WritingSessionRow>();

    if (error || !data) {
      throw new Error(
        `필사 세션 생성 실패: ${error?.message ?? '데이터 없음'}`,
      );
    }
    return toWritingSession(data);
  }

  async findById(id: string): Promise<WritingSession | null> {
    const { data, error } = await this.supabase
      .from('writing_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle<WritingSessionRow>();

    if (error) {
      throw new Error(`필사 세션 조회 실패: ${error.message}`);
    }
    return data ? toWritingSession(data) : null;
  }

  /**
   * 유사도 검사를 위해 세션을 원자적으로 선점한다.
   * `status in (fromStatuses)` 조건이 걸린 update라 동시 요청 중 한쪽만 성공하고,
   * 나머지는 null을 받는다 (check-then-act 경쟁 방지). key verse와 client_date
   * (잔디/streak 기준일)도 이 시점에 확정된다 — 재시도 complete가 새 날짜로
   * 들어오면 마지막 요청의 값으로 덮어쓴다.
   */
  async claimForProcessing(
    id: string,
    keyVerseId: number,
    clientDate: string,
    fromStatuses: WritingSessionStatus[],
  ): Promise<WritingSession | null> {
    const { data, error } = await this.supabase
      .from('writing_sessions')
      .update({
        status: 'processing',
        key_verse_id: keyVerseId,
        client_date: clientDate,
      })
      .eq('id', id)
      .in('status', fromStatuses)
      .select('*')
      .maybeSingle<WritingSessionRow>();

    if (error) {
      throw new Error(`필사 세션 선점 실패: ${error.message}`);
    }
    return data ? toWritingSession(data) : null;
  }

  async markCompleted(
    id: string,
    result: {
      recognizedText: string | null;
      similarityScore: number | null;
      passed: boolean;
    },
  ): Promise<WritingSession> {
    const { data, error } = await this.supabase
      .from('writing_sessions')
      .update({
        status: 'completed',
        recognized_text: result.recognizedText,
        similarity_score: result.similarityScore,
        passed: result.passed,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single<WritingSessionRow>();

    if (error || !data) {
      throw new Error(
        `필사 세션 완료 처리 실패: ${error?.message ?? '데이터 없음'}`,
      );
    }
    return toWritingSession(data);
  }

  /** 검사 도중 오류가 난 세션을 failed로 표시한다. failed는 complete 재시도가 가능하다. */
  async markFailed(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('writing_sessions')
      .update({ status: 'failed' })
      .eq('id', id);

    if (error) {
      throw new Error(`필사 세션 실패 처리 실패: ${error.message}`);
    }
  }

  /**
   * processing 상태로 남은 세션을 일괄 failed 처리한다. 서버가 검사 도중 죽으면
   * processing이 영구히 남으므로 부팅 시 정리한다. 단일 인스턴스 전제 —
   * 다중 인스턴스가 되면 다른 인스턴스의 진행 중 검사를 죽이므로 이 방식을 버리고
   * 타임스탬프 기반 스윕으로 바꿔야 한다.
   */
  async failStaleProcessing(): Promise<void> {
    const { error } = await this.supabase
      .from('writing_sessions')
      .update({ status: 'failed' })
      .eq('status', 'processing');

    if (error) {
      throw new Error(`잔류 processing 세션 정리 실패: ${error.message}`);
    }
  }

  /**
   * 진척률 계산용 — 통과(passed=true)한 세션들의 필사 범위만 조회한다.
   * (progress-calculator.ts의 calculateProgress 입력)
   */
  async findPassedRangesByUser(userId: string): Promise<PassedWritingRange[]> {
    const { data, error } = await this.supabase
      .from('writing_sessions')
      .select('book_no, chapter, start_verse_no, end_verse_no')
      .eq('user_id', userId)
      .eq('passed', true)
      .overrideTypes<
        Pick<
          WritingSessionRow,
          'book_no' | 'chapter' | 'start_verse_no' | 'end_verse_no'
        >[],
        { merge: false }
      >();

    if (error) {
      throw new Error(`통과 필사 범위 조회 실패: ${error.message}`);
    }
    return (data ?? []).map((row) => ({
      bookNo: row.book_no,
      chapter: row.chapter,
      startVerseNo: row.start_verse_no,
      endVerseNo: row.end_verse_no,
    }));
  }

  /** Storage에서 필사 이미지를 내려받는다 (백그라운드 유사도 검사용). */
  async downloadImage(
    objectKey: string,
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(objectKey);

    if (error || !data) {
      throw new Error(
        `필사 이미지 다운로드 실패: ${error?.message ?? '데이터 없음'}`,
      );
    }
    return {
      buffer: Buffer.from(await data.arrayBuffer()),
      mimetype: data.type || 'image/jpeg',
    };
  }

  /** 주어진 object_key 경로에 대한 업로드용 presigned URL을 발급한다. */
  async createSignedUploadUrl(
    objectKey: string,
  ): Promise<{ signedUrl: string }> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(objectKey);

    if (error || !data) {
      throw new Error(
        `업로드 URL 발급 실패: ${error?.message ?? '데이터 없음'}`,
      );
    }
    return { signedUrl: data.signedUrl };
  }
}
