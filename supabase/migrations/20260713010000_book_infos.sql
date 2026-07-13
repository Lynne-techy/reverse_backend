-- book_infos : 성경 각 권(66권)의 배경 정보 (참조 데이터)
-- 설계 근거: docs/DATABASE.md 3-2 성경 데이터 (책 배경 정보).
-- 실행: `supabase db push`
--
-- - 책 상세 화면용: 요약/저자/기록시기/기록장소/수신대상/핵심주제/유튜브 링크.
-- - verses 는 절 단위(비정규화 book_name 중복 저장)라 '책 단위' 메타를 담을 곳이 없어 신설.
-- - book_no 를 PK 로 둔다(성경 1~66권, 권당 1행). verses 처럼 신뢰된 시딩 스크립트로만 채운다.
-- - youtube_url 은 nullable — 구조만 확보하고 링크는 추후 채운다(시드 시엔 비움).
-- - summary/book_name 만 not null(필수), 나머지 배경 필드는 자료 미비 시 null 허용.

create table public.book_infos (
  book_no         smallint    primary key check (book_no between 1 and 66),
  book_name       text        not null,
  summary         text        not null,
  author          text,
  written_period  text,
  written_place   text,
  audience        text,
  core_theme      text,
  youtube_url     text,
  created_at      timestamptz not null default now()
);
