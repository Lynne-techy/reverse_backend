# reverse-growthlog · 기술 문서

> 한·영 손글씨 필사를 Gemini로 인식·대조하는 습관 트래커. 소프트웨어 경진대회 출품작.
> 배포 기조: **"설계는 확장 가능하게, 배포는 싸게"** · 심사 설명 원칙: 기술 나열이 아니라 배운 과목의 용어로 시스템을 설명한다.

---

## 🎯 개요

reverse-growthlog는 사용자가 손글씨 필사 이미지를 올리면 **Gemini 멀티모달로 텍스트를 인식·대조**하고, 필사 습관(스트릭·통계)을 기록·추적하는 웹 서비스다. 개인 프로젝트로 시작하되 확장을 전제로 설계했으며, 교체가 필요할 지점을 seam으로 명시해 인프라 교체 비용을 최소화한다.

**핵심 아키텍처 결정 — 큐 3단 변천**

이 프로젝트의 가장 특징적인 결정은 비동기 처리 방식을 세 번 바꾼 것이다. 매번 전제가 무너져 **구현 전에** 이전 결정을 폐기했다 — v1·v2는 코드로 짜지 않고 ADR 단계에서 superseded 됐다. 그래서 실제로 남은 구현은 하나뿐이고, **비동기 처리를 갈아끼울 지점을 `QueueService`라는 교체 경계(seam)로 문서에 명시**해 둔 것이 논거다. 지금 코드에는 인터페이스 타입이 아니라 `HandwritingCheckService`(Gemini 직결) + `ConcurrencyLimiter` + `writing_sessions` 상태 전이가 그 자리를 대신한다.

| 버전 | 구현 | 폐기 계기 |
| --- | --- | --- |
| v1 | Cloud Tasks (관리형 큐) | 서버리스 전제가 사라짐 (미구현·ADR 폐기) |
| v2 | Redis + BullMQ (자체 운영) | Gemini 직접 호출 확정으로 워커 존재 이유 소멸 (미구현·ADR 폐기) |
| **v2.1 (현재)** | **인프로세스 + DB 상태 머신** | — |

넣은 것보다 **뺀 것**을 설명할 수 있다는 게 이 설계의 논거다. 결과적으로 컨테이너가 4개(nginx/api/redis/worker)에서 **2개(nginx/api)**로 줄어 2GB VM의 메모리 여유가 늘었다.

> 📎 인프라 구성도 이미지 첨부 (infra-overview "05 설계 변천")

**요약 스펙**: GCE e2-small (서울) · Docker Compose 2컨테이너 · Cloudflare 프록시 · Supabase(Postgres/Auth/Storage) · Gemini 2.5-flash

---

## 🔧 기술 상세정보

### 시스템 상호작용

요청은 Cloudflare에서 IP 은닉·검사(WAF)를 거쳐 VM의 nginx로 들어온다. nginx가 TLS를 종단하고 React 정적 자산을 직접 서빙하며, `/api/**`만 NestJS로 프록시한다. 동일 오리진이라 **CORS가 원천 제거**된다.

```
사용자 → Cloudflare(프록시 ON, Full strict) → nginx(TLS 종단·정적 서빙) → NestJS(API)
                                                              ├→ Supabase (Postgres/Auth)
                                                              ├→ Supabase Storage (presigned URL, R2 전환 예정)
                                                              └→ Gemini API (백그라운드 잡)
```

> 📎 인프라 구성도 이미지 첨부 (infra-overview "01 런타임 아키텍처")

### 데이터 모델

엔티티 9개(public 테이블 8 + 외부 `auth.users` 1), 선언 FK 7개, 복합 PK 2개. `users`를 신원 허브로, `writing_sessions`를 필사 활동의 트랜잭션 중심으로 둔다.

!erd_full.png

주요 설계 결정:

- **관심사 분리(1:1)** — `user_statistics`를 `users`에서 분리. streak·집계는 고빈도 write라 갱신 주기가 다른 프로필과 한 행에 두면 잠금 경합이 생긴다.
- **복합 기본키** — `user_daily_activity(user_id, activity_date)`(사용자×날짜 유일), `book_infos(translation_code, book_no)`(번역본별 책 유일, 성경 66권 배경 정보). 자연키로 중복을 스키마 차원에서 차단.
- **자연키 UNIQUE** — `verses(translation_code, book_no, chapter, verse_no)` 복합 UNIQUE로 같은 번역본의 같은 절 중복 저장을 차단.
- **의도적 비정규화** — `writing_sessions`가 `book_no·chapter·start/end_verse_no`를 중복 보관. 조회가 지배적인 워크로드에서 verses 조인 없이 범위를 읽기 위함.

> ℹ️ **book_infos 관리** — 성경 66권 배경 정보(요약·저자·핵심주제 등). **구조**는 마이그레이션 `20260713010000_book_infos.sql`(+ 복합 PK 확장 `20260713020000_book_infos_translation_pk.sql`)로 레포에서 재현된다. **데이터**는 `scripts/seed-books.mjs`로 적재하되, 소스 `data/books.json`은 팀 방침상 `.gitignore` 처리(이미 Supabase 적재 완료 — 레포엔 미포함, 로컬·DB에서 관리).

### 알고리즘 — 비동기 인증 흐름

Gemini 호출이 수 초 걸리므로 요청 스레드를 붙잡지 않는다. 세션 상태 컬럼이 곧 잡 상태다.

1. 클라이언트가 presigned URL로 스토리지에 이미지 직접 업로드 (VM 미경유)
2. NestJS가 세션을 `pending`으로 생성(upload-url 발급 시점) — `uploaded`는 enum에 예약돼 있으나 현재 이를 기록하는 코드는 없다
3. 클라이언트가 완료(`complete`)를 요청하면 **그 요청 핸들러가 원자적으로 클레임** — `update … set status='processing' where status in ('pending','uploaded','failed')`. 성공한 요청만 인프로세스 백그라운드 잡을 fire-and-forget으로 띄운다(폴링 스케줄러 없음, 동시성 상한 안에서 실행).
4. **Supabase Storage에서 이미지 로드** → Gemini로 손글씨 인식 + 원문 대조·유사도 판정
5. `completed`(통과/불통과) / `failed`(재시도 가능)로 상태 전이
6. 클라이언트가 폴링으로 결과 수신

3번의 조건부 update가 원자적 클레임이라, 위 상태검사 이후 동시 요청이 겹쳐도 정확히 한 요청만 `processing`을 획득한다(check-then-act 경쟁 제거). 다중 인스턴스로 늘어나도 이 클레임 자체는 이중 처리를 막는다(단, 부팅 정리 로직은 아래 확장성 절 참고).

### API

- 전역 프리픽스 `setGlobalPrefix('api')` — 동일 오리진 프록시 전제
- 헬스체크: `/api/health`, `/api/health/db`(DB 실쿼리 — Supabase 비활성 정지 방지용)
- 개발 전용 라우트(`/api/dev/*`, `/api/handwriting-check/debug`)는 프로덕션에서 404로 잠금
- Swagger UI: `/api-docs` (비프로덕션 한정, 프로덕션은 미노출) — `main.ts`

---

## ⚡ 성과 고려 사항

### 2GB 메모리 제약 대응

e2-small(2GB)의 제약이 여러 결정을 이끌었다.

- **빌드 오프로드** — tsc·vite 빌드가 실행 중 컨테이너를 OOM으로 죽일 수 있어, GitHub Actions 러너에서 빌드해 Artifact Registry에 push하고 VM은 pull만 한다. **VM 빌드 부하 0**.
- **런타임 보호** — 유사도 검사(Gemini 잡)를 `SIMILARITY_MAX_CONCURRENCY=3`으로 제한(`ConcurrencyLimiter`). 컨테이너별 메모리 제한(api 1GB / web 256MB) + 스왑 2GB.

### 확장성

원자적 클레임(ADR 6.11)은 행 단위라 다중 인스턴스에서도 이중 처리가 없다. 다만 현재는 **단일 인스턴스 전제**다 — 부팅 시 `failStaleProcessing()`이 모든 `processing` 행을 일괄 `failed` 처리하므로(서버가 검사 도중 죽어 잔류한 세션 정리 목적), 다중화하려면 이 정리 로직을 **타임스탬프 기반 스윕으로 교체**해야 한다(코드 주석에 명시). 그 한 곳만 바꾸면 무상태 설계(설계원칙 3) 위에서 LB 뒤 다중화가 가능하다.

| 단계 | 트리거 | 변경 |
| --- | --- | --- |
| 현재 | — | VM 1대 + Compose 2컨테이너 |
| DB 부하 | 무료 한도 근접 | 커넥션 스트링 교체 |
| OCR 비용 | 호출비 > 운영비 | `OcrService` 구현체 교체 (현재 seam으로만 명시, 미구현) |
| 잡 처리량 | 재시도·동시성 요구 | `QueueService` 도입 (인프로세스 → pg-boss → Redis+BullMQ) |
| 트래픽 | VM 1대 한계 | LB 뒤 다중화 — `failStaleProcessing`을 타임스탬프 스윕으로 교체 후 |

### 비용·읽기 최적화

- **콜드 스타트 회피** — 서버리스 대신 상시 VM 선택(시연 리스크 제거)
- **읽기 지배 워크로드** — writing_sessions 비정규화, Cloudflare 엣지 캐싱, R2 이그레스 무료(전환 후)
- 월 고정비 약 2~2.7만 원 (GCE가 유일한 유의미 비용)

---

## 🧪 시험 전략

> 현황: 인프라·배포는 완료, 테스트 스위트는 착수 단계. 커버리지 숫자를 먼저 정하지 않고 **ADR에 기록한 설계 위험에서 테스트를 역산**한다.

### 우선순위 (ADR 위험 → 테스트)

| 테스트 | 종류 | 근거 |
| --- | --- | --- |
| **원자적 클레임 동시성** | 통합(실 Postgres) | 이중 처리 없음 검증 — 모킹하면 무의미 |
| 상태 머신 전이 | 단위 | 잘못된 전이(completed→processing) 차단 |
| seam 교체 가능성 | 단위(Fake 주입) | 의존성 역전이 실제 작동하는지 |
| Gemini 실패 처리 | 단위(모킹) | 장애 시 `failed` 마킹·재시도 |
| 환경변수 검증 | e2e | 부팅 검증 |

**원자적 클레임 테스트는 실제 Postgres에 병렬 요청을 던진다.** Supabase 클라이언트를 모킹하면 Postgres의 동시성 제어가 아니라 mock 동작을 테스트하게 되므로, `supabase start`(로컬 도커 DB)로 실 DB에 붙인다. "동시 요청 10개 중 정확히 1개만 `processing` 획득"이 완료 기준이다.

### CI 게이트

배포 워크플로에 `needs: test`를 추가해 **테스트 통과 시에만 이미지가 push**되게 한다. 프론트 빌드 실패도 배포 전에 잡힌다.

### 커버리지

전역 숫자 대신 계층 차등: service 80% / repository 60% / controller 50%. module·DTO·main.ts는 제외.

---

## 📋 종속성 & 요구 사항

### 외부 서비스

- **Supabase** — Postgres + Auth + Storage (서울). 풀러 6543. 무료 플랜(7일 비활성 정지 → keepalive 크론)
- **Supabase Storage** — 현재 필사 이미지 저장소(Private 버킷, presigned URL 전용). **R2 전환 예정**(이그레스 무료 목적)
- **Gemini API** — gemini-2.5-flash (raw REST `fetch` 호출, SDK 미사용). AI Pro 부속 월 $10 크레딧 내
- **Cloudflare** — DNS + 프록시 ON, Origin CA 인증서(2041 만료)
- **Artifact Registry** — 서울, docker 포맷. 현재 135MB(무료 범위)

### 런타임 / 인프라

- Node 24 · Docker Compose · nginx
- GCE e2-small (2 vCPU / 2GB) · Ubuntu 24.04 · 고정 IP · 스왑 2GB

### 인증 / 권한

- **WIF (Workload Identity Federation)** — CI가 장기 비밀키 없이 키리스 인증
- **IAP TCP 터널** — SSH 22번을 인터넷에서 제거(`35.235.240.0/20`만 허용)
- 배포 SA / VM 컴퓨트 SA 역할 분리 (최소 권한)

> 📎 인프라 구성도 이미지 첨부 (infra-overview "04 접근 제어 & IAM")

### 환경변수 (`.env`)

```
NODE_ENV=production
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_JWT_ISSUER
SUPABASE_STORAGE_BUCKET=writing-images
GEMINI_API_KEY / GEMINI_MODEL=gemini-2.5-flash
SIMILARITY_MAX_CONCURRENCY=3
```

---

## 부록 · 커리큘럼 매핑 (심사 가점)

| 과목 | 적용 지점 |
| --- | --- |
| UNIX시스템 | VM 운영, cron(헬스체크), systemd |
| 정보통신망 | Cloudflare DNS → 프록시 → nginx 리버스 프록시 계층 |
| 컴퓨터보안 | TLS(Origin CA), IAP, WIF 키리스, presigned URL, 최소 권한 |
| 운영체제 | 컨테이너 격리(namespace/cgroup), 메모리 제한, 인프로세스 비동기 |
| 클라우드컴퓨팅 | IaaS 선택(ADR), IAM |
| 데이터베이스시스템 | 정규화, 복합 PK, **원자적 잡 클레임(동시성 제어)** |
| 소프트웨어공학 | ADR 문서, 교체 경계(seam) 명시, **큐 3단 변천(구현 전 폐기)**, CI/CD |
