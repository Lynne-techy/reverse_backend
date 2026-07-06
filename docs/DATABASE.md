# Re-Verse 데이터베이스 모델링

> **문서 목적**: 팀 리뷰용 데이터 모델 설계안. 전체 ERD → 도메인별 테이블 상세 → 논의가 필요한 열린 질문 순으로 정리했습니다.
> 피드백은 각 테이블의 **논의 포인트**와 마지막 **열린 질문** 섹션을 중심으로 부탁드립니다.
>
> - **DB**: Supabase (PostgreSQL)
> - **인증 원천**: Supabase 관리 `auth.users` (소셜 로그인: 구글/카카오)
> - 상태: 초안 (v1) — 리뷰 후 확정

---

## 1. 설계 원칙 & 컨벤션

| 항목 | 규칙 | 이유 |
|---|---|---|
| 스키마 | 앱 테이블은 모두 `public` | Supabase 관례. 인증은 `auth` 스키마가 관리 |
| 네이밍 | 테이블·컬럼 `snake_case`, 복수형 테이블명 | Postgres/Supabase 관례 |
| PK | 사용자 관련은 `uuid`, 대량 참조 데이터(성경 구절)는 `bigint` | uuid는 노출/분산에 안전, 구절은 수만 행이라 정수가 조회·용량 효율적 |
| 시간 | 모두 `timestamptz` (UTC 저장) | 타임존 버그 예방 |
| 점수 | `numeric(5,2)` (0.00~100.00) | Gemini 유사도 점수를 소수 둘째자리까지 |

> 💡 **왜 `uuid`와 `bigint`를 섞나요?** 사용자 ID는 URL·토큰에 실려 외부에 노출되므로 순차 정수(1,2,3…)면 "몇 명인지" "다음 사용자" 등이 추측됩니다. 그래서 uuid. 반면 성경 구절은 내부 참조용 대량 데이터라 추측 위험이 없고, 정수가 인덱스/조인에 더 가볍습니다.

---

## 2. 전체 ERD

```mermaid
erDiagram
    auth_users ||--|| users : "1:1 (같은 id)"
    users ||--o{ writing_sessions : "필사한다"
    users ||--|| user_statistics : "집계 1:1"
    users ||--o{ user_daily_activity : "일자별 활동"
    users ||--o{ streak_freeze_events : "freeze 이력"
    users ||--o{ user_quests : "퀘스트 진행"

    verses ||--o{ writing_sessions : "대상 구절"
    verses ||--o{ daily_verses : "오늘의 말씀"
    verses ||--o{ verse_emotion_tags : "감정 태그"
    emotion_tags ||--o{ verse_emotion_tags : "태그"

    quests ||--o{ user_quests : "정의"

    users {
        uuid id PK "= auth.users.id"
        text email
        text provider "google | kakao"
        text display_name
        text avatar_url
    }
    verses {
        bigint id PK
        text translation_code
        smallint book_no
        smallint chapter
        smallint verse_no
        text text
    }
    writing_sessions {
        uuid id PK
        uuid user_id FK
        bigint verse_id FK
        text object_key "이미지 스토리지 키"
        text status
        text recognized_text "Gemini 전사"
        numeric similarity_score "Gemini 유사도"
        boolean passed
    }
    user_statistics {
        uuid user_id PK
        int current_streak
        int longest_streak
        int total_count
        date last_written_date
        smallint freeze_available
    }
    user_daily_activity {
        uuid user_id PK
        date activity_date PK
        int count
    }
```

> 위 다이어그램은 GitHub·Notion·VS Code(Mermaid 지원)에서 그대로 렌더링됩니다. 안 보이면 raw 텍스트로도 관계 파악이 됩니다.

---

## 3. 도메인별 테이블 상세

테이블을 5개 도메인으로 묶었습니다. **[MVP]** = 초기 필수, **[이후]** = 나중 단계, **[보류]** = 방식 미확정.

### 3-1. 사용자

#### `users` **[MVP]** — 앱 프로필
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK, FK→`auth.users.id` (ON DELETE CASCADE) | **auth.users와 동일한 id** |
| email | text | not null | |
| provider | text | not null, check(`google`\|`kakao`) | 로그인 수단 |
| display_name | text | null | 표시 이름 |
| avatar_url | text | null | 프로필 이미지 |
| created_at / updated_at | timestamptz | default now() | |

**논의 포인트**: Supabase는 로그인하면 `auth.users`에 사용자를 자동 생성합니다. 우리 앱 전용 필드(닉네임 등)를 붙이려고 `public.users`를 **따로 두되 id를 똑같이 공유**합니다(1:1). 이러면 조인이 단순하고 동기화 고민이 적습니다.

> 💡 **대안**: `auth.users`만 쓰고 별도 테이블을 안 만들 수도 있지만, `auth` 스키마는 Supabase가 관리해서 우리가 컬럼을 마음대로 못 넣습니다. 그래서 미러 테이블 방식이 일반적입니다.

### 3-2. 성경 데이터

#### `verses` **[MVP]** — 성경 구절 원문
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | bigint | PK (identity) | |
| translation_code | text | not null | 번역본 (예: `GAE` 개역개정) |
| book_no | smallint | not null | 성경 책 번호 |
| book_name | text | not null | 책 이름(표시용) |
| chapter | smallint | not null | 장 |
| verse_no | smallint | not null | 절 |
| text | text | not null | 구절 본문 |
| char_count | int | not null | 글자 수 (난이도/시각화용 캐시) |

- **Unique**: `(translation_code, book_no, chapter, verse_no)` — 같은 번역본의 같은 절 중복 방지.

> **결정 (2026-07-06)**: `book_no`의 1~66 범위 `check` 제약은 두지 않기로 했습니다. `verses`는 사용자 입력이 아니라 신뢰된 시딩 스크립트로만 채워지는 참조 테이블이라, DB 레벨 방어보다 시딩 스크립트 검증으로 충분하다고 판단했습니다.

#### `emotion_tags` **[이후]** — 감정 태그 마스터 (8종)
`code`(PK), `label_ko`, `sort_order`. 예: `comfort`(위로), `hope`(희망), `gratitude`(감사)…

#### `verse_emotion_tags` **[이후]** — 구절 ↔ 감정 (N:M)
`verse_id`, `tag_code`, `weight`. PK `(verse_id, tag_code)`. 감정 기반 추천에 사용.

#### `daily_verses` **[MVP]** — 오늘의 말씀
| 컬럼 | 타입 | 설명 |
|---|---|---|
| activity_date | date PK | 날짜별 1구절 (전역: 모두 같은 구절) |
| verse_id | bigint FK→verses | |

**논의 포인트**: 오늘의 말씀을 **전 사용자 공통(전역)** 으로 할지, **개인 맞춤(감정 기반)** 으로 할지가 갈림길입니다. 기획의 "선택 부담 제거" 취지엔 전역이 단순하고 잘 맞습니다. 개인화하려면 PK를 `(user_id, activity_date)`로 바꿔야 합니다. → **열린 질문 ④**

### 3-3. 필사 기록

#### `writing_sessions` **[MVP]** — 필사 1회 기록 (핵심 테이블)
| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | uuid | PK | |
| user_id | uuid | FK→users | 누가 |
| verse_id | bigint | FK→verses | 어떤 구절을 |
| object_key | text | not null | 업로드된 이미지의 스토리지 키 |
| status | text | default `pending` | `pending`→`uploaded`→`processing`→`completed`/`failed` |
| recognized_text | text | null | Gemini가 이미지에서 읽어낸 전사 텍스트 |
| similarity_score | numeric(5,2) | null | Gemini가 매긴 원문과의 유사도 (0~100) |
| passed | boolean | null | 통과 여부 (유사도 ≥ 임계치) |
| created_at / completed_at | timestamptz | | |

- **인덱스**: `(user_id, created_at desc)` — 내 기록 목록 조회용.

> 💡 **왜 이미지 URL이 아니라 `object_key`인가?** 이미지는 Object Storage에 저장되고, 접근할 때마다 서명된 임시 URL을 발급합니다. URL은 만료되므로 DB엔 **변하지 않는 키**만 저장하는 게 안전합니다.

> **결정 (2026-07-06)**: 필사 유사도 검사를 **별도 OCR 워커(PaddleOCR) → Gemini API 직접 호출**로 변경했습니다. NestJS 백그라운드 잡이 `uploaded` 세션을 클레임(→`processing`)해 Gemini를 호출하고, 결과(`recognized_text`/`similarity_score`)를 저장한 뒤 통과 판정합니다. 이에 따라 `ocr_score`(OCR 신뢰도) 컬럼을 제거하고 `ocr_text`를 `recognized_text`로 이름을 바꿨습니다 (마이그레이션 `20260706000000_gemini_similarity.sql`). 별도 잡 큐 테이블(`ocr_jobs`)은 불필요 — [6. 보류/폐기 항목](#6-보류폐기-항목) 참고.

### 3-4. 습관 / 통계

#### `user_statistics` **[MVP]** — 사용자별 집계 (1:1)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| user_id | uuid PK, FK→users | |
| current_streak | int | 현재 연속 일수 |
| longest_streak | int | 최고 기록 |
| total_count | int | 총 필사 수 |
| last_written_date | date | 마지막 필사 날짜 (streak 계산용) |
| freeze_available | smallint | 보유한 streak 보호권 수 |

#### `user_daily_activity` **[MVP]** — 일자별 활동 (잔디 시각화)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| user_id | uuid | (PK) |
| activity_date | date | (PK) |
| count | int | 그날 통과한 필사 수 (잔디 진하기 결정) |

> **결정 (2026-07-05)**: MVP는 잔디(횟수 기반)만 구현합니다. 별(밤하늘) 시각화 관련 컬럼은 **보류 상태** — [6. 보류/폐기 항목](#6-보류폐기-항목) 참고.

> 💡 **왜 `user_statistics`와 `user_daily_activity`를 나누나?** 하나는 "현재 상태 요약"(streak 몇 일, 총 몇 회 — 사용자당 **1행**), 다른 하나는 "날짜별 히스토리"(잔디 그리려면 하루당 **1행**)입니다. 성격이 달라서 나눠야 조회가 깔끔합니다.

#### `streak_freeze_events` **[MVP]** — freeze 적립/사용 이력
`type`(`earned`/`used`), `reason`. 보유 수는 `user_statistics.freeze_available`에 캐시하고, 이력은 여기에 쌓습니다(append-only). **freeze 지급 규칙은 → 열린 질문 ②**.

### 3-5. 게임화 **[이후]**

#### `quests` / `user_quests`
퀘스트 정의(`quests`: code, title, type, goal, reward)와 사용자별 진행(`user_quests`: progress, completed_at, claimed_at). MVP 이후 단계에서 다룹니다.

---

## 4. 구현 우선순위

| 단계 | 테이블 |
|---|---|
| **MVP (먼저)** | users, verses, daily_verses, writing_sessions, user_statistics, user_daily_activity, streak_freeze_events |
| **이후** | emotion_tags, verse_emotion_tags(추천), quests, user_quests(게임화) |

> MVP 7개 테이블은 `supabase/migrations/20260705000000_init_schema.sql`에 작성 완료되었습니다. 보류 항목은 → [6. 보류/폐기 항목](#6-보류폐기-항목).

---

## 5. 팀 논의가 필요한 열린 질문

1. **유사도 통과 임계치**: 초안 85%. Gemini의 한국어 손글씨 판정 편차를 실측 후 조정 필요. 임계치를 코드 상수로 둘지, 설정값/구절 난이도별로 둘지?
2. **streak 보호권(freeze) 규칙**: 며칠 연속하면 몇 개 지급? 주당/총 상한? 빠진 날 자동 소모할지?
3. **시각화 지표**: 밤하늘 별의 밝기/크기/색을 각각 어떤 데이터에 연결할지 (유사도? 글자수? 연속일?). → 저장할 컬럼이 달라짐. **MVP는 잔디(횟수)만 구현, 별 관련 컬럼은 확정 후 추가 예정.**
4. **오늘의 말씀 방식**: 전역 공통 vs 감정 기반 개인화? (`daily_verses` PK 구조가 바뀜)
5. **감정 태그 8종 확정**: 목록과 추천 알고리즘(단순 랜덤 vs 가중치 vs 이력 기반).
6. **필사 단위**: 한 절만? 아니면 여러 절(구절 묶음)도 허용? 후자면 `verses`에 범위 컬럼 추가 필요.

---

## 6. 보류/폐기 항목

방식/기준이 아직 확정되지 않아 스키마 구현을 미룬 항목들입니다. 각 항목은 확정될 때 별도 마이그레이션으로 추가합니다.

#### ~~`ocr_jobs` — OCR 비동기 잡~~ **(폐기, 2026-07-06)**
당초 별도 파이썬 OCR 워커와의 잡 큐 연동을 위해 설계했으나, **유사도 검사를 Gemini API 직접 호출로 변경**하면서 폐기했습니다. Gemini를 NestJS가 직접 호출하므로 크로스-프로세스 조율용 잡 테이블이 필요 없고, 비동기 처리는 `writing_sessions.status`(`uploaded`→`processing`→`completed`/`failed`)를 잡 상태로 삼아 인프로세스로 수행합니다.

#### 별(밤하늘) 시각화 컬럼
`user_daily_activity`에 유사도·글자수 기반 컬럼(`best_similarity`, `total_char_count` 등)을 추가할지는 열린 질문 ③(시각화 지표)이 확정된 후 결정합니다. MVP는 잔디(횟수) 시각화만 구현합니다. → 확정 조건: 별의 밝기/크기/색이 어떤 지표에 연결되는지 결정.

---

## 부록. Supabase 특이사항

- **`auth.users` 관계**: 로그인 시 Supabase가 자동 생성. 우리 `public.users`는 같은 id로 미러링(로그인 최초 요청 때 백엔드가 자동 생성 예정).
- **RLS(Row Level Security)**: 모든 DB 접근은 백엔드(신뢰 서버)가 담당하므로 기본은 백엔드 권한으로 처리하고, 심층 방어로 "본인 데이터만 읽기" 정책을 최소한으로 걸어두는 방향. (리뷰 후 상세 정책 확정)
