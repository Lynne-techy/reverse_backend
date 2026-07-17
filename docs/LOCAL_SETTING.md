# 로컬 세팅 Quickstart

클론 직후 **백엔드만 빠르게 띄우는** 최소 절차. 도커 결합 스택·dev Supabase 분리 등 상세는
[`LOCAL_DEV.md`](./LOCAL_DEV.md) 참고.

> 전제: `.env`는 팀에서 별도로 전달받는다(비밀 값이라 저장소에 없음). Node 22 권장(도커 이미지가 `node:22-alpine`).

---

## 1. 클론

```bash
git clone https://github.com/Lynne-techy/reverse_backend.git
cd reverse_backend
```

## 2. 의존성 설치

```bash
npm ci
```

`npm install`이 아니라 `npm ci`를 쓰는 이유: `package-lock.json`에 적힌 **정확한 버전**을 그대로
설치해 팀원 간 버전 차이를 없앤다("내 PC에선 되는데" 방지). lock 파일이 없으면 실패한다.

## 3. `.env` 배치

전달받은 `.env` 파일을 **프로젝트 루트**(`package.json`과 같은 위치)에 그대로 둔다. 별도 명령 없음.

- `src/` 안이 아니라 루트여야 한다(`@nestjs/config`가 루트의 `.env`를 읽음).
- 필요한 값: Supabase 4개(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_ISSUER`,
  `SUPABASE_STORAGE_BUCKET`) + `GEMINI_API_KEY`. 자리표시자는 `.env.example` 참고.

## 4. 실행

```bash
npm run start:dev        # 파일 저장 시 자동 재시작(watch)
```

정상 부팅되면:

- 헬스체크: <http://localhost:3000/api/health>
- Swagger: <http://localhost:3000/api/api-docs>

> 경로에 `/api`가 붙는 이유: `main.ts`의 `setGlobalPrefix('api')` + Swagger 등록 경로 `api-docs`가
> 합쳐져 `/api/api-docs`가 된다.

---

## 자주 겪는 문제

- **부팅 즉시 죽음** → 대개 `.env` 값 누락/오타. 이 프로젝트는 시작 시 환경변수를 zod로 검증해서,
  필수 값이 없으면 어떤 변수가 문제인지 에러로 알려주고 서버를 안 띄운다(fail fast).
- **Swagger가 404** → `NODE_ENV=production`이면 스펙을 노출하지 않도록 Swagger 등록 자체를 건너뛴다.
  로컬은 `NODE_ENV=development`여야 한다.
- **DB 관련 에러** → 팀이 공유 Supabase 프로젝트 하나를 쓰면 마이그레이션은 이미 적용돼 있어 추가
  작업 없음. 개인 Supabase를 따로 쓸 경우 마이그레이션 적용이 필요하다 → [`LOCAL_DEV.md`](./LOCAL_DEV.md).

> ⚠️ 현재 Supabase 프로젝트는 하나뿐이라, 로컬 dev도 **운영과 같은 DB**에 쓴다. 로컬에서 만든
> 유저/필사 데이터가 운영 DB에 섞이니 주의. 완전 분리는 [`LOCAL_DEV.md`](./LOCAL_DEV.md)의 dev Supabase 절차 참고.
