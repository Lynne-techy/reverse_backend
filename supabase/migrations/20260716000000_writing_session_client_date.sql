-- writing_sessions에 클라이언트 로컬 날짜(client_date)를 저장한다.
-- 잔디/streak 기준일과 같은 값. 지금까지는 complete 요청의 date를 메모리로만
-- 전달해 집계(user_daily_activity)에 count만 남았는데, "그날 무엇을 필사했는지"
-- (스트릭 시작 배너 등)를 역추적하려면 원본 이벤트에도 이 차원이 있어야 한다.
alter table public.writing_sessions
  add column client_date date;

comment on column public.writing_sessions.client_date is
  'complete 요청의 클라이언트 로컬 날짜(YYYY-MM-DD). 잔디/streak 기준일. complete 전에는 null.';

-- 스트릭 시작일의 첫 통과 필사 조회용(user_id + client_date, 통과분만).
create index writing_sessions_user_client_date_idx
  on public.writing_sessions (user_id, client_date)
  where passed = true;
