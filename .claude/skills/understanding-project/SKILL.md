---
name: understanding-project
description: |
  This skill should be used when the user asks about "모노레포 구조가 어떻게 돼",
  "기술 스택", "export 충돌", "패키지 간 의존성", "프로젝트 구조", "어떤 패키지에 있어".
  Covers the monorepo architecture, package roles, tech stack, and coding conventions.
---

# 프로젝트 이해

Anki 카드를 원자적 단위로 분할하는 웹 앱 + CLI 도구. 정보 밀도 높은 카드를 Gemini AI로 학습 효율 좋은 작은 카드로 분리.

## 모노레포 구조

```
anki-claude-code/
├── packages/
│   ├── core/      # 핵심 로직 (CLI + 웹 공용) — 파서, 분할, 검증, 임베딩, 프롬프트
│   ├── server/    # Hono REST API (localhost:3000)
│   └── web/       # React 19 + Vite 프론트엔드 (localhost:5173)
├── src/           # CLI 진입점 (하위 호환)
└── output/        # backups/, embeddings/, prompts/
```

## 기술 스택

| 영역 | 기술 |
|------|------|
| 런타임 | **Bun** (npm 아님) |
| 언어 | TypeScript |
| LLM | Gemini 3 Flash Preview (구조화된 출력, 1M 토큰) |
| 백엔드 | Hono (REST API) |
| 프론트엔드 | React 19 + Vite |
| 스타일링 | Tailwind CSS v4 (`@tailwindcss/postcss` 플러그인) |
| 상태 관리 | TanStack Query |
| 렌더링 | markdown-it + KaTeX + highlight.js |

## 패키지별 핵심 모듈 (packages/core/src/)

| 모듈 | 역할 |
|------|------|
| `anki/` | AnkiConnect API 래퍼 — `working-with-anki` 스킬 참조 |
| `gemini/` | Gemini API 호출 (분할, cloze-enhancer) |
| `parser/` | 텍스트 파싱 (container, nid, cloze) — `splitting-cards` 스킬 참조 |
| `splitter/` | Hard/Soft Split 로직 — `splitting-cards` 스킬 참조 |
| `validator/` | 카드 검증 4종 — `validating-cards` 스킬 참조 |
| `embedding/` | Gemini 임베딩 — `managing-embeddings` 스킬 참조 |
| `prompt-version/` | 프롬프트 버전 관리 — `managing-prompts` 스킬 참조 |
| `utils/` | HTML 스타일 보존, diff |

## export 규칙

`packages/core/src/index.ts`에서 **명시적 named export** 사용. `export *`는 이름 충돌 발생 (SplitCard, validateStylePreservation 등).

충돌 방지를 위해 prompt-version 함수는 접두사 사용:
- `listVersions` → `listPromptVersions`
- `getVersion` → `getPromptVersion`

## 실행 방법

```bash
bun run dev          # 서버 + 클라이언트 동시 실행
bun run dev:server   # 서버만 (localhost:3000)
bun run dev:web      # 클라이언트만 (localhost:5173)
bun run cli:status   # CLI 연결 확인
bun run cli:split    # CLI 분할 미리보기
```

## 자주 발생하는 문제

- **`bun install` 사용**: `npm install` 금지
- **export 충돌**: 새 모듈 추가 시 `index.ts`에서 개별 항목 나열
- **Tailwind v4**: `tailwindcss init` 대신 `@tailwindcss/postcss` 플러그인 사용
- **포트 충돌**: `lsof -ti:3000 | xargs kill -9`로 정리 후 재시작

## 상세 참조

- `references/architecture.md` — 모노레포 상세 구조, 패키지 역할
- `references/tech-stack.md` — Bun, Hono, React 19, Tailwind v4 상세
- `references/conventions.md` — export 규칙, 실행 방법, 모노레포 설정
