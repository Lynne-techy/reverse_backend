-- writing_sessions에 QT(묵상/적용/기도제목) 컬럼을 추가한다.
-- 필사 완료 화면(기록 저장 직전)에서 선택 입력하는 값이라 모두 nullable.
-- 태그가 아닌 자유 텍스트로 시작한다 — 텍스트→태그 확장은 가능하지만 역방향은
-- 불가능하므로 되돌릴 수 있는 쪽을 선택 (통계 집계가 필요해지면 그때 태그 도입).
-- UI 입력 상한(500자)을 DB에서도 보장한다.
alter table public.writing_sessions
  add column meditation  text check (char_length(meditation) <= 500),
  add column application text check (char_length(application) <= 500),
  add column prayer      text check (char_length(prayer) <= 500);

comment on column public.writing_sessions.meditation is
  'QT 묵상 — 이 말씀이 내게 어떻게 다가왔는지. complete 시 선택 입력, 최대 500자.';
comment on column public.writing_sessions.application is
  'QT 적용 — 오늘 삶에 어떻게 적용할지. complete 시 선택 입력, 최대 500자.';
comment on column public.writing_sessions.prayer is
  'QT 기도제목 — 이 말씀으로 무엇을 기도할지. complete 시 선택 입력, 최대 500자.';
