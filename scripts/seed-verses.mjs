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
const DATA_FILE = new URL('../data/bible.json', import.meta.url);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 한 번의 upsert 요청에 담을 최대 행 수. 전체 성경(3만+건)을 한 방에 보내면
// payload 한도/타임아웃에 걸리므로 이 단위로 잘라 여러 번 보낸다.
const CHUNK_SIZE = 500;

// rows 한 덩어리를 upsert 한다. 대량 적재라 .select()로 되돌려 받지 않고
// count 옵션으로 반영된 행 수만 확인한다(응답을 가볍게 유지).
async function upsertChunk(rows) {
  const { error, count } = await supabase
    .from('verses')
    .upsert(rows, {
      onConflict: 'translation_code,book_no,chapter,verse_no',
      count: 'exact',
    });

  if (error) {
    console.error('시드 실패:', error.message);
    process.exit(1);
  }
  return count ?? rows.length;
}

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

  // rows 를 CHUNK_SIZE 단위로 잘라 순차 upsert. 각 배치를 await 로 기다려
  // 커넥션이 한꺼번에 몰리지 않게 하고, 진행 상황을 배치 단위로 출력한다.
  const totalBatches = Math.ceil(rows.length / CHUNK_SIZE);
  let total = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    total += await upsertChunk(chunk);

    const batchNo = i / CHUNK_SIZE + 1;
    console.log(`배치 ${batchNo}/${totalBatches} 완료 (누적 ${total}건)`);
  }

  console.log(`verses ${total}건 적재 완료 (총 ${rows.length}건 대상)`);
}

main().catch((err) => {
  console.error('시드 실패:', err.message ?? err);
  process.exit(1);
});
