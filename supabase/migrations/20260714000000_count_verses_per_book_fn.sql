-- count_verses_per_book: 번역본별 book_no당 총 절수 집계 RPC 함수.
-- 설계 근거: 프로필 진척률(progress-calculator.ts) 계산 시 "책 완필" 판정 기준으로,
-- 유저가 커버한 절 수와 책 전체 절 수를 book_no별로 비교해야 한다.
-- 실행: `supabase db push`
--
-- - Supabase JS 클라이언트(.from())는 group by 집계를 표현할 수 없어 RPC로 정의한다.
-- - 매 프로필 조회마다 verses 31,088행 전체를 네트워크로 받아 서버(JS)에서 집계하면
--   Supabase(Postgres) ↔ NestJS 구간 전송량이 크고 비효율적이다. group by를 DB 안에서
--   끝내고 book_no별 count(66행)만 돌려받는다.
-- - stable: 같은 트랜잭션 내 같은 인자에 항상 같은 결과(읽기 전용 집계라 안전).

create or replace function public.count_verses_per_book(p_translation_code text)
returns table(book_no smallint, verse_count bigint)
language sql
stable
as $$
  select book_no, count(*) as verse_count
  from public.verses
  where translation_code = p_translation_code
  group by book_no;
$$;
