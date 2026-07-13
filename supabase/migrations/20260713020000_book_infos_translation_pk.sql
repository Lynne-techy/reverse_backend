-- book_infos PK 확장: book_no 단일 PK → (translation_code, book_no) 복합 PK.
-- 설계 근거: 메모리 project_book_infos_translation_pk / docs/DATABASE.md verses translation_code 체계.
-- 20260713010000_book_infos.sql 이 이미 원격 반영된 상태라 별도 마이그레이션으로 추가한다.
-- 실행: `supabase db push`
--
-- book_infos 는 신뢰된 시딩 스크립트로만 채워지는 참조 데이터라, 기존 66행(KO_GAEGAEJEONG)을
-- 백필한 뒤 PK를 교체해도 안전하다(FK로 참조하는 테이블 없음).

alter table public.book_infos
  add column translation_code text;

update public.book_infos
  set translation_code = 'KO_GAEGAEJEONG'
  where translation_code is null;

alter table public.book_infos
  alter column translation_code set not null;

alter table public.book_infos
  drop constraint book_infos_pkey;

alter table public.book_infos
  add primary key (translation_code, book_no);
