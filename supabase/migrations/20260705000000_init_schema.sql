-- Re-Verse 초기 스키마
-- 설계 근거: docs/DATABASE.md 참고 (팀 리뷰 완료본)
-- 실행: Supabase CLI 사용 시 `supabase db push` 또는 `supabase migration up`

-- =========================================================
-- users : 앱 프로필 (auth.users 미러, id 동일)
-- =========================================================
create table public.users (
  -- auth.users.id 를 그대로 재사용한다 (FK + PK 겸용).
  -- 별도 id를 발급하지 않으므로 1:1 동기화가 단순해진다.
  id            uuid        primary key references auth.users (id) on delete cascade,
  email         text        not null,
  -- check 제약으로 허용값을 DB 레벨에서도 강제한다 (앱 버그로 잘못된 값이 들어가는 것 방지).
  provider      text        not null check (provider in ('google', 'kakao')),
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =========================================================
-- TODO(human): verses 테이블을 작성해보세요.
--
-- docs/DATABASE.md 의 "3-2. 성경 데이터 > verses" 섹션을 참고합니다.
create table public.verses (
  id  bigint  generated always as identity primary key,
  translation_code text not null,
  book_no smallint not null,
  book_name text not null,
  chapter smallint not null,
  verse_no smallint not null,
  text  text not null,
  char_count integer not null, 
  created_at timestamptz not null default now(),
  unique(translation_code, book_no, chapter, verse_no)
);
-- 필요한 컬럼:
--   id                bigint   PK, identity (자동 증가 정수 — 위 users의 uuid 방식과 다름에 유의)
--   translation_code  text     not null
--   book_no           smallint not null, 1~66 범위 체크
--   book_name         text     not null
--   chapter           smallint not null
--   verse_no          smallint not null
--   text              text     not null
--   char_count        integer  not null
--   created_at        timestamptz not null default now()
--
-- 힌트:
--   - bigint 자동증가 PK 문법: `id bigint generated always as identity primary key`
--   - 범위 체크: `check (book_no between 1 and 66)`
--   - 같은 번역본의 같은 절이 중복 저장되지 않도록 UNIQUE 제약도 추가하세요.
--     (translation_code, book_no, chapter, verse_no) 네 컬럼의 조합이 유일해야 합니다.
--     문법: 컬럼 목록 끝에 `unique (a, b, c, d)` 한 줄 추가
-- =========================================================


-- =========================================================
-- TODO(human): daily_verses 테이블을 작성해보세요.
create table public.daily_verses(
  activity_date date primary key,
  verse_id bigint not null references public.verses (id),
  created_at timestamptz not null default now()
);
-- docs/DATABASE.md 의 "daily_verses" 섹션 참고. 오늘의 말씀은 전역 배정(모든 사용자 동일)입니다.
-- 필요한 컬럼:
--   activity_date  date     PK (하루에 1행만 존재해야 하므로 date 자체가 PK)
--   verse_id       bigint   not null, verses.id 를 참조하는 FK
--   created_at     timestamptz not null default now()
--
-- 힌트:
--   - FK 문법: `verse_id bigint not null references public.verses (id)`
-- =========================================================

-- =========================================================
-- user_statistics : 사용자별 집계 (1:1, "현재 상태 요약")
-- =========================================================
create table public.user_statistics (
  user_id            uuid    primary key references public.users (id) on delete cascade,
  current_streak     int     not null default 0,
  longest_streak     int     not null default 0,
  total_count        int     not null default 0,
  last_written_date  date,
  freeze_available   smallint not null default 0,
  updated_at         timestamptz not null default now()
);

-- =========================================================
-- user_daily_activity : 일자별 활동 (잔디 시각화, "이력")
-- =========================================================
create table public.user_daily_activity (
  user_id        uuid not null references public.users (id) on delete cascade,
  activity_date  date not null,
  -- 그날 통과한 필사 횟수. 잔디 진하기를 이 값으로 결정한다.
  -- 별(밤하늘) 시각화 지표는 미확정이라 컬럼을 추가하지 않는다 (docs/DATABASE.md 열린 질문 3번).
  count          int  not null default 0,
  primary key (user_id, activity_date)
);

-- =========================================================
-- TODO(human): streak_freeze_events 테이블을 작성해보세요.
--
-- docs/DATABASE.md 의 "streak_freeze_events" 섹션 참고.
-- freeze 획득/사용 이력을 append-only로 쌓는 테이블입니다 (user_statistics.freeze_available은 현재 합계 캐시).
-- 필요한 컬럼:
--   id          uuid    PK, 기본값 gen_random_uuid()
--   user_id     uuid    not null, users를 참조하는 FK
--   type        text    not null, 'earned' 또는 'used'만 허용
--   reason      text    null (예: "7일 연속 달성", "10-25 결석 자동 소모")
--   created_at  timestamptz not null default now()
--
-- 힌트:
--   - uuid 기본값 문법: `id uuid primary key default gen_random_uuid()`
--   - 두 값만 허용하는 체크: `check (type in ('earned', 'used'))`
-- =========================================================
create table public.streak_freeze_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('earned', 'used')),
  reason text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- TODO(human): writing_sessions 테이블을 작성해보세요.
--
-- docs/DATABASE.md 의 "3-3. 필사 세션 > writing_sessions" 섹션 참고.
-- 필사 1회(사진 업로드 ~ OCR 결과)의 전체 라이프사이클을 담는 핵심 테이블입니다.
-- 필요한 컬럼:
--   id                 uuid        PK, 기본값 gen_random_uuid()
--   user_id            uuid        not null, users를 참조하는 FK
--   verse_id           bigint      not null, verses를 참조하는 FK
--   object_key         text        not null (업로드된 이미지의 스토리지 키)
--   status             text        not null, 기본값 'pending'
--                        ('pending' | 'uploaded' | 'processing' | 'completed' | 'failed')
--   ocr_text           text        null (OCR이 읽어낸 텍스트)
--   ocr_score          numeric(5,2) null (OCR 신뢰도, 0.00~100.00)
--   similarity_score   numeric(5,2) null (원문과의 유사도, 0.00~100.00)
--   passed             boolean     null (통과 여부)
--   created_at         timestamptz not null default now()
--   completed_at       timestamptz null (OCR 완료 시점, 완료 전에는 비어있음)
--
-- 힌트:
--   - status는 앞서 나온 것처럼 check로 다섯 개 값만 허용하도록 제약하세요.
--   - numeric(5,2) 는 "전체 5자리, 소수점 2자리"라는 뜻입니다 (예: 100.00, 85.50).
--   - completed_at 은 세션 생성 시점엔 값이 없으므로 default 없이 null 허용으로 두면 됩니다.
--   - 마지막으로, 아직 안 나온 문법인 인덱스도 추가해보세요 (내 기록 목록 조회용):
--       create index on public.writing_sessions (user_id, created_at desc);
-- =========================================================
create table public.writing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  verse_id bigint not null references public.verses (id),
  object_key text not null,
  status text not null default 'pending' check (status in ('pending','uploaded','processing','completed','failed')),
  ocr_text text,
  ocr_score numeric(5,2),
  similarity_score numeric(5,2),
  passed boolean,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.writing_sessions (user_id, created_at desc);