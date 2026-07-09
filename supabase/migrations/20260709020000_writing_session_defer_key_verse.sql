-- 흐름 변경: key verse를 '세션 생성'이 아니라 '기록 저장(complete)' 시점에 고른다.
-- 그래서 생성 시엔 범위(book/chapter/start/end)+언어만 알고, key verse는 나중에 채운다.
-- 설계 근거: docs/DATABASE.md 3-3 결정(2026-07-09 흐름 A).
-- 실행: `supabase db push`
--
-- - book_no / chapter 추가: key verse가 아직 없으니, 범위의 앵커(어느 책·장)를 세션이 직접 들고 있어야 한다.
--   start/end_verse_no는 상대 번호라 book_no+chapter가 있어야 절대적 의미를 가진다.
-- - key_verse_id 를 nullable 로: 생성 시엔 비어 있고 complete 때 채워진다.
--
-- 개발 초기라 기존 세션 행은 보존 가치가 없어 비우고 컬럼을 조정한다.

truncate table public.writing_sessions;

alter table public.writing_sessions
  add column book_no smallint not null,
  add column chapter smallint not null,
  alter column key_verse_id drop not null;
