-- 필사 세션에 필사 언어(language) 컬럼 추가.
-- 설계 근거: docs/DATABASE.md 3-3 결정(2026-07-09) 참고.
-- 실행: `supabase db push`
--
-- 사용자가 업로드 전에 ko(한국어) / en(영어) 중 하나를 선택한다. 프로토타입의 '병행'
-- 모드는 제외했다. language는 이후 Gemini 유사도 검사가 어느 번역본과 대조할지 판단하는
-- 근거로도 쓰인다.
--
-- 컬럼은 not null + check 제약으로 둔다: DTO(@IsIn)가 이미 값을 검증하지만, API로 들어오는
-- 사용자 입력이라 DB에도 방어선을 함께 둔다. not null 로 두어 리포지토리 타입(WritingLanguage,
-- non-null)과 일치시킨다. 개발 초기라 기존 세션 행은 보존 가치가 없어 비우고 추가한다.
-- (writing_sessions를 참조하는 FK 없음 — 안전하게 truncate 가능)

truncate table public.writing_sessions;
alter table public.writing_sessions
  add column language text not null check (language in ('ko', 'en'));