import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.constants';
import type { Env } from '../../config/env.validation';
import { WritingSession, WritingSessionStatus } from './writing.types';

/** public.writing_sessions 테이블의 행(snake_case). */
interface WritingSessionRow {
  id: string;
  user_id: string;
  verse_id: number;
  object_key: string;
  status: WritingSessionStatus;
  recognized_text: string | null;
  similarity_score: number | null;
  passed: boolean | null;
  created_at: string;
  completed_at: string | null;
}

/** DB 행(snake_case) → 앱 객체(camelCase) 변환. */
function toWritingSession(row: WritingSessionRow): WritingSession {
  return {
    id: row.id,
    userId: row.user_id,
    verseId: row.verse_id,
    objectKey: row.object_key,
    status: row.status,
    recognizedText: row.recognized_text,
    similarityScore: row.similarity_score,
    passed: row.passed,
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
    verseId: number;
    objectKey: string;
  }): Promise<WritingSession> {
    const { data, error } = await this.supabase
      .from('writing_sessions')
      .insert({
        id: input.id,
        user_id: input.userId,
        verse_id: input.verseId,
        object_key: input.objectKey,
      })
      .select('*')
      .single<WritingSessionRow>();

    if (error || !data) {
      throw new Error(`필사 세션 생성 실패: ${error?.message ?? '데이터 없음'}`);
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

  async markCompleted(
    id: string,
    result: {
      recognizedText: string;
      similarityScore: number;
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

  /** 주어진 object_key 경로에 대한 업로드용 presigned URL을 발급한다. */
  async createSignedUploadUrl(objectKey: string): Promise<{ signedUrl: string }> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(objectKey);

    if (error || !data) {
      throw new Error(`업로드 URL 발급 실패: ${error?.message ?? '데이터 없음'}`);
    }
    return { signedUrl: data.signedUrl };
  }
}
