---
name: tracking-todo
description: |
  This skill should be used when users request roadmap or debt tracking.
  Triggers: "TODO 뭐 남았어", "미구현 기능", "기술 부채",
  "다음에 뭐 해", "로드맵", "리팩토링 필요한 거", "Phase 5".
  Tracks unimplemented features, tech debt, and future roadmap.
---

# TODO 추적

## 구현 완료

- **SplitHistory** — 분할 이력 페이지 (`packages/web/src/pages/SplitHistory.tsx`)
- **멀티 LLM 지원** — Gemini + OpenAI 프로바이더, 모델 비교, 비용 가시화 (`packages/core/src/llm/`)
- **Hard Split 제거** — Split 단일화 완료
- **Privacy 모듈 제거** — YAGNI 기반 전면 제거
- **Biome → oxc 마이그레이션** — oxlint + oxfmt 전환 완료

## 미구현 기능

### 높은 우선순위

1. **Phase 5: Recursive Splitting**
   - 학습 통계 기반 "어려운 카드" 탐지
   - 추가 분할 필요 카드 자동 제안
   - SplitWorkspace에서 원클릭 재분할

### 보통 우선순위

2. **전체 Split**
   - 현재 5개 후보만 분석 (API 비용 고려)
   - 전체 후보 분석 옵션 추가

3. **interval/due 복제**
   - AnkiConnect 제한으로 현재 불가
   - 대안: Anki 플러그인 직접 개발

4. **"기본" 덱 필터링**
   - 빈 덱(기본 덱 등) 숨기기 옵션

5. **멀티 프로바이더 비용 추적 UI**
   - 프로바이더별 누적 비용 대시보드
   - 세션/일/월별 비용 통계

6. **모델 성능 비교**
   - 프로바이더별 Split 품질 비교 (A/B)
   - 응답 속도, 토큰 효율성 비교

### 낮은 우선순위

7. **다크모드** — CSS 변수 설정 완료 (.dark 클래스), 토글 + 시스템 연동 필요
8. **임베딩 생성 진행률** — WebSocket or polling
9. **임베딩 기반 자동 중복 탐지** — 전체 덱 스캔, 병합/삭제 제안
10. **LLM 분석 토스트 알림** — react-hot-toast 또는 sonner
11. **반응형 레이아웃** — 모바일/태블릿 대응
12. **Split 고도화** — 프롬프트 개선, Few-shot, 기준 조정 UI

## 기술 부채

- [ ] ContentRenderer의 컨테이너 파싱 로직을 core 패키지로 이동
- [x] ~~API 에러 핸들링 통일~~ (완료: AppError 계층 + 글로벌 onError 미들웨어)
- [ ] 로딩 상태 스켈레톤 UI 추가
- [ ] output/prompts gitignore 예외 추가
- [ ] bun:test 타입 선언 문제 (tsconfig에 `"types": ["bun-types"]` 추가)
- [ ] 파서 단위 테스트
- [ ] API 통합 테스트
- [ ] E2E 테스트 (Playwright)
- [ ] API 문서 (OpenAPI/Swagger)

## 상세 참조

- `references/unimplemented.md` — 미구현 기능 상세 설명
- `references/tech-debt.md` — 리팩토링 필요 항목 상세
- `references/roadmap.md` — 향후 계획
- `references/troubleshooting.md` — TODO 정합성 점검 및 운영 이슈 해결
