// 개발용: book_infos(성경 각 권 배경 정보) 참조 데이터를 DB에 적재한다.
// 데이터 소스(JSON)를 읽어 supabase-js 로 upsert 한다. seed-verses.mjs 와 동일한 구조.
//
// 실행: node --env-file=.env scripts/seed-books.mjs
//
// book_infos 는 참조 데이터라 스키마(마이그레이션)와 분리해 여기서 채운다.
// PK(translation_code, book_no) 기준 upsert 라 재실행해도 중복이 없다(멱등).

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. --env-file=.env 로 실행하세요.');
  process.exit(1);
}

// 데이터 파일(스크립트 기준 상대경로). 대표 5권 → 66권 전체로 확장 시 이 파일만 교체.
const DATA_FILE = new URL('../data/books.json', import.meta.url);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const raw = await readFile(DATA_FILE, 'utf-8');
  const books = JSON.parse(raw);

  const rows = books.map((b) => ({
    translation_code: b.translation_code,
    book_no: b.book_no,
    book_name: b.book_name,
    summary: b.summary,
    author: b.author,
    written_period: b.written_period,
    written_place: b.written_place,
    audience: b.audience,
    core_theme: b.core_theme,
    youtube_url: b.youtube_url,
  }));

  const { error, count } = await supabase
    .from('book_infos')
    .upsert(rows, { onConflict: 'translation_code,book_no', count: 'exact' });

  if (error) {
    console.error('시드 실패:', error.message);
    process.exit(1);
  }

  console.log(`book_infos ${count ?? rows.length}건 적재 완료 (총 ${rows.length}건 대상)`);
}

main().catch((err) => {
  console.error('시드 실패:', err.message ?? err);
  process.exit(1);
});
