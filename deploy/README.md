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

# ✅ SSH는 IAP 전용으로 전환 완료 (2026-07-13, 이슈 B 해결) — default-allow-ssh/rdp 삭제됨
#    22번은 IAP 대역(35.235.240.0/20)만 허용. 접속하려면 IAM에
#    roles/iap.tunnelResourceAccessor 필요 + --tunnel-through-iap 플래그 필수:
gcloud compute firewall-rules create allow-ssh-iap \
  --network=default --direction=INGRESS --action=ALLOW \
  --rules=tcp:22 --source-ranges=35.235.240.0/20
gcloud compute ssh reverse-vm --zone=asia-northeast3-a --tunnel-through-iap

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

## 5. 기동 (레지스트리 빌드 — 이슈 A 해결)

이미지는 **VM에서 빌드하지 않는다.** GitHub Actions가 빌드해 Artifact Registry(서울)로
push하고 VM은 pull만 한다(§6). 평소 배포는 워크플로가 하고, 수동 기동은 아래처럼:

```bash
cd ~/reverse
cp back/reverse_backend/deploy/docker-compose.prod.yml docker-compose.yml
# Artifact Registry 로그인 (VM 기본 SA 메타데이터 토큰)
TOKEN=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token \
  | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
echo "$TOKEN" | docker login -u oauth2accesstoken --password-stdin https://asia-northeast3-docker.pkg.dev
docker compose pull && docker compose up -d
docker compose ps                       # web/api 둘 다 Up 확인
curl -sk https://localhost/api/health   # 로컬 확인 (SNI 없이 -k)
```

> ✅ VM 빌드 부하 0(이슈 A 해소). 이미지에 `:latest` + `:<git-sha>` 태그가 붙어 롤백 가능:
> 특정 sha로 되돌리려면 그 태그를 pull해 compose의 `:latest` 자리에 쓰거나 재태그한다.

## 6. CI/CD (GitHub Actions — 레지스트리 빌드 + WIF + IAP, 하루 1회)

워크플로 `.github/workflows/deploy.yml`가 **매일 19:00 UTC(04:00 KST)** + 수동 실행으로 두 잡:
- **build-push**: 두 레포(백엔드 자기 자신 + 프론트 `reverse_app`) 체크아웃 → `api`/`web` 이미지
  빌드 → Artifact Registry(`asia-northeast3-docker.pkg.dev/reverse-502210/reverse`)로
  `:<git-sha>`+`:latest` push. (러너에서 빌드하므로 2GB VM은 빌드 부하 0)
- **deploy**: IAP 터널로 VM 접속 → 설정(compose/nginx)만 `git pull` → AR 로그인 → `docker
  compose pull` → `up -d`.

인증은 **Workload Identity(키리스)** — 장기 비밀키를 GitHub에 저장하지 않는다.

GCP 측 셋업(서비스계정 `deploy@`; 역할 `iap.tunnelResourceAccessor`+`compute.instanceAdmin.v1`+
**컴퓨트 기본 SA에 대한 `iam.serviceAccountUser`**+**AR `artifactregistry.writer`**;
VM 기본 SA에 **AR `artifactregistry.reader`**; Workload Identity Pool `github-pool`/Provider
`github`; 레포 principalSet 바인딩; AR 저장소 `reverse`(서울, docker))은 **2026-07-13 gcloud로
구성 완료**. 재현이 필요하면 git log 및 `docs/PROGRESS.md` 참고.

> 💡 함정: `serviceAccountUser`가 없으면 러너의 `gcloud compute ssh`가 SSH 키를 인스턴스
> 메타데이터에 못 써서 실패한다(`The user does not have access to service account …`).
> VM에 기본 컴퓨트 SA가 붙어 있어 메타데이터 SSH 키 주입에 actAs 권한이 필요하기 때문.
> (프로젝트 전역 메타데이터 쓰기는 권한이 없어 실패하지만 인스턴스 단위로 폴백돼 정상 동작.)

**남은 사람 작업 — GitHub Secrets 2개만 추가**하면 즉시 동작
(레포 Settings > Secrets and variables > Actions > New repository secret):

| Secret | 값 |
| --- | --- |
| `WIF_PROVIDER` | `projects/691089332676/locations/global/workloadIdentityPools/github-pool/providers/github` |
| `DEPLOY_SA` | `deploy@reverse-502210.iam.gserviceaccount.com` |

둘 다 비밀이 아니라 식별자일 뿐이다(민감정보 아님). 추가 후 Actions 탭에서 **Run workflow**로
즉시 검증 가능. 매일 스케줄이 돌려면 VM이 켜져 있어야 한다(쉴 때 stop 하면 그날 배포는 실패).

> ℹ️ 이전 SSH 키 기반 템플릿(`github-deploy.yml.example`)은 IAP 전환으로 폐기(삭제됨, 이슈 B 해결).

## 7. 운영 잔손질

> **2026-07-13 완료**: 아래 크론·스냅샷·Ops Agent 모두 구성됨. VM TZ는 실제로 `Etc/UTC`였던 걸
> `Asia/Seoul`로 정정(문서 기록과 불일치했음) → 크론 `0 9`가 09:00 KST로 정확히 동작.

- [x] **Supabase 비활성 방지 크론** — 매일 **09:00 KST** `/api/health/db`(DB 실쿼리) 호출.
  `/api/health`는 프로세스 생존만 보고 DB를 안 건드려 "DB 활동" 기준 비활성 판정을 못 막으므로 반드시 `/db`.
  ```bash
  # etri405a 크론탭에 설치됨 (VM TZ=Asia/Seoul)
  0 9 * * * curl -fsS https://reverse-growthlog.com/api/health/db > /dev/null 2>&1
  ```
- [x] **주간 스냅샷** — 리소스 정책 `weekly-snap`(일 18:00 UTC=월 03:00 KST, 14일 보관,
  디스크 삭제 시 유지)을 부팅 디스크 `reverse-vm`에 연결.
  ```bash
  gcloud compute resource-policies create snapshot-schedule weekly-snap \
    --region=asia-northeast3 --max-retention-days=14 --start-time=18:00 \
    --weekly-schedule=sunday --on-source-disk-delete=keep-auto-snapshots
  gcloud compute disks add-resource-policies reverse-vm --resource-policies=weekly-snap --zone=asia-northeast3-a
  ```
- [x] **Ops Agent** — 게스트 메모리/디스크/로그 수집(콘솔 → Monitoring → VM Instances / 인스턴스
  Observability 탭에서 확인). 에이전트 ~163MB RSS(otelopscol+fluent-bit), 설치 후 available 1.2Gi로 안전.
  ```bash
  curl -sSO https://dl.google.com/cloudagents/add-google-cloud-ops-agent-repo.sh
  sudo bash add-google-cloud-ops-agent-repo.sh --also-install
  ```
- [ ] (선택) 가동시간 체크 + 알림 정책(사이트 다운 이메일) — 미구성
- [ ] **대회 종료 후**: 스냅샷 뜨고 인스턴스 **중지** → 과금 중단 (고정 IP는 미연결 상태면 과금되니 함께 해제)
