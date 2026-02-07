---
name: tracking-todo
description: |
  This skill should be used when the user asks about "TODO 뭐 남았어",
  "미구현 기능", "기술 부채", "다음에 뭐 해", "로드맵",
  "리팩토링 필요한 거", "Phase 5".
  Tracks unimplemented features, tech debt, and future roadmap.
---

# TODO 추적

## 미구현 기능

### 높은 우선순위

1. **Phase 5: Recursive Splitting**
   - 학습 통계 기반 "어려운 카드" 탐지
   - 추가 분할 필요 카드 자동 제안
   - SplitWorkspace에서 원클릭 재분할

### 보통 우선순위

2. **전체 Soft Split**
   - 현재 5개 후보만 분석 (API 비용 고려)
   - 전체 후보 분석 옵션 추가

3. **interval/due 복제**
   - AnkiConnect 제한으로 현재 불가
   - 대안: Anki 플러그인 직접 개발

4. **"기본" 덱 필터링**
   - 빈 덱(기본 덱 등) 숨기기 옵션

### 낮은 우선순위

5. **다크모드** — CSS 변수 설정 완료 (.dark 클래스), 토글 + 시스템 연동 필요
6. **임베딩 생성 진행률** — WebSocket or polling
7. **임베딩 기반 자동 중복 탐지** — 전체 덱 스캔, 병합/삭제 제안
8. **Gemini 분석 토스트 알림** — react-hot-toast 또는 sonner
9. **반응형 레이아웃** — 모바일/태블릿 대응
10. **Soft Split 고도화** — 프롬프트 개선, Few-shot, 기준 조정 UI

## 기술 부채

- [ ] ContentRenderer의 컨테이너 파싱 로직을 core 패키지로 이동
- [ ] API 에러 핸들링 통일
- [ ] 로딩 상태 스켈레톤 UI 추가
- [ ] output/prompts gitignore 예외 추가
- [ ] bun:test 타입 선언 문제 (tsconfig에 `"types": ["bun-types"]` 추가)
- [ ] 파서 단위 테스트
- [ ] API 통합 테스트
- [ ] E2E 테스트 (Playwright)
- [ ] API 문서 (OpenAPI/Swagger)

## Deprecated 예정

- **온보딩 투어 제거**: `react-joyride` 기반 온보딩 기능 불필요
  - `packages/web/src/hooks/useOnboarding.ts`
  - `packages/web/src/components/onboarding/OnboardingTour.tsx`
  - Dashboard "가이드 다시 보기" 버튼

## 상세 참조

- `references/unimplemented.md` — 미구현 기능 상세 설명
- `references/tech-debt.md` — 리팩토링 필요 항목 상세
- `references/roadmap.md` — 향후 계획
