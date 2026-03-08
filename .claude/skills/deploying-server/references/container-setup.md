# 컨테이너 및 CI/CD 설정

## Dockerfile

`Dockerfile` (프로젝트 루트):

### 빌드 스테이지

```
1. deps       — bun:1 기반, bun install --frozen-lockfile
2. web-builder — Vite SPA 빌드 (packages/web/dist)
3. runtime    — bun:1-slim, 프로덕션 전용
```

### 런타임 설정

- **비루트 유저**: `anki` (UID 1001, GID 1001)
- **포트**: 3100
- **볼륨**: `/app/data`, `/app/output`
- **Entrypoint**: `entrypoint.sh` — 첫 실행 시 프롬프트 시드 파일 복사
- **Health check**: `GET /api/health` (30초 간격, 5초 타임아웃, 3회 재시도)
- **환경**: `NODE_ENV=production`

### 주의사항

- `/etc/passwd` 직접 쓰기로 유저 생성 (bun 이미지에 adduser 없음, 커밋 `07cd3b3`)
- 루트 `tsconfig.json`은 삭제됨 — COPY에서 제외 (커밋 `114a8ab`)

## CI/CD (GitHub Actions)

### 워크플로우

`.github/workflows/publish.yml`:

```yaml
trigger: push branches [main] / tags v*
registry: ghcr.io
image: ghcr.io/greenheadhq/awesome-anki
concurrency: publish-container (직렬화, cancel 안 함)
```

### 태그 전략

| 트리거 | 생성 태그 |
|--------|----------|
| main push | `latest`, `sha-<commit>` |
| `v1.2.3` tag | `1.2.3`, `1.2`, `latest` |
| `v1.2.3-alpha` tag | `1.2.3-alpha` (latest 없음) |

- Docker Buildx + GitHub Actions 캐시 사용 (`type=gha,mode=max`)
- `docker/metadata-action@v5`가 조건부 태깅 처리

### 배포 순서 (자동)

1. 코드 변경 → `main` 머지
2. GitHub Actions가 자동으로 이미지 빌드 + push (`latest` + `sha-*`)
3. MiniPC `podman-auto-update` 타이머 (5분 주기)가 `latest` 변경 감지
4. 자동으로 stop → pull → start (10-30초 다운타임)
5. 실패 시 이전 이미지로 자동 롤백

### 배포 순서 (수동 — 긴급 시)

```bash
podman pull ghcr.io/greenheadhq/awesome-anki:latest
systemctl restart podman-awesome-anki
```

### 배포 순서 (태그 릴리스)

1. `git tag v1.x.x && git push --tags`
2. GitHub Actions가 semver 태그 + `latest` 빌드
3. 이후 자동 배포 동일

## 로컬 개발 vs 프로덕션

| 항목 | 로컬 개발 | 프로덕션 (MiniPC) |
|------|-----------|-------------------|
| 서버 포트 | 3000 | 3100 |
| 프론트엔드 | Vite dev server (:5173) | SPA 정적 파일 서빙 |
| API 프록시 | `VITE_API_PROXY_TARGET` | Caddy reverse_proxy |
| DB | `data/split-history.db` (로컬) | `/var/lib/docker-data/awesome-anki/data/` |
| API 인증 | 비활성화 가능 | Tailscale 내부망이라 비활성화 |
| 시크릿 | `.envrc` + agenix | NixOS agenix 모듈 |

## 환경변수 전체 목록

| 변수 | 기본값 | 용도 |
|------|--------|------|
| `GEMINI_API_KEY` | (필수) | LLM Split/검증 |
| `OPENAI_API_KEY` | (필수) | 임베딩 |
| `ANKI_SPLITTER_API_KEY` | (선택) | 서버 인증 |
| `ANKI_CONNECT_URL` | `http://localhost:8765` | AnkiConnect 주소 |
| `PORT` | `3000` | 서버 포트 |
| `ANKI_SPLITTER_REQUIRE_API_KEY` | `true` | API 키 필수 여부 |
| `CORS_ORIGINS` | `localhost:5173` | CORS 허용 오리진 |
| `SPLIT_HISTORY_DB_PATH` | `data/split-history.db` | SQLite DB 경로 |
| `HISTORY_SYNC_MODE` | `local` | 히스토리 동기화 모드 |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | 프론트엔드 API 프록시 |
| `ANKI_SPLITTER_DEFAULT_LLM_PROVIDER` | `gemini` | 기본 LLM 프로바이더 |
| `ANKI_SPLITTER_DEFAULT_LLM_MODEL` | (프로바이더별) | 기본 LLM 모델 |
| `ANKI_SPLITTER_BUDGET_CAP_USD` | `1.0` | 서버 예산 상한 |
| `EMBEDDING_CACHE_DIR` | `output/embeddings` | 임베딩 캐시 경로 |
| `ANKI_SPLITTER_BACKUP_DIR` | `output/backups` | 백업 저장 경로 |

## .dockerignore

주요 제외 항목: `node_modules`, `.git`, `secrets/`, `.env*`, `dist/`, `*.age`
