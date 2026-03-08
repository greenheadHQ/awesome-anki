# NixOS 설정 상세

NixOS 설정 레포: `~/Workspace/nixos-config` (GitHub: `greenheadHQ/nixos-config`)

## 핵심 파일 경로

| 파일 | 역할 |
|------|------|
| `modules/nixos/programs/docker/awesome-anki.nix` | 컨테이너 서비스 정의 |
| `modules/nixos/programs/caddy.nix` | Caddy 리버스 프록시 |
| `modules/nixos/programs/anki-connect/default.nix` | headless AnkiConnect |
| `modules/nixos/programs/anki-connect/sync.nix` | AnkiConnect 자동 동기화 |
| `modules/nixos/programs/anki-sync-server/default.nix` | Anki Sync Server |
| `modules/nixos/programs/anki-sync-server/backup.nix` | 일일 백업 (04:00 KST) |
| `modules/nixos/options/homeserver.nix` | 서비스 on/off 옵션 |
| `libraries/constants.nix` | 포트, 경로, 리소스, SSH 키 |
| `secrets/secrets.nix` | agenix 시크릿 매핑 |
| `hosts/greenhead-minipc/default.nix` | 호스트별 설정 |
| `modules/nixos/configuration.nix` | 메인 NixOS 설정 |

## 서비스 옵션

```nix
# modules/nixos/options/homeserver.nix
homeserver.awesomeAnki = {
  enable = true;   # 서비스 활성화
  port = 3100;     # 컨테이너 포트
};
```

## 컨테이너 서비스 (awesome-anki.nix)

### 서비스 구조

1. **awesome-anki-env** (oneshot): agenix 시크릿 복호화 → `/run/awesome-anki-env` 생성
2. **podman-awesome-anki**: 컨테이너 실행 (env 서비스 완료 후)

### tmpfiles 규칙

```nix
systemd.tmpfiles.rules = [
  "d /var/lib/docker-data/awesome-anki 0755 1001 1001 -"
  "d /var/lib/docker-data/awesome-anki/data 0755 1001 1001 -"
  "d /var/lib/docker-data/awesome-anki/output 0755 1001 1001 -"
];
```

### 컨테이너 환경변수

env 파일(`/run/awesome-anki-env`)에서 로드:
- `OPENAI_API_KEY` ← `awesome-anki-openai-key.age`
- `GEMINI_API_KEY` ← `awesome-anki-gemini-key.age`

추가 환경변수 (Nix에서 직접 설정):
- `ANKI_CONNECT_URL=http://100.79.80.95:8765`
- `ANKI_SPLITTER_REQUIRE_API_KEY=false`
- `PORT=3100`

### 리소스 제한

`constants.nix`에서 관리:
- 메모리: 1GB
- CPU: 1 core

## Caddy 리버스 프록시 (caddy.nix)

### 가상 호스트

```
anki.greenhead.dev {
  bind 100.79.80.95          # Tailscale IP만
  reverse_proxy localhost:3100
  # + 보안 헤더 (HSTS, nosniff 등)
}
```

### SSL 인증서

- **방식**: Cloudflare DNS-01 ACME
- **플러그인**: `github.com/caddy-dns/cloudflare@v0.2.2`
- **토큰**: agenix `cloudflare-dns-api-token.age` → `/run/caddy/env`
- **자동 갱신**: Caddy가 처리

### Caddy 기동 순서

1. `tailscaled.service` 시작 대기
2. `caddy-env.service` (Cloudflare 토큰 복호화)
3. Tailscale IP 가용성 확인 (`ExecStartPre`)
4. Caddy 시작

## AnkiConnect (anki-connect/)

### headless Anki 구성

- **포트**: 8765
- **바인드**: 100.79.80.95 (Tailscale IP)
- **프로필**: `server`
- **데이터**: `/var/lib/anki/.local/share/Anki2/server/`
- **시스템 유저**: `anki` (isSystemUser)

### Config API (awesome-anki 전용)

AnkiConnect 커스텀 패치로 `getConfig`/`setConfig` 액션 추가:
- 허용 키 접두사: `["awesomeAnki."]`
- 최대 값 크기: 65536 바이트
- 패치: `modules/nixos/programs/anki-connect/addons/anki-connect-config-actions.patch`

### 자동 동기화 (sync.nix)

- **타이머**: 부팅 90초 후 시작, 5분 주기
- **대상**: Anki Sync Server (`http://100.79.80.95:27701`)
- **부트스트랩**: 첫 실행 시 Sync Server에서 컬렉션 복사
- **최대 재시도**: 3회

## Anki Sync Server

- **포트**: 27701
- **바인드**: 100.79.80.95
- **데이터**: `/var/lib/anki-sync-server/greenhead/`
- **백업**: 매일 04:00 KST → `/mnt/data/backups/anki/{YYYY-MM-DD}/`
- **보존**: 7일

## agenix 시크릿

### awesome-anki 관련

| 시크릿 파일 | 용도 |
|-------------|------|
| `awesome-anki-openai-key.age` | OpenAI API 키 (임베딩) |
| `awesome-anki-gemini-key.age` | Gemini API 키 (Split/검증) |

### 복호화 흐름

1. NixOS activation → agenix가 SSH ed25519 키로 복호화
2. `awesome-anki-env` 서비스가 `KEY=` 접두사 제거
3. `/run/awesome-anki-env` 파일 생성 (mode 0400)
4. 컨테이너 시작 시 `--env-file` 로 로드

### 관련 시크릿

- `cloudflare-dns-api-token.age` — Caddy HTTPS 인증서
- `anki-sync-password.age` — Anki Sync Server + AnkiConnect 부트스트랩

## 네트워크 보안

### Tailscale 격리

- 모든 서비스가 Tailscale IP(100.79.80.95)에만 바인드
- SSH는 Tailscale 인터페이스(tailscale0)만 신뢰
- 외부 방화벽 포트 열림 없음 (SSH openFirewall = false)
- WireGuard 암호화로 트래픽 보호

### 왜 --network=host인가

AnkiConnect가 Tailscale IP에서만 리스닝하므로, 일반 Docker bridge 네트워크에서는 접근 불가.
`--network=host`로 호스트 네트워크 스택을 공유해야 AnkiConnect에 도달 가능.
보안은 Tailscale 방화벽이 담당.
