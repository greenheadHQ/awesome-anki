# 기술 스택 상세

## Bun

- npm 대신 **bun** 사용 (`bun install`, `bun run`, `bun add`)
- `package.json` scripts에서 `tsx` 대신 `bun run` 사용
- workspace 관리: `"workspaces": ["packages/*"]`

## Hono (백엔드)

- 경량 웹 프레임워크 (Express 대안)
- `packages/server/src/index.ts`에서 라우트 등록
- `c.json(result)` 형식으로 응답 반환

## React 19 + Vite (프론트엔드)

- Vite 기반 개발 서버 (localhost:5173)
- React 19 사용

## Tailwind CSS v4

- v4에서 `tailwindcss init` 대신 `@tailwindcss/postcss` 플러그인 사용

```javascript
// postcss.config.js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- shadcn/ui 스타일 컴포넌트 (Button, Card, Popover 등)
- CSS 변수 기반 다크모드 준비 완료 (.dark 클래스)

## TanStack Query

- 서버 상태 관리
- `queryKeys` 객체로 캐시 키 중앙 관리 (`lib/query-keys.ts`)
- 캐시 무효화: `queryClient.invalidateQueries()`

## markdown-it + KaTeX

- ContentRenderer에서 사용
- markdown-it-container 플러그인으로 `::: type` 구문 처리
- highlight.js로 코드 하이라이팅
- KaTeX CSS: `import 'katex/dist/katex.min.css'`

## Multi-LLM (Gemini + OpenAI)

- **factory 패턴**: `createLLMClient(provider)` → `LLMProvider` 어댑터 반환
- **프로바이더**: Gemini (`@google/genai`), OpenAI (`openai` Responses API)
- **기본 모델**: Gemini 3 Flash Preview (`gemini-3-flash-preview`), GPT-5 Mini (`gpt-5-mini`)
- **환경변수**:
  - `GEMINI_API_KEY` (필수) — Split, 검증, 임베딩용
  - `OPENAI_API_KEY` (선택) — OpenAI 프로바이더 사용 시
  - `ANKI_SPLITTER_DEFAULT_LLM_PROVIDER` — 기본 프로바이더 (`gemini` | `openai`)
  - `ANKI_SPLITTER_DEFAULT_LLM_MODEL` — 기본 모델 오버라이드
  - `ANKI_SPLITTER_BUDGET_CAP_USD` — 서버 사이드 예산 상한 (기본 $1.0)
- **가격/비용 추정**: `pricing.ts`에서 모델별 가격표 관리, 요청마다 실제 비용 계산
- **graceful fallback**: 설정된 provider가 미가용이면 가용 provider로 자동 전환

## Linter / Formatter (oxc)

- **oxlint**: 린터 (`bunx oxlint src`)
- **oxfmt**: 포매터 (`bunx oxfmt --check src`)
- 루트 `package.json`에 devDependencies로 `oxlint`, `oxfmt` 설치
- 각 패키지 `lint` 스크립트: `bunx oxlint src && bunx oxfmt --check src`

## Gemini Embedding (gemini-embedding-001)

- 768차원 벡터
- 8K 토큰 입력 한도
- `SEMANTIC_SIMILARITY` taskType
