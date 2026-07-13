# 배포 런북 (GCE VM + Docker Compose)

`docs/ARCHITECTURE_v2.1.md` §7 체크리스트의 실행판. 위에서 아래로 순서대로 진행한다.

> **진행 상태 (2026-07-13)**: §5까지 완료 — https://reverse-growthlog.com **전체 스택 라이브**
> (web/api/health/db 200, 실키 `.env` 배치 완료). 남은 것: §6 CI/CD, §7 운영 잔손질,
> 이슈 A·B 결정(`docs/PROGRESS.md` 참고). 며칠 쉴 땐 VM 중지:
> `gcloud compute instances stop reverse-vm --zone=asia-northeast3-a`

## 0. 선행조건 (사람이 준비할 것)

- [ ] **GCP 계정 + 결제 활성화** — 예산 알림 ₩10,000/₩30,000 구간 설정 (콘솔 → 결제 → 예산 및 알림)
- [ ] **도메인** 1개 + **Cloudflare 계정**에 해당 도메인 등록 (네임서버 이전)
- [ ] `gcloud` CLI 설치·로그인(`gcloud auth login`) — 또는 GCP 콘솔의 Cloud Shell 사용
- [ ] **Supabase 키** (`.env.example`의 4개 값) — 없으면 API 컨테이너가 부팅 검증에서 죽는다
- [ ] Gemini API 키 (현재 `.env.local` 방식 — VM에서는 `.env`에 합쳐서 넣으면 된다)

## 1. VM 생성 (로컬 또는 Cloud Shell)

```bash
gcloud config set project <프로젝트ID>

# 고정 외부 IP 예약 (VM에 연결된 동안은 무료)
gcloud compute addresses create reverse-ip --region=asia-northeast3

# e2-small / 서울 / Ubuntu 24.04 / 디스크 30GB
gcloud compute instances create reverse-vm \
  --zone=asia-northeast3-a \
  --machine-type=e2-small \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --address=reverse-ip \
  --tags=http-server,https-server

# ⚠️ 80/443 방화벽 규칙은 직접 만들어야 한다. http-server 태그에 매칭되는
#    default-allow-http/https 규칙은 콘솔 체크박스로 VM을 만들 때만 자동 생성됨
#    (없으면 Cloudflare가 오리진에 못 붙어 522가 난다 — 2026-07-12 실측)
gcloud compute firewall-rules create default-allow-http \
  --network=default --direction=INGRESS --action=ALLOW \
  --rules=tcp:80 --source-ranges=0.0.0.0/0 --target-tags=http-server
gcloud compute firewall-rules create default-allow-https \
  --network=default --direction=INGRESS --action=ALLOW \
  --rules=tcp:443 --source-ranges=0.0.0.0/0 --target-tags=https-server

# (권장) SSH 22 포트를 내 IP로 제한하려면 default-allow-ssh 대신 커스텀 규칙 사용
gcloud compute addresses describe reverse-ip --region=asia-northeast3 --format='get(address)'
```

## 2. VM 초기 셋업

```bash
gcloud compute ssh reverse-vm --zone=asia-northeast3-a
# VM 안에서:
curl -fsSL https://raw.githubusercontent.com/Lynne-techy/reverse_backend/main/deploy/setup-vm.sh | bash
# (또는 레포 clone 후 bash deploy/setup-vm.sh)
exit  # docker 그룹 반영을 위해 재접속
```

스크립트가 하는 일: 스왑 2GB, ufw(22/80/443), fail2ban, Docker 설치,
SSH 비밀번호 로그인 비활성화. 상세는 `setup-vm.sh` 주석 참고.

## 3. 코드 배치

```bash
mkdir -p ~/reverse && cd ~/reverse
git clone https://github.com/Lynne-techy/reverse_backend back/reverse_backend
git clone https://github.com/Lynne-techy/reverse_app front/reverse_app

# 결합 compose(프로덕션판)를 루트로 복사 — 갱신 시 재복사 필요 (CI 스크립트가 매번 해준다)
cp back/reverse_backend/deploy/docker-compose.prod.yml docker-compose.yml

# 환경변수: .env.example 참고해 작성 (Supabase 4개 + GEMINI_API_KEY, NODE_ENV=production)
nano back/reverse_backend/.env
```

## 4. Cloudflare

- [ ] DNS: A 레코드 `<도메인>` → VM 고정 IP, **프록시 ON**(주황 구름)
- [ ] SSL/TLS 모드: **Full (strict)**
- [ ] Origin Server → **Origin CA 인증서** 발급(15년) → VM의 `~/reverse/certs/`에 저장:
  ```bash
  mkdir -p ~/reverse/certs
  # origin.pem(인증서), origin-key.pem(개인키) 두 파일. 권한: chmod 600 certs/origin-key.pem
  ```
- [ ] R2는 이미지 저장 R2 전환 시점에 (지금은 Supabase Storage)

## 5. 기동

```bash
cd ~/reverse && docker compose up -d --build
docker compose ps                       # web/api 둘 다 Up 확인
curl -sk https://localhost/api/health   # 로컬 확인 (SNI 없이 -k)
# 브라우저: https://<도메인>  /  https://<도메인>/api/health
```

> ⚠️ **2GB RAM에서 빌드가 가장 위험한 순간** — 다른 터미널에서 `watch -n2 free -h`로
> OOM을 감시할 것. 재배포 시엔 실행 중인 컨테이너까지 떠 있어 더 빠듯하다.
> 빌드 OOM이 반복되면 "GitHub Actions 빌드 → Artifact Registry(서울) push → VM은
> pull만" 구조로 전환 검토 (진행 기록 이슈 A — 결정 대기).

## 6. CI/CD (GitHub Actions)

1. VM에 배포용 키 생성: `ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ''`,
   공개키를 `~/.ssh/authorized_keys`에 추가.
2. 백엔드 레포 Secrets: `DEPLOY_HOST`(고정 IP), `DEPLOY_USER`, `DEPLOY_SSH_KEY`(개인키).
3. `deploy/github-deploy.yml.example` → `.github/workflows/deploy.yml`로 이동 후 push.
   (VM이 없는 동안 워크플로가 매번 실패하지 않도록 example로 둔 것)

> ⚠️ **SSH 22 제한과 모순 주의**: 22번을 내 IP 대역으로 잠그면 GitHub Actions
> 러너(유동 IP)가 접속 불가. 대안: **IAP TCP 포워딩** — 방화벽은
> `35.235.240.0/20`(IAP 대역)만 허용하고 `gcloud compute ssh --tunnel-through-iap`
> 사용, ufw에도 같은 대역 반영. 22가 인터넷에 아예 노출되지 않고 신원 기반
> 접근 제어라 보안 과목 어필도 강함 (진행 기록 이슈 B — 결정 대기).

## 7. 운영 잔손질

- [ ] Supabase 무료 플랜 7일 비활성 정지 방지 크론 (UNIX 과목 어필 겸 VM cron).
  **반드시 `/api/health/db`를 호출할 것** — `/api/health`는 프로세스 생존만 보고
  DB를 안 건드려서 "DB 활동" 기준인 비활성 판정을 못 막는다:
  ```bash
  crontab -e   # 매일 09:00 (VM TZ=Asia/Seoul 기준)
  0 9 * * * curl -fsS https://reverse-growthlog.com/api/health/db > /dev/null 2>&1
  ```
- [ ] Ops Agent 설치 → Cloud Monitoring 대시보드
- [ ] 스냅샷 스케줄 주 1회 (콘솔 → Compute Engine → 스냅샷)
- [ ] **대회 종료 후**: 스냅샷 뜨고 인스턴스 **중지** → 과금 중단 (고정 IP는 미연결 상태면 과금되니 함께 해제)
