-- RLS 백스톱(방어심층).
--
-- 백엔드는 service_role 키로만 DB에 접근한다(src/common/supabase/supabase.module.ts).
-- service_role 은 bypassrls 속성이 있어 RLS 를 우회하므로, 아래로 RLS 를 켜도
-- 서버 동작은 전혀 바뀌지 않는다.
--
-- 대신 정책(policy)을 하나도 두지 않음으로써, anon / authenticated 등 그 외 역할은
-- 기본 거부(deny-by-default)가 된다. 즉 실수로 anon/publishable 키가 클라이언트에
-- 노출되거나 직접 테이블 접근이 시도되어도 전 유저 데이터가 새지 않는다.
--
-- 향후 클라이언트에서 anon 키로 특정 테이블을 직접 읽어야 한다면, 그때 해당 테이블에
-- 한해 최소 권한 정책을 명시적으로 추가한다(예: auth.uid() = user_id).

alter table public.users enable row level security;
alter table public.verses enable row level security;
alter table public.daily_verses enable row level security;
alter table public.book_infos enable row level security;
alter table public.writing_sessions enable row level security;
alter table public.user_daily_activity enable row level security;
alter table public.user_statistics enable row level security;
alter table public.streak_freeze_events enable row level security;
alter table public.emotion_tags enable row level security;
alter table public.emotion_verses enable row level security;
