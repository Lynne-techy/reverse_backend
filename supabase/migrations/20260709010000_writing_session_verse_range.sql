-- 필사 세션을 '단일 절'에서 '같은 장 내 절 범위 + 대표 절(key verse)'로 확장.
-- 설계 근거: docs/DATABASE.md 3-3 결정(2026-07-09 범위).
-- 실행: `supabase db push`
--
-- - verse_id → key_verse_id 로 이름 변경: 이제 이 FK는 '범위 중 마음에 새긴 대표 절'을 가리킨다.
--   범위의 book/chapter/translation 앵커 역할도 겸한다.
-- - start_verse_no / end_verse_no: 대표 절이 속한 '그 장' 안에서의 절 범위(같은 장 제한).
--   범위 절 = verses 중 (key verse와 같은 translation·book·chapter) + verse_no BETWEEN start AND end.
-- - check: start_verse_no <= end_verse_no.
--
-- 개발 초기라 기존 세션 행은 보존 가치가 없어 비우고 컬럼을 추가한다(not null 정합).

truncate table public.writing_sessions;

alter table public.writing_sessions rename column verse_id to key_verse_id;

alter table public.writing_sessions
  add column start_verse_no smallint not null,
  add column end_verse_no smallint not null,
  add constraint writing_sessions_verse_range_chk
    check (start_verse_no <= end_verse_no);
