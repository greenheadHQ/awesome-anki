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
| 모노레포 구조가 어떻게 돼, 기술 스택, export 충돌, 패키지 간 의존성, 프로젝트 구조, 어떤 패키지에 있어 | `understanding-project` |
| AnkiConnect 연결 안 돼, test 프로필, ease factor 복제, 카드 정보 조회, 학습 데이터, Anki 프로필, 카드 모델 | `working-with-anki` |
| Split 결과가 이상해, 파서 버그, 카드 분할, 분할 미리보기, nid 승계, Cloze 번호 리셋, 컨테이너 파서, atomic card | `splitting-cards` |
| 팩트 체크 결과가, 유사한 카드 찾아줘, 문맥 검증, 검증 캐시, 최신성 검사, 중복 카드, 검증 상태 아이콘 | `validating-cards` |
| 임베딩 생성, 코사인 유사도, 캐시 어디에, 의미 유사도, gemini-embedding-001, 벡터 차원 | `managing-embeddings` |
| 프롬프트 버전 관리, A/B 테스트 만들어, SuperMemo 규칙, Cloze Enhancer, 카드 길이 기준, 이진 패턴, 실패 패턴 분석 | `managing-prompts` |
| LLM 모델 변경, 프로바이더 추가, 비용 추정, 예산 가드, pricing table, 모델 비교, LLM 비용, 토큰 사용량 | `managing-llm` |
| API 라우트 추가, Hono 엔드포인트, 서버 에러, REST API, 라우트 패턴, API 응답 형식, 서버 포트 | `developing-web-api` |
| React 컴포넌트 추가, ContentRenderer 수정, TanStack Query, CSS 충돌, 웹 UI 버그, 페이지 추가, Tailwind 스타일, shadcn | `developing-web-ui` |
| TODO 뭐 남았어, 미구현 기능, 기술 부채, 다음에 뭐 해, 로드맵, 리팩토링 필요한 거, Phase 5 | `tracking-todo` |
| 문서 오래됐어, 스킬 최신화, git log 수정일, 코드 문서 동기화, 스킬 업데이트 필요해, references 최신화 | `checking-freshness` |

## 세션 규칙

- 소스 코드 변경 시, 대응 스킬의 문서도 함께 최신화
- 새로운 시행착오/결정사항은 해당 스킬의 `references/troubleshooting.md`에 기록
