# 로드맵

## 완료된 마일스톤

- **멀티 LLM 지원** — Gemini + OpenAI 프로바이더, 팩토리 패턴, 비용 가시화 (PR #49)
- **Hard Split 제거** — Split 단일화 (PR #45)
- **Privacy 모듈 제거** — YAGNI 기반 전면 제거 (PR #47)
- **Biome → oxc 마이그레이션** — oxlint + oxfmt (PR #50)
- **SplitHistory 페이지** — 분할 이력 조회, 모델/비용 표시 (PR #49)

## 다음 단계

### Phase 5: Recursive Splitting
- 학습 통계 기반 어려운 카드 탐지
- 추가 분할 자동 제안
- SplitWorkspace에서 원클릭 재분할

### 멀티 프로바이더 비용 추적 UI
- 프로바이더별 누적 비용 대시보드
- 세션/일/월별 비용 통계

### 모델 성능 비교
- 프로바이더별 Split 품질 비교 (A/B 테스트)
- 응답 속도, 토큰 효율성 비교

## 향후 개선 방향

### Split 고도화
- 프롬프트 품질 향상
- Few-shot learning 예시 확장
- 분할 기준 조정 UI (Cloze 임계값, 정보 밀도)

### 인프라 개선
- API 문서 (OpenAPI/Swagger)
- E2E 테스트 (Playwright)
- 다크모드
- 반응형 레이아웃

### 사용자 경험 개선
- LLM 분석 토스트 알림 (react-hot-toast / sonner)
- 임베딩 생성 진행률 실시간 표시
- 자동 중복 탐지 + 병합 제안
