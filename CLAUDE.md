# Anki Claude Code

## 안전 규칙 (최우선)

- `--apply` 없이 항상 **미리보기 먼저 확인**
- `GEMINI_API_KEY` 필요 (Split, 검증용) — agenix로 `secrets/*.age`에서 자동 복호화
- `OPENAI_API_KEY` 선택 (OpenAI 프로바이더 사용 시) — 미설정 시 Gemini만 사용

## 프로젝트 한줄 설명

Anki 카드를 원자적 단위로 분할하는 웹 앱. AI(Gemini/OpenAI)로 정보 밀도 높은 카드를 학습 효율 좋은 작은 카드로 분리.

## 환경

- **도구 관리**: Nix flake devShell (`nix develop` 또는 `direnv allow`)
- **시크릿**: agenix 암호화 (`secrets/*.age`) — direnv 진입 시 자동 복호화
- **런타임**: Bun (npm 아님)
- **AnkiConnect**: MiniPC `100.79.80.95:8765` (Tailscale, headless Anki, profile: `server`)
- **대상 모델**: `KaTeX and Markdown Cloze` (필드: Text, Back Extra)
- **LLM**: 멀티 프로바이더 (Gemini + OpenAI). 기본: `gemini-3-flash-preview`
  - `ANKI_SPLITTER_DEFAULT_LLM_PROVIDER` — 기본 프로바이더 (`gemini` | `openai`)
  - `ANKI_SPLITTER_DEFAULT_LLM_MODEL` — 기본 모델
  - `ANKI_SPLITTER_BUDGET_CAP_USD` — 서버 사이드 예산 상한 (기본 $1.0)

## 테스트 데이터

- 덱: `[책] 이것이 취업을 위한 컴퓨터 과학이다`
- 테스트 카드 (DNS 관련, nid 링크 많음):
  - 1757399484677: 도메인 네임의 계층적 구조
  - 1757400981612: 네임 서버의 계층적 구조
  - 1757407967676: DNS 레코드 타입

## 프로젝트 구조

모노레포: `packages/core`(핵심 로직) + `packages/server`(Hono, :3000) + `packages/web`(React 19, :5173)

## 실행

```bash
bun run dev:web      # 프론트엔드만 로컬 (:5173), API → anki.greenhead.dev (기본)
bun run dev          # 서버(:3000) + 웹(:5173) 동시 실행 (프록시는 기본적으로 MiniPC)
```

> 풀스택 로컬이 필요하면: `VITE_API_PROXY_TARGET=http://localhost:3000 bun run dev`

## 데이터

- **SoT**: MiniPC (`anki.greenhead.dev`) — 모든 데이터는 MiniPC에서 관리
- **DB**: `/var/lib/docker-data/awesome-anki/data/split-history.db`
- **프롬프트/백업**: `/var/lib/docker-data/awesome-anki/output/`
- **임베딩**: MiniPC에서 자동 생성 (로컬 복사 불필요)
- 로컬 `data/`, `output/backups/`, `output/embeddings/`는 스테일 데이터 (MiniPC가 SoT)

## 스킬 라우팅

| 키워드 | 스킬 |
|--------|------|
| TODO 뭐 남았어, 미구현 기능, 기술 부채, 다음에 뭐 해 | `tracking-todo` |
| 스킬 감사, 스킬 점검, 문서 오래됐어, 스킬 최신화 | `checking-freshness` |
| 서버 배포, 컨테이너 재시작, MiniPC, nixos-rebuild, Caddy | `deploying-server` |

> 위 3개 외의 도메인(Split, 검증, 임베딩, 프롬프트, LLM, API, UI 등)은 코드베이스를 직접 탐색하여 해결한다.

## 세션 규칙

- AnkiConnect 작업은 반드시 `server` 프로필(test용)에서만 수행
- 새로운 시행착오/결정사항은 해당 스킬의 `references/troubleshooting.md`에 기록
