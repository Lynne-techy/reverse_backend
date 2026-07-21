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

  /** id로 단일 verse 조회 (없으면 null). */
  async findById(id: number): Promise<Verse | null> {
    const { data, error } = await this.supabase
      .from('verses')
      .select('*')
      .eq('id', id)
      .maybeSingle<VerseRow>();

    if (error) {
      throw new Error(`verse 조회 실패: ${error.message}`);
    }
    return data ? toVerse(data) : null;
  }

  /**
   * 같은 책·장 안에서 verse_no가 [from, to]에 드는 절들을 오름차순으로 조회한다.
   * (번역본이 여러 개가 되면 translationCode로 좁혀야 하나, 현재는 단일 번역본.)
   */
  async findRange(
    bookNo: number,
    chapter: number,
    from: number,
    to: number,
  ): Promise<Verse[]> {
    const { data, error } = await this.supabase
      .from('verses')
      .select('*')
      .eq('book_no', bookNo)
      .eq('chapter', chapter)
      .gte('verse_no', from)
      .lte('verse_no', to)
      .order('verse_no', { ascending: true })
      .overrideTypes<VerseRow[], { merge: false }>();

    if (error) {
      throw new Error(`구절 범위 조회 실패: ${error.message}`);
    }
    return (data ?? []).map(toVerse);
  }

  /**
   * 감정 추천 후보 조회. emotion_verses(감정↔구절 큐레이션)를 verses 와 inner join 해
   * 주어진 번역본의 후보 절들을 모두 반환한다(감정당 ~30개). 무작위 N개 선별은 서비스가 한다.
   * `verses!inner` 라야 verses.translation_code 필터가 부모 행까지 걸러내는 진짜 inner join 이 된다.
   */
  async findEmotionVerseCandidates(
    emotionCode: string,
    translationCode: string,
  ): Promise<Verse[]> {
    // Database 타입 생성 없이 SupabaseClient 를 쓰는 탓에 중첩 select(verses!inner)의 반환
    // 타입 추론이 어긋난다. countVersesPerBook 과 같이 data 를 직접 단언한다.
    const { data, error } = await this.supabase
      .from('emotion_verses')
      .select('verses!inner(*)')
      .eq('emotion_code', emotionCode)
      .eq('verses.translation_code', translationCode);

    if (error) {
      throw new Error(`감정 추천 후보 조회 실패: ${error.message}`);
    }
    const rows = (data ?? []) as unknown as { verses: VerseRow }[];
    return rows.map((row) => toVerse(row.verses));
  }

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

  /**
   * 번역본의 book_no별 총 절수. 프로필 진척률(완필 판정) 계산의 비교 기준이다.
   * group by 집계는 `.from()`으로 표현할 수 없어 RPC(count_verses_per_book)로 조회한다.
   * 전체 절수(진척률 분모)는 이 Map 값들의 합으로 구하면 되므로 별도 조회는 두지 않는다.
   */
  async countVersesPerBook(
    translationCode: string,
  ): Promise<Map<number, number>> {
    // Database 타입 생성 없이 SupabaseClient를 쓰는 탓에 .rpc()의 반환 타입 추론이
    // (단일 객체로) 어긋나 overrideTypes/returns 체이닝이 통하지 않는다. data를 직접 단언한다.
    const { data, error } = await this.supabase.rpc('count_verses_per_book', {
      p_translation_code: translationCode,
    });

    if (error) {
      throw new Error(`책별 절수 집계 실패: ${error.message}`);
    }
    const rows = (data ?? []) as { book_no: number; verse_count: number }[];
    return new Map(rows.map((row) => [row.book_no, row.verse_count]));
  }
}
