import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.constants';
import { Book } from './books.types';

/** public.book_infos 테이블의 행(snake_case). */
interface BookInfoRow {
  translation_code: string;
  book_no: number;
  book_name: string;
  summary: string;
  author: string | null;
  written_period: string | null;
  written_place: string | null;
  audience: string | null;
  core_theme: string | null;
  youtube_url: string | null;
  created_at: string;
}

/** DB 행(snake_case) → 앱 객체(camelCase) 변환. */
function toBook(row: BookInfoRow): Book {
  return {
    translationCode: row.translation_code,
    bookNo: row.book_no,
    bookName: row.book_name,
    summary: row.summary,
    author: row.author,
    writtenPeriod: row.written_period,
    writtenPlace: row.written_place,
    audience: row.audience,
    coreTheme: row.core_theme,
    youtubeUrl: row.youtube_url,
  };
}

/**
 * 책 배경 정보 데이터 접근 계층. Supabase 쿼리만 담당한다.
 */
@Injectable()
export class BooksRepository {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /** (translationCode, bookNo)로 단일 책 배경 정보 조회 (없으면 null). */
  async findByBookNo(
    translationCode: string,
    bookNo: number,
  ): Promise<Book | null> {
    const { data, error } = await this.supabase
      .from('book_infos')
      .select('*')
      .eq('translation_code', translationCode)
      .eq('book_no', bookNo)
      .maybeSingle<BookInfoRow>();

    if (error) {
      throw new Error(`책 배경 정보 조회 실패: ${error.message}`);
    }
    return data ? toBook(data) : null;
  }
}
