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
bun run dev          # 서버 + 클라이언트 동시 실행
```

## 스킬 라우팅

| 키워드 | 스킬 |
|--------|------|
| 모노레포 구조가 어떻게 돼, 기술 스택, export 충돌 | `understanding-project` |
| AnkiConnect 연결 안 돼, test 프로필, ease factor 복제 | `working-with-anki` |
| Split 결과가 이상해, 파서 버그, 카드 분할 | `splitting-cards` |
| 팩트 체크 결과가, 유사한 카드 찾아줘, 문맥 검증 | `validating-cards` |
| 임베딩 생성, 코사인 유사도, 캐시 어디에 | `managing-embeddings` |
| 프롬프트 버전 관리, A/B 테스트 만들어, SuperMemo 규칙 | `managing-prompts` |
| LLM 모델 변경, 프로바이더 추가, 비용 추정, 예산 가드 | `managing-llm` |
| API 라우트 추가, Hono 엔드포인트, 서버 에러 | `developing-web-api` |
| React 컴포넌트 추가, ContentRenderer 수정, TanStack Query | `developing-web-ui` |
| TODO 뭐 남았어, 미구현 기능, 기술 부채, 다음에 뭐 해 | `tracking-todo` |
| 문서 오래됐어, 스킬 최신화, git log 수정일 | `checking-freshness` |

## 세션 규칙

- 소스 코드 변경 시, 대응 스킬의 문서도 함께 최신화
- 새로운 시행착오/결정사항은 해당 스킬의 `references/troubleshooting.md`에 기록
