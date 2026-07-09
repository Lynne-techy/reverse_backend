// 개발용: verses(성경 구절) 참조 데이터를 DB에 적재한다.
// 데이터 소스(JSON)를 읽어 supabase-js 로 bulk upsert 한다.
// 미니 시드든 전체 성경이든 동일한 경로 — DATA_FILE 만 갈아끼우면 확장된다.
//
// 실행: node --env-file=.env scripts/seed-verses.mjs
//
// verses 는 참조 데이터라 스키마(마이그레이션)와 분리해 여기서 채운다.
// UNIQUE(translation_code, book_no, chapter, verse_no) 기준 upsert 라 재실행해도 중복이 없다(멱등).

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. --env-file=.env 로 실행하세요.');
  process.exit(1);
}

// 데이터 파일(스크립트 기준 상대경로). 전체 성경으로 확장 시 이 파일만 교체.
const DATA_FILE = new URL('../data/verses.sample.json', import.meta.url);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const raw = await readFile(DATA_FILE, 'utf-8');
  const verses = JSON.parse(raw);

  const rows = verses.map((v) => ({
    translation_code: v.translation_code,
    book_no: v.book_no,
    book_name: v.book_name,
    chapter: v.chapter,
    verse_no: v.verse_no,
    text: v.text,
  }));

  const { data, error } = await supabase
    .from('verses')
    .upsert(rows, { onConflict: 'translation_code,book_no,chapter,verse_no' })
    .select('id, book_name, chapter, verse_no');

  if (error) {
    console.error('시드 실패:', error.message);
    process.exit(1);
  }

  console.log(`verses ${data.length}건 적재 완료:`);
  for (const r of data) {
    console.log(`  #${r.id} ${r.book_name} ${r.chapter}:${r.verse_no}`);
  }
}

main().catch((err) => {
  console.error('시드 실패:', err.message ?? err);
  process.exit(1);
});
