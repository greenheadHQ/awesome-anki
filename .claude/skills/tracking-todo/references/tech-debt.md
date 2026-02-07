# 기술 부채

## 리팩토링 필요

### ContentRenderer 컨테이너 파싱 로직 이동
- `packages/web/src/components/card/ContentRenderer.tsx`에 있는 컨테이너 파싱 로직을 `packages/core/`로 이동
- core 패키지에서 공통 사용 가능하게 분리

### API 에러 핸들링 통일
- 현재 각 라우트에서 개별 try/catch
- Hono 미들웨어 기반 통일된 에러 핸들러 필요

### 로딩 상태 스켈레톤 UI
- 현재 단순 로딩 스피너
- 스켈레톤 UI로 사용자 경험 개선

### output/prompts gitignore 예외
- `output/` 전체가 gitignore되어 프롬프트 버전 파일이 추적되지 않음
- `.gitignore`에 `!output/prompts/` 예외 추가 필요
- **참고**: 이 작업은 스킬 시스템 구축 시 .gitignore 수정에 포함됨

### bun:test 타입 선언 문제
- `packages/core/src/__tests__/*.ts`에서 `bun:test` 모듈을 찾을 수 없음
- tsconfig.json에 `"types": ["bun-types"]` 추가 또는 별도 tsconfig 분리

## 테스트

### 완료
- 임베딩 모듈 단위 테스트

### 미완료
- 파서 단위 테스트
- API 통합 테스트
- E2E 테스트 (Playwright)

## 문서화

### 완료
- CLAUDE.md, FEATURES.md, TODO.md, TROUBLESHOOTING.md → 스킬 시스템으로 마이그레이션

### 미완료
- API 문서 (OpenAPI/Swagger)

## Deprecated 예정

### 온보딩 투어 제거
- `react-joyride` 기반 온보딩 기능 불필요
- 제거 대상 파일:
  - `packages/web/src/hooks/useOnboarding.ts`
  - `packages/web/src/components/onboarding/OnboardingTour.tsx`
  - Dashboard "가이드 다시 보기" 버튼
