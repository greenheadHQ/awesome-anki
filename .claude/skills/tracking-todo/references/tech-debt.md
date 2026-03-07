# 기술 부채

## 리팩토링 필요

### ContentRenderer 컨테이너 파싱 로직 이동
- `packages/web/src/components/card/ContentRenderer.tsx`에 있는 컨테이너 파싱 로직을 `packages/core/`로 이동
- core 패키지에서 공통 사용 가능하게 분리

### ~~API 에러 핸들링 통일~~ (완료)
- ~~현재 각 라우트에서 개별 try/catch~~
- ~~Hono 미들웨어 기반 통일된 에러 핸들러 필요~~
- **완료**: 커스텀 에러 클래스(AppError 계층) + 글로벌 onError 미들웨어 + 라우트 try/catch 제거

### 로딩 상태 스켈레톤 UI
- 현재 단순 로딩 스피너
- 스켈레톤 UI로 사용자 경험 개선

### ~~output/prompts gitignore 예외~~ (완료)
- `.gitignore`에 `!output/prompts/` 예외 이미 추가됨

### ~~bun:test 타입 선언 문제~~ (완료)
- `packages/core/tsconfig.test.json` 분리 완료
- `"types": ["bun-types"]` 설정으로 `bun:test` 모듈 인식

## 테스트

### 완료
- **core** (10개): anki-client, atomic-write, backup, cache, cosine, difficulty, embedding-client, errors, prompts, prompt-system-remote
- **server** (1개): history/store.test.ts
- **web** 단위 (4개): button, card, dialog, prompt-api
- **web** lib (1개): sync-status.test.js
- **web** E2E (1개): tests/e2e/smoke.spec.ts

### 미완료
- 파서 단위 테스트 (container-parser, nid-parser, cloze-parser)
- API 통합 테스트 (라우트별)

## 문서화

### 완료
- CLAUDE.md, FEATURES.md, TODO.md, TROUBLESHOOTING.md → 스킬 시스템으로 마이그레이션

### 미완료
- API 문서 (OpenAPI/Swagger)

## 제거 완료

- ~~온보딩 투어~~: `react-joyride` 기반 온보딩 — 전면 제거 완료
- ~~Privacy 모듈~~: YAGNI 기반 전면 제거 완료
- ~~Biome~~: oxc(oxlint + oxfmt)로 마이그레이션 완료
- ~~Hard Split~~: Split 단일화 완료
