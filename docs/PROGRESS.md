# 진행 상황 로그 (세션 인수인계용)

> 세션 시작 시 먼저 읽고, 의미 있는 진행이 있으면 마무리 전에 갱신. **간결하게 유지** — 상세 배경은
> git log / `docs/DATABASE.md` / `docs/ARCHITECTURE.md`에 있으니 여기엔 한두 줄 요약만 남긴다.

## 상태
`main` 최신. **프로덕션 전체 스택 라이브** — https://reverse-growthlog.com (web/api/health/db 모두 200).
CI/CD는 레지스트리 빌드(GitHub Actions가 빌드해 Artifact Registry push, VM은 pull만 — 매일 1회 자동 배포).
로컬 `.env` 있음(개발/시딩 가능). 현재 브랜치: **`feat/recommend`** — 감정 기반 구절 추천 완료, PR 예정.
쉬는 동안 VM 중지 권장: `gcloud compute instances stop reverse-vm --zone=asia-northeast3-a`

## 완료 (요약)
- **W1**: 기반구조, Auth/User 모듈(controller/service/repository 구조), MVP 7개 테이블 마이그레이션, 설계 문서.
- **W2 수직 슬라이스**: 로그인→필사 업로드→잔디 관통. verse/writing/stats 모듈(오늘의 구절, 업로드-URL +
  complete[Gemini 유사도 인프로세스 백그라운드], streak/잔디 순수함수). 필사 **범위**(같은 장 start/end) +
  key verse + 언어(ko/en). 성경 전체 시딩(개역개정 31,088절) + `translation_code` 명명(`{LANG}_{VERSION}`).
- **배포/운영**: GCE VM + Cloudflare + Docker + 전역 `/api` prefix. CI/CD(Workload Identity/IAP, `:sha` 롤백),
  IAM+SSH IAP, Gemini 검사 백그라운드(동시성 상한), 헬스체크/스냅샷/Ops Agent, 프론트 Docker화.
- **프로필/진척률/책정보** (`feat/user-progress`, merge): `GET /users/me`·`/progress`·`/linked-providers`,
  `GET /books/:bookNo`. 진척률=정경 커버리지(순수함수+jest), RPC 첫 도입(`count_verses_per_book`),
  `book_infos` 복합 PK `(translation_code, book_no)`, `users.language`.
- **필사 기록/QT** (`feat/recent-writing`, merge): `GET /writing-sessions`(통과분 최신순, PostgREST FK embed) +
  complete에 QT(묵상/적용/기도제목, 자유 텍스트·전부 선택 입력) 통합.
- **감정 추천** (`feat/recommend`, 2026-07-21): `GET /verses/recommendations?emotion=` — 감정 8종별 큐레이션
  구절 중 무작위 6개(Fisher–Yates). `emotion_tags`/`emotion_verses`(`20260721000000_emotion_recommend.sql`),
  좌표 시드(`data/emotion-verses.json` 자연키 → `scripts/seed-emotion-verses.mjs`가 verse_id resolve, 240건).
  상세 결정 배경 → `docs/DATABASE.md`.

## 보류
- 별(밤하늘) 시각화 컬럼 — 방식 미확정(`docs/DATABASE.md` 6장).
- OCI Object Storage 전환(현재 Supabase Storage 임시). (`ocr_jobs`/Python OCR 워커는 폐기 — Gemini 직접 호출.)
- `verses` 주소/텍스트 정규화 — 라이브 FK 리스크로 보류, 2번째 번역본 실제 적재 시 재검토.

## 다음 단계 (백로그)
- [ ] 감정 추천 PR 정리/머지.
- [ ] 구절 검색/목록 API 확장 — 현재 `GET /verses`는 같은 장 범위 조회만.
- [ ] 프론트 신규 페이지(Login/pilsa/heatmap/Recommend 등) 라우터 배선 — 팀원 작업.
- [ ] 밤하늘 밝기용 **절별 필사 횟수** 엔드포인트 — 절 주소별 카운트 배열(진척률 요약과 별개 데이터).
- [ ] 절수 라벨/분모 정합 — 프론트 밤하늘 라벨 31,102 vs 시딩(개역개정) 31,088 불일치, 정본 확정 후 맞추기.
- [ ] (이후) quests, user_quests(게임화).

## 최근 세션
- 2026-07-22: **RLS 백스톱 운영 반영** — `20260722000000_rls_backstop.sql`(10개 테이블 `enable row level security`,
  정책 0개=deny-by-default)을 운영 Supabase 대시보드 SQL Editor로 수동 실행. `pg_tables.rowsecurity` 전부 `true` 검증.
  서버는 `service_role`(bypassrls)로 붙어 동작 무영향. (마이그레이션은 CI 자동적용 없음 → `supabase db push`/SQL 수동)
- 2026-07-21: **감정 기반 구절 추천 완료**(위 "완료" 참고). API_SUMMARY/DATABASE 동기화.
- 2026-07-18: 로컬 백엔드 PORT→3000 + 프론트(`reverse_app`) 구글 OAuth 로그인 실배선
  (AuthContext/ProtectedRoute/`/auth/callback`, Vite 5173 + `/api` 프록시). 프론트 `.env.local` anon 키 +
  Supabase Redirect URL(`localhost:5173/auth/callback`) 등록 필요(사용자 액션).
- 2026-07-15~17: 구글 OAuth 활성화, 잔디/streak 기준일 서버 UTC→**클라이언트 로컬 날짜** 전환(⚠️ 팀원 공유),
  `client_date`+`streakStart`, 통계 기획 대조, 최근 필사 목록/QT(위 "완료"에 흡수).
