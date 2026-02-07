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

## Gemini 3 Flash Preview (LLM)

- 1M 토큰 입력 지원
- 구조화된 출력 (zod 스키마 기반)
- `@google/genai` 패키지 사용
- `.env`에 `GEMINI_API_KEY` 필요

## Gemini Embedding (gemini-embedding-001)

- 768차원 벡터
- 8K 토큰 입력 한도
- `SEMANTIC_SIMILARITY` taskType
