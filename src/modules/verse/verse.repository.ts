import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.constants';
import { Verse } from './verse.types';

/** public.verses 테이블의 행(snake_case). */
interface VerseRow {
  id: number;
  translation_code: string;
  book_no: number;
  book_name: string;
  chapter: number;
  verse_no: number;
  text: string;
  created_at: string;
}

/** DB 행(snake_case) → 앱 객체(camelCase) 변환. */
function toVerse(row: VerseRow): Verse {
  return {
    id: row.id,
    translationCode: row.translation_code,
    bookNo: row.book_no,
    bookName: row.book_name,
    chapter: row.chapter,
    verseNo: row.verse_no,
    text: row.text,
    createdAt: row.created_at,
  };
}

/**
 * Verse / daily_verses 데이터 접근 계층. Supabase 쿼리만 담당한다.
 */
@Injectable()
export class VerseRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /** 주어진 날짜에 배정된 오늘의 말씀 조회 (없으면 null). */
  async findDailyVerseByDate(date: string): Promise<Verse | null> {
    const { data, error } = await this.supabase
      .from('daily_verses')
      .select('verses(*)')
      .eq('activity_date', date)
      .maybeSingle<{ verses: VerseRow }>();

    if (error) {
      throw new Error(`오늘의 말씀 조회 실패: ${error.message}`);
    }
    return data ? toVerse(data.verses) : null;
  }

  /** verses 중 하나를 무작위로 조회한다. */
  async findRandomVerse(): Promise<Verse> {
    const { count, error: countError } = await this.supabase
      .from('verses')
      .select('*', { count: 'exact', head: true });

    if (countError || !count) {
      throw new Error(
        `verses 카운트 조회 실패: ${countError?.message ?? '데이터 없음'}`,
      );
    }

    const offset = Math.floor(Math.random() * count);
    const { data, error } = await this.supabase
      .from('verses')
      .select('*')
      .range(offset, offset)
      .single<VerseRow>();

    if (error || !data) {
      throw new Error(`랜덤 verse 조회 실패: ${error?.message ?? '데이터 없음'}`);
    }
    return toVerse(data);
  }

  /**
   * 주어진 날짜에 verse를 배정한다. 이미 배정돼 있으면 조용히 무시한다
   * (동시 요청 레이스 — 먼저 들어온 배정을 그대로 유지).
   */
  async assignDailyVerseIfAbsent(date: string, verseId: number): Promise<void> {
    const { error } = await this.supabase.from('daily_verses').upsert(
      { activity_date: date, verse_id: verseId },
      { onConflict: 'activity_date', ignoreDuplicates: true },
    );

    if (error) {
      throw new Error(`오늘의 말씀 배정 실패: ${error.message}`);
    }
  }
}
