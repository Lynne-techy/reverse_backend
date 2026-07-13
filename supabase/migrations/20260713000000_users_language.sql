-- users 에 기본 언어 설정(language) 컬럼 추가.
-- 설계 근거: docs/DATABASE.md 3-1 users (프로필 언어 설정).
-- 실행: `supabase db push`
--
-- - 프로필 화면의 "언어 설정"(한국어/영어)을 담는다. 기존 writing_sessions.language 는
--   '그 필사에 어떤 번역본으로 썼나'라 세션별이고, 이 컬럼은 '유저의 기본 선호'로 성격이 다르다.
-- - users 는 auth.users / 여러 테이블이 참조하는 FK 앵커라 truncate 가 위험하다.
--   따라서 기존 행을 비우지 않고 default 'ko' 로 안전하게 추가한다(기존 행은 자동으로 'ko').
-- - check 로 앱 DTO(@IsIn)와 이중 방어선을 둔다.

alter table public.users
  add column language text not null default 'ko' check (language in ('ko', 'en'));
