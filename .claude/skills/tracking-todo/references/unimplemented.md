# 미구현 기능 상세

## Phase 5: Recursive Splitting (높은 우선순위, 부분 완료)

학습 중 틀린 카드를 추가 분할하는 기능.

- ~~학습 통계 기반 "어려운 카드" 탐지~~ (완료: `difficulty.ts` + `useDifficultCards` 훅)
  - lapses, ease factor, reps 기반 필터링 구현
  - AnkiConnect `cardsInfo`로 학습 데이터 조회 → 필터링
- 추가 분할 필요 카드 자동 제안 (미구현)
- SplitWorkspace에서 원클릭 재분할 (미구현)

## 전체 Split (보통 우선순위)

- **현재**: 5개 후보만 분석 (API 비용 고려)
- **개선**: 전체 후보 분석 옵션 추가
- 비용 경고 표시 후 사용자 확인

## interval/due 복제 (보통 우선순위)

- **제한**: AnkiConnect API로 interval, due 직접 설정 불가
- **대안**: Anki 플러그인 직접 개발하여 DB 접근
- 현재 ease factor만 복제 가능

## "기본" 덱 필터링 (보통 우선순위)

- 빈 덱이나 기본 덱 숨기기 옵션
- Dashboard 덱 선택 시 적용

## 다크모드 (낮은 우선순위)

- CSS 변수는 이미 설정 완료 (.dark 클래스)
- 토글 버튼 UI 필요
- `prefers-color-scheme` 시스템 설정 연동

## 임베딩 생성 진행률 (낮은 우선순위)

- 현재 단순 로딩 스피너
- WebSocket 또는 polling으로 실시간 진행률

## 임베딩 기반 자동 중복 탐지 (낮은 우선순위)

- 전체 덱 스캔하여 유사 카드 그룹 자동 탐지
- 중복 카드 병합/삭제 제안

## 멀티 프로바이더 비용 추적 UI (보통 우선순위)

- 프로바이더별 누적 비용 대시보드
- 세션/일/월별 비용 통계
- 현재 `model-badge.tsx`에 `formatCostUsd()` 존재, 확장 필요

## 모델 성능 비교 (보통 우선순위)

- 프로바이더별 Split 품질 비교 (A/B 테스트)
- 응답 속도, 토큰 효율성 비교
- `packages/core/src/llm/pricing.ts`의 토큰 사용량 데이터 활용

## ~~LLM 분석 토스트 알림~~ (구현 완료)

sonner v2.0.7 사용. SplitWorkspace, PromptManager에서 toast() 호출.

## ~~반응형 레이아웃~~ (구현 완료)

useMediaQuery 훅, BottomSheet, CompactSelector 등 구현. 태블릿 브레이크포인트 xl(1280px) 상향 (PR #76).
