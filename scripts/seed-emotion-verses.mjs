// 개발용: emotion_verses(감정↔구절 큐레이션) 데이터를 DB에 적재한다.
// data/emotion-verses.json 의 좌표(book_no/chapter/verse_no)를 verses(개역개정)에서 조회해
// verse_id 로 바꾼 뒤 emotion_verses 에 upsert 한다. seed-verses.mjs / seed-books.mjs 와 같은 구조.
//
// 실행: node --env-file=.env scripts/seed-emotion-verses.mjs
//
// 좌표는 "번역본 독립 자연키"이고, DB에 실제로 있어야 verse_id 를 얻는다. 없는 좌표(미스)는
// 스킵하고 경고로 모아 마지막에 출력한다 — 이 미스 목록이 곧 개역개정 커버리지 리포트다.
// PK(emotion_code, verse_id) 기준 upsert 라 재실행해도 중복이 없다(멱등).

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다. --env-file=.env 로 실행하세요.',
  );
  process.exit(1);
}

// 지금은 개역개정 단일 번역본. 번역본이 늘면 이 값을 인자로 받아 번역본별로 재적재한다.
const TRANSLATION_CODE = 'KO_GAEGAEJEONG';
const DATA_FILE = new URL('../data/emotion-verses.json', import.meta.url);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 좌표 하나를 verses(개역개정)에서 조회해 verse_id 를 반환한다. 없으면 null.
async function resolveVerseId({ book_no, chapter, verse_no }) {
  const { data, error } = await supabase
    .from('verses')
    .select('id')
    .eq('translation_code', TRANSLATION_CODE)
    .eq('book_no', book_no)
    .eq('chapter', chapter)
    .eq('verse_no', verse_no)
    .maybeSingle();

  if (error) {
    throw new Error(
      `verse 조회 실패(${book_no}:${chapter}:${verse_no}): ${error.message}`,
    );
  }
  return data ? data.id : null;
}

async function main() {
  const raw = await readFile(DATA_FILE, 'utf-8');
  const { _comment, ...emotions } = JSON.parse(raw); // _comment 키는 버린다

  const rows = []; // emotion_verses 에 넣을 { emotion_code, verse_id }
  const missing = []; // DB에 없어 스킵한 { emotion_code, ref }

  // TODO(human): emotions 를 순회하며 각 좌표를 resolveVerseId 로 verse_id 로 바꾼다.
  //   emotions 는 { depression: [ {ref, book_no, chapter, verse_no}, ... ], fear: [...], ... } 형태.
  //   찾으면 rows.push({ emotion_code, verse_id }), 못 찾으면 missing 에 모으고 경고를 남긴다.
  for (const [emotion_code, coords] of Object.entries(emotions)) {
    for (const coord of coords) {
      const verseId = await resolveVerseId({
        book_no: coord.book_no,
        chapter: coord.chapter,
        verse_no: coord.verse_no,
      });

      verseId
        ? rows.push({ emotion_code, verse_id: verseId })
        : missing.push({ emotion_code, ref: coord.ref });
    }
  }

  if (rows.length > 0) {
    const { error, count } = await supabase
      .from('emotion_verses')
      .upsert(rows, { onConflict: 'emotion_code,verse_id', count: 'exact' });

    if (error) {
      console.error('시드 실패:', error.message);
      process.exit(1);
    }
    console.log(
      `emotion_verses ${count ?? rows.length}건 적재 완료 (대상 ${rows.length}건).`,
    );
  } else {
    console.warn(
      '적재할 행이 없습니다. verses 에 개역개정 데이터가 있는지 확인하세요.',
    );
  }

  if (missing.length > 0) {
    console.warn(`\n미스 ${missing.length}건 (DB에 없어 스킵):`);
    for (const m of missing) {
      console.warn(`  - [${m.emotion_code}] ${m.ref}`);
    }
  }
}

main().catch((err) => {
  console.error('시드 실패:', err.message ?? err);
  process.exit(1);
});
