# Anki Claude Code

## 안전 규칙 (최우선)

- **반드시 `test` 프로필에서만 작업**: `open -a Anki --args -p test`
- 기본 Anki 프로필 접근 **절대 금지**
- `--apply` 없이 항상 **미리보기 먼저 확인**
- `GEMINI_API_KEY` 필요 (Soft Split, 검증용) — agenix로 `secrets/*.age`에서 자동 복호화

## 프로젝트 한줄 설명

Anki 카드를 원자적 단위로 분할하는 웹 앱 + CLI. Gemini AI로 정보 밀도 높은 카드를 학습 효율 좋은 작은 카드로 분리.

## 환경

- **도구 관리**: Nix flake devShell (`nix develop` 또는 `direnv allow`)
- **시크릿**: agenix 암호화 (`secrets/*.age`) — direnv 진입 시 자동 복호화
- **런타임**: Bun (npm 아님)
- **AnkiConnect**: localhost:8765 (애드온 2055492159)
- **대상 모델**: `KaTeX and Markdown Cloze` (필드: Text, Back Extra)
- **LLM**: `gemini-3-flash-preview` (구조화된 출력, 1M 토큰)
- **Anki 프로필**: `test` 전용

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
bun run cli:status   # CLI 연결 확인
```

## 스킬 라우팅

| 키워드 | 스킬 |
|--------|------|
| 모노레포 구조가 어떻게 돼, 기술 스택, export 충돌 | `understanding-project` |
| AnkiConnect 연결 안 돼, test 프로필, ease factor 복제 | `working-with-anki` |
| Hard Split이 뭐야, Soft Split 결과가 이상해, 파서 버그 | `splitting-cards` |
| 팩트 체크 결과가, 유사한 카드 찾아줘, 문맥 검증 | `validating-cards` |
| 임베딩 생성, 코사인 유사도, 캐시 어디에 | `managing-embeddings` |
| 프롬프트 버전 관리, A/B 테스트 만들어, SuperMemo 규칙 | `managing-prompts` |
| API 라우트 추가, Hono 엔드포인트, 서버 에러 | `developing-web-api` |
| React 컴포넌트 추가, ContentRenderer 수정, TanStack Query | `developing-web-ui` |
| TODO 뭐 남았어, 미구현 기능, 기술 부채, 다음에 뭐 해 | `tracking-todo` |
| 문서 오래됐어, 스킬 최신화, git log 수정일 | `checking-freshness` |

## 세션 규칙

- 소스 코드 변경 시, 대응 스킬의 문서도 함께 최신화
- 새로운 시행착오/결정사항은 해당 스킬의 `references/troubleshooting.md`에 기록
