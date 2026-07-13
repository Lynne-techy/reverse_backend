# 로컬 개발 환경 매뉴얼

dev용 VM을 따로 파지 않고 **내 PC에서 무료로** dev 스택을 띄우는 방법. 두 가지 방식이 있다.

- **방식 A — 도커 결합 스택**: 프로덕션과 거의 동일한 구성(nginx + api)을 `http://localhost:8080`에
  띄운다. "실서버처럼" 확인할 때. 코드 바꾸면 재빌드 필요(핫리로드 아님).
- **방식 B — 백엔드만 네이티브 실행**: `npm run start:dev`로 백엔드만 빠르게 돌린다(저장 시 자동
  재시작). 백엔드 로직 반복 작업엔 이게 훨씬 빠르다. 프론트/nginx는 안 뜬다.

> ⚠️ **공용 Supabase 주의**: 현재 Supabase 프로젝트는 **하나뿐**이라 로컬 dev도 프로덕션과
> **같은 DB에 씀**. 로컬에서 만든 유저/필사 데이터가 운영 DB에 섞인다. 완전 분리하려면 dev용
> Supabase 프로젝트를 따로 만들어 `.env`의 `SUPABASE_*` 값만 교체하면 된다(선택).

---

## 전제 조건 (최초 1회)

1. **Docker Desktop 설치** (Windows는 WSL2 백엔드 권장) → 실행 후 `docker version`으로 확인.
   - 이 프로젝트는 Compose v2 사용: 명령은 `docker compose`(붙여쓰기), `docker-compose` 아님.
2. **디렉터리 배치** — 두 레포가 형제로 있어야 한다(결합 compose가 상대경로로 참조):
   ```
   reverse/
   ├─ back/reverse_backend    (이 레포)
   └─ front/reverse_app       (프론트 레포, Dockerfile 포함 브랜치로 체크아웃)
   ```
   ```bash
   mkdir reverse && cd reverse
   git clone https://github.com/Lynne-techy/reverse_backend back/reverse_backend
   git clone https://github.com/Lynne-techy/reverse_app     front/reverse_app
   ```
3. **`.env` 준비** — 도커는 `.env.local`이 아니라 `back/reverse_backend/.env`를 읽는다
   (`.env*`는 `.dockerignore`로 이미지에 안 들어가고, 런타임에 `env_file`로 주입됨).
   `.env.local`이 이미 `NODE_ENV=development`라 그대로 복사하면 된다:
   ```bash
   cp back/reverse_backend/.env.local back/reverse_backend/.env
   ```
   (Supabase 4개 + `GEMINI_API_KEY`가 채워져 있어야 api가 부팅 검증을 통과한다.)

---

## 방식 A — 도커 결합 스택 (프로덕션 유사)

`reverse/` 디렉터리에서:

```bash
# dev용 결합 compose를 루트로 복사 (프로덕션판은 docker-compose.prod.yml)
cp back/reverse_backend/deploy/docker-compose.dev.yml docker-compose.yml

docker compose up --build          # 포그라운드(로그 보임). 백그라운드는 -d 추가
```

접속:
- 프론트: <http://localhost:8080>
- 백엔드(nginx 경유): <http://localhost:8080/api/health>, `/api/health/db`
- Swagger: <http://localhost:8080/api-docs> (dev = `NODE_ENV=development`라 노출됨)

종료 / 재시작:
```bash
docker compose down                # 중지 + 컨테이너 삭제
docker compose up --build          # 코드 수정 후에는 --build 로 다시 (핫리로드 아님)
```

> 프로덕션과 다른 점: dev는 HTTP·8080만(TLS·80/443·Cloudflare 없음), api는 호스트에 직접
> 노출 안 되고 nginx(web) 뒤에만 있다. TLS 종단은 `docker-compose.prod.yml`에서만.

---

## 방식 B — 백엔드만 네이티브 (빠른 반복)

프론트/nginx 없이 백엔드만 고칠 때. Node 22 권장(도커 이미지가 `node:22-alpine`).

```bash
cd back/reverse_backend
npm install
npm run start:dev                  # 파일 저장 시 자동 재시작(watch)
```

- 이 방식은 `.env.local`을 직접 읽는다(config가 `.env`/`.env.local` 모두 로드). `.env` 복사 불필요.
- 접속: <http://localhost:3000/api/health> (nginx 없이 api 직접, 프리픽스 `/api` 유지).
- Swagger: <http://localhost:3000/api-docs>.

---

## 자주 겪는 문제

- **api 컨테이너가 부팅 즉시 죽음**: `.env` 값 누락(대개 Supabase 키). `docker compose logs api`로
  env 검증 에러 확인. 방식 A는 `.env`(복사본)를, 방식 B는 `.env.local`을 본다는 점 유의.
- **8080 포트 충돌**: 다른 앱이 쓰는 중. `docker-compose.yml`의 `8080:80`을 다른 포트로 바꾼다.
- **`/api`가 502**: api 컨테이너가 안 떠 있음(web은 정상). 위 로그 확인. (nginx는 api가 죽어도
  web은 살아있게 설계됨 — `nginx.conf` resolver 지연 해석.)
- **프론트 빌드 실패**: 미배선 페이지의 tsc 오류로 `npm run build`(tsc -b)가 깨질 수 있음 —
  도커 빌드는 `vite build`만 사용하므로 결합 스택엔 영향 없음(프론트 레포 이슈).
