---
name: deploying-server
description: |
  MiniPC 서버 배포, 컨테이너 관리, NixOS 설정, 도메인/SSL, 트러블슈팅 등
  서버 인프라 관련 작업이면 반드시 이 스킬을 먼저 확인할 것.
  Triggers: "서버 배포", "컨테이너 재시작", "MiniPC", "anki.greenhead.dev",
  "nixos-rebuild", "Podman", "Docker", "서버 로그", "서버 에러",
  "Caddy", "리버스 프록시", "SSL 인증서", "배포", "deploy",
  "서버 접속", "Tailscale SSH", "서버 상태", "health check 실패",
  "컨테이너 로그", "이미지 업데이트", "서버 설정 변경",
  "agenix 시크릿", "AnkiConnect 서버", "headless Anki".
  Covers: MiniPC NixOS hosting, Podman container, Caddy reverse proxy,
  Tailscale networking, agenix secrets, systemd service order,
  and server troubleshooting.
---

# 서버 배포 및 운영

## 인프라 개요

```
사용자 (Tailscale VPN)
  ↓ HTTPS
anki.greenhead.dev (Caddy, :443)
  ↓ reverse_proxy
awesome-anki 컨테이너 (Podman, :3100)
  ↓ host network
AnkiConnect (headless Anki, :8765)
  ↓ 5분 주기 sync
Anki Sync Server (:27701)
```

## MiniPC 접속

- **호스트명**: greenhead-minipc
- **Tailscale IP**: 100.79.80.95
- **SSH**: `ssh greenhead@100.79.80.95` (키 인증만 허용, 비밀번호 불가)
- **NixOS 설정**: `~/Workspace/nixos-config` (GitHub: `greenheadHQ/nixos-config`)

## 컨테이너 구성

| 항목 | 값 |
|------|-----|
| 이미지 | `ghcr.io/greenheadhq/awesome-anki:latest` |
| 런타임 | Podman (NixOS `virtualisation.oci-containers`) |
| 포트 | 3100 (`--network=host`) |
| 메모리 | 1GB |
| CPU | 1 core |
| 볼륨 | `/var/lib/docker-data/awesome-anki/data` → `/app/data` |
|  | `/var/lib/docker-data/awesome-anki/output` → `/app/output` |
| UID/GID | 1001 (anki) |

`--network=host`를 사용하는 이유: AnkiConnect가 Tailscale IP(100.79.80.95:8765)에서만 리스닝하므로, 컨테이너가 호스트 네트워크 스택을 공유해야 접근 가능. Tailscale 방화벽 + WireGuard 암호화로 보안 보장.

## 환경변수

| 변수 | 소스 | 용도 |
|------|------|------|
| `GEMINI_API_KEY` | agenix (`awesome-anki-gemini-key.age`) | Split/검증 LLM |
| `OPENAI_API_KEY` | agenix (`awesome-anki-openai-key.age`) | 임베딩 |
| `ANKI_CONNECT_URL` | 하드코딩 `http://100.79.80.95:8765` | AnkiConnect 연결 |
| `PORT` | `3100` | 서버 포트 |
| `ANKI_SPLITTER_REQUIRE_API_KEY` | `false` | Tailscale 내부망이므로 비활성화 |

환경변수 파일은 `awesome-anki-env` systemd oneshot 서비스가 agenix 시크릿을 복호화하여 `/run/awesome-anki-env`에 생성.

## 리버스 프록시 (Caddy)

- **도메인**: `anki.greenhead.dev`
- **바인드**: Tailscale IP만 (`100.79.80.95:443`)
- **SSL**: Cloudflare DNS-01 ACME (Let's Encrypt 자동 갱신)
- **보안 헤더**: HSTS, X-Content-Type-Options, X-Frame-Options
- **NixOS 설정**: `~/Workspace/nixos-config/modules/nixos/programs/caddy.nix`

## systemd 서비스 기동 순서

```
tailscaled → anki-sync-server → anki-connect
                                      ↓
caddy-env → caddy       awesome-anki-env → podman-awesome-anki
```

핵심 의존성: `awesome-anki-env` (시크릿 복호화) 완료 후에만 컨테이너 시작.

## CI/CD 파이프라인

1. `main` push 또는 `v*` 태그 push → GitHub Actions 트리거
2. Docker Buildx로 이미지 빌드 (GHA 캐시)
3. `ghcr.io/greenheadhq/awesome-anki` 레지스트리에 push
4. MiniPC `podman-auto-update` 타이머 (5분 주기)가 `latest` 태그 변경 감지 → 자동 컨테이너 교체

### 태그 전략

| 트리거 | 생성 태그 |
|--------|----------|
| main push | `latest`, `sha-<hash>` |
| `v1.2.3` tag | `1.2.3`, `1.2`, `latest` |
| `v1.2.3-alpha` tag | `1.2.3-alpha` (latest 없음) |

### 자동 배포 흐름

```
main push → GitHub Actions (~3분) → GHCR latest 갱신
  → MiniPC podman-auto-update (5분 주기) → 이미지 변경 감지
  → stop → pull → start (10-30초 다운타임)
```

실패 시 이전 이미지로 자동 롤백. Tailscale 내부망 전용이므로 짧은 다운타임 수용.

## 빠른 작업 명령어

### 컨테이너 관리
```bash
# 상태 확인
systemctl status podman-awesome-anki

# 로그 확인
podman logs awesome-anki
journalctl -u podman-awesome-anki -n 50

# 재시작
systemctl restart podman-awesome-anki

# 이미지 업데이트 (자동)
# 5분마다 자동 실행 — 수동 개입 불필요
podman auto-update --dry-run  # 업데이트 대기 중인 컨테이너 확인
systemctl status podman-auto-update.timer  # 타이머 상태

# 이미지 업데이트 (수동 — 긴급 시)
podman pull ghcr.io/greenheadhq/awesome-anki:latest
systemctl restart podman-awesome-anki
```

### AnkiConnect 관리
```bash
# 상태 확인
systemctl status anki-connect
curl http://100.79.80.95:8765

# 재시작
systemctl restart anki-connect

# 수동 동기화
systemctl start anki-connect-sync
```

### NixOS 설정 변경
```bash
# MiniPC에서 직접
cd ~/Workspace/nixos-config
sudo nixos-rebuild switch --flake .#greenhead-minipc

# MacBook에서 원격
nixos-rebuild switch --flake .#greenhead-minipc --target-host greenhead@100.79.80.95
```

## 데이터 경로

| 데이터 | 호스트 경로 | 컨테이너 경로 |
|--------|-------------|---------------|
| Split 히스토리 DB | `/var/lib/docker-data/awesome-anki/data/split-history.db` | `/app/data/split-history.db` |
| 프롬프트 | `/var/lib/docker-data/awesome-anki/output/prompts/` | `/app/output/prompts/` |
| 임베딩 캐시 | `/var/lib/docker-data/awesome-anki/output/embeddings/` | `/app/output/embeddings/` |
| 백업 | `/var/lib/docker-data/awesome-anki/output/backups/` | `/app/output/backups/` |
| Anki 컬렉션 | `/var/lib/anki/.local/share/Anki2/server/` | - |
| Anki Sync 백업 | `/mnt/data/backups/anki/{YYYY-MM-DD}/` | - |

## Health Check

- **엔드포인트**: `GET /api/health` (인증 불필요)
- **응답**: `{ status: "ok", timestamp: "..." }`
- **Docker**: 30초 간격, 5초 타임아웃, 3회 재시도, 30초 시작 대기
- **확인**: `curl https://anki.greenhead.dev/api/health`

## 상세 참조

- `references/nixos-config.md` — NixOS 모듈 구조, 설정 옵션, 서비스 의존성
- `references/container-setup.md` — Dockerfile, CI/CD, 볼륨, 이미지 관리
- `references/troubleshooting.md` — 컨테이너/AnkiConnect/Caddy/NixOS 문제 해결
