# 서버 트러블슈팅

## 컨테이너 문제

### 컨테이너가 시작되지 않음

```bash
# 1. systemd 상태 확인
systemctl status podman-awesome-anki
systemctl status awesome-anki-env

# 2. env 파일 생성 확인
ls -la /run/awesome-anki-env

# 3. agenix 시크릿 복호화 확인
sudo cat /run/agenix/awesome-anki-openai-key
sudo cat /run/agenix/awesome-anki-gemini-key

# 4. 컨테이너 로그
podman logs awesome-anki

# 5. 재시작
systemctl restart awesome-anki-env
systemctl restart podman-awesome-anki
```

**원인 패턴**:
- env 서비스 실패 → 시크릿 복호화 키(`/home/greenhead/.ssh/id_ed25519`) 확인
- 이미지 pull 실패 → `podman pull ghcr.io/greenheadhq/awesome-anki:latest` 수동 시도
- 포트 충돌 → `ss -tlnp | grep 3100`

### Health check 실패

```bash
# 컨테이너 내부에서 직접 확인
curl http://localhost:3100/api/health

# Caddy 경유 확인
curl https://anki.greenhead.dev/api/health

# 서버 시작 로그 확인 (DB 마이그레이션, 프로바이더 검증 등)
podman logs --tail 30 awesome-anki
```

### 볼륨 권한 문제

```bash
# 권한 확인
ls -la /var/lib/docker-data/awesome-anki/

# UID/GID 1001로 재설정
sudo chown -R 1001:1001 /var/lib/docker-data/awesome-anki/data
sudo chown -R 1001:1001 /var/lib/docker-data/awesome-anki/output
```

## 자동 업데이트 문제

### podman auto-update가 실행되지 않음

```bash
# 1. 타이머 상태 확인
systemctl list-timers | grep podman-auto-update

# 2. 서비스 로그
journalctl -u podman-auto-update -n 20

# 3. 수동 실행 테스트
podman auto-update --dry-run

# 4. 라벨 확인
podman inspect awesome-anki --format '{{.Config.Labels}}'
# 기대값: map[io.containers.autoupdate:registry ...]
```

**원인 패턴**:
- 타이머 미활성화 → `systemctl enable --now podman-auto-update.timer`
- 라벨 누락 → `awesome-anki.nix`에 `labels` 설정 확인 후 `nixos-rebuild switch`
- 네트워크 오류 → `podman pull ghcr.io/greenheadhq/awesome-anki:latest` 수동 시도

### auto-update 후 컨테이너 비정상

```bash
# 1. 컨테이너 상태 확인
podman ps -a | grep awesome-anki

# 2. 최근 이미지 확인
podman images | grep awesome-anki

# 3. health check
curl http://localhost:3100/api/health

# 4. 수동 롤백 (이전 이미지 sha 사용)
podman pull ghcr.io/greenheadhq/awesome-anki:sha-<이전커밋>
systemctl restart podman-awesome-anki
```

## AnkiConnect 연결 문제

### AnkiConnect가 응답하지 않음

```bash
# 1. 서비스 상태
systemctl status anki-connect
journalctl -u anki-connect -n 50

# 2. Tailscale IP 확인
tailscale ip -4
# 기대값: 100.79.80.95

# 3. 직접 연결 테스트
curl http://100.79.80.95:8765

# 4. 프로세스 확인
pgrep -la anki

# 5. 재시작
systemctl restart anki-connect
```

**원인 패턴**:
- Tailscale이 아직 연결되지 않음 → `tailscale status`
- Anki 프로세스 크래시 → journalctl 로그에서 Python traceback 확인
- 프로필 문제 → `/var/lib/anki/.local/share/Anki2/server/` 디렉토리 존재 확인

### awesome-anki에서 AnkiConnect 도달 불가

- `--network=host` 설정 확인 (awesome-anki.nix)
- `ANKI_CONNECT_URL` 환경변수 확인: `http://100.79.80.95:8765`
- anki-connect 서비스가 컨테이너보다 먼저 시작되었는지 확인

### AnkiConnect 동기화 실패

```bash
# 수동 동기화
systemctl start anki-connect-sync
journalctl -u anki-connect-sync -n 20

# Sync Server 상태
systemctl status anki-sync-server
curl http://100.79.80.95:27701
```

## Caddy / SSL 문제

### HTTPS 인증서 오류

```bash
# 1. Cloudflare 토큰 확인
sudo cat /run/caddy/env

# 2. Caddy 로그
journalctl -u caddy -n 100

# 3. 인증서 저장소
ls -la /var/lib/caddy/.local/share/caddy/certificates/

# 4. Caddy 재로드
systemctl reload caddy
```

**원인 패턴**:
- Cloudflare API 토큰 만료 → 새 토큰 생성 후 시크릿 재암호화
- DNS 전파 지연 → 잠시 기다린 후 재시도
- Tailscale IP 변경 → Caddy 설정 업데이트 필요

### 도메인 접속 불가

```bash
# Tailscale IP에서 직접 확인
curl -k https://100.79.80.95/api/health

# DNS 해석 확인 (클라이언트에서)
nslookup anki.greenhead.dev

# Caddy 바인드 확인
ss -tlnp | grep 443
```

## nixos-rebuild 실패

### 일반적인 대처

```bash
# 에러 메시지 확인
sudo nixos-rebuild switch --flake .#greenhead-minipc 2>&1 | tail -50

# 평가만 먼저 테스트 (빌드 없이)
nix eval .#nixosConfigurations.greenhead-minipc.config.homeserver.awesomeAnki.enable

# 드라이 런
sudo nixos-rebuild dry-activate --flake .#greenhead-minipc
```

**원인 패턴**:
- 플레이크 입력 잠금 오류 → `nix flake update`
- 모듈 타입 오류 → NixOS 옵션 타입 확인 (`homeserver.nix`)
- 시크릿 파일 누락 → `secrets/` 디렉토리에 `.age` 파일 존재 확인
- 디스크 공간 부족 → `nix-collect-garbage -d`

### 원격 빌드 (MacBook에서)

```bash
nixos-rebuild switch \
  --flake .#greenhead-minipc \
  --target-host greenhead@100.79.80.95
```

원격 빌드 실패 시 MiniPC에 직접 SSH 접속하여 빌드 권장.

## 로그 확인 종합

```bash
# 전체 관련 서비스 로그
journalctl -u podman-awesome-anki -u anki-connect -u caddy -n 200

# 특정 시간대
journalctl -u podman-awesome-anki --since "1 hour ago"

# 실시간 모니터링
journalctl -u podman-awesome-anki -f
```

## 데이터 복구

### awesome-anki 데이터

```bash
# 수동 백업
sudo rsync -av /var/lib/docker-data/awesome-anki/ /mnt/data/backups/awesome-anki-manual/

# 복구
sudo rsync -av /mnt/data/backups/awesome-anki-manual/ /var/lib/docker-data/awesome-anki/
systemctl restart podman-awesome-anki
```

### Anki 컬렉션

Anki Sync Server 백업에서 복구 (7일 롤링):
```bash
ls /mnt/data/backups/anki/
# YYYY-MM-DD 형태의 디렉토리 목록

# 특정 날짜 복구
sudo systemctl stop anki-connect
sudo rsync -av /mnt/data/backups/anki/2026-03-06/ /var/lib/anki-sync-server/greenhead/
sudo systemctl start anki-sync-server
sudo systemctl start anki-connect
```
