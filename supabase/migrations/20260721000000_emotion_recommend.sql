-- emotion_tags / emotion_verses : 감정 기반 구절 추천 (감정 마스터 + 감정↔구절 큐레이션)
-- 설계 근거: docs/DATABASE.md 3-2 (기존 emotion_tags/verse_emotion_tags 설계를 재구성).
-- 실행: `supabase db push`
--
-- - emotion_tags: 감정 8종 마스터. 표시 텍스트(label)는 프론트 i18n이 code로 렌더링하므로
--   DB엔 안정적인 code + 정렬 순서만 둔다 → UI 언어 추가 시 DB 스키마 변경이 없다.
--   소수의 고정 마스터라 별도 시드 스크립트 없이 이 마이그레이션에서 INSERT로 채운다.
-- - emotion_verses: 감정↔구절 큐레이션(사람이 감정별로 고른 절). verse_id로 verses를 참조해
--   본문은 verses 단일 소스에서 조회한다(텍스트 중복/드리프트 방지). verse_id가 번역본을
--   품으므로, 조회 시 verses.translation_code로 유저 번역본만 거른다. 번역본이 늘면 그 번역본의
--   verse_id로 행만 추가하면 되고 스키마는 불변이다.
-- - PK(emotion_code, verse_id): 한 감정에 같은 절 중복 방지 + 시드 재실행 멱등(upsert).
--   이 PK 인덱스가 WHERE emotion_code=? (추천 조회 필터)를 그대로 커버해 별도 인덱스가 불필요.
-- - 큐레이션 데이터라 채움은 스키마와 분리해 scripts/seed-emotion-verses.mjs 로 한다.

create table public.emotion_tags (
  code        text        primary key,
  sort_order  smallint    not null,
  created_at  timestamptz not null default now()
);

insert into public.emotion_tags (code, sort_order) values
  ('depression', 1),
  ('fear',       2),
  ('gratitude',  3),
  ('love',       4),
  ('anxiety',    5),
  ('joy',        6),
  ('loneliness', 7),
  ('weariness',  8);

create table public.emotion_verses (
  emotion_code text        not null references public.emotion_tags (code),
  verse_id     bigint      not null references public.verses (id),
  created_at   timestamptz not null default now(),
  primary key (emotion_code, verse_id)
);
