# 핵심 컴포넌트 상세

## ContentRenderer

Markdown + KaTeX + Cloze 렌더링. **markdown-it** 기반.

### 처리 순서

1. `preprocessAnkiHtml`: `<br>` → `\n`, `&nbsp;` → ` `
2. Cloze 구문 → `<span class="cloze">` 변환
3. 컨테이너 구문 → `<div class="callout-*">` 변환
4. Markdown → HTML (markdown-it + highlight.js)
5. KaTeX 수식 렌더링
6. nid 링크 처리
7. 이미지 프록시 (AnkiConnect 경유)

### 사용법

```tsx
<ContentRenderer
  content={cardText}
  showToggle={true}         // Raw/렌더링 토글
  defaultView="rendered"    // 기본 뷰
/>
```

### 리팩토링 참고

- ReactMarkdown에서 markdown-it으로 전면 리팩토링된 이력
- markdown-it-container 플러그인으로 `::: type` 구문 처리
- 컨테이너 파싱 로직을 core 패키지로 이동 필요 (기술 부채)

## ValidationPanel

- 4종 검증 결과 표시 + 재검증 버튼
- `useValidationCache` 훅으로 전역 캐시 공유
- SplitWorkspace 중앙 패널에 토글 통합

## SplitPreviewCard

- 분할 미리보기 개별 카드
- ContentRenderer + Raw/Rendered 토글
- "캐시된 결과" 배지 표시

## HelpTooltip

- (?) 아이콘 클릭 시 Popover 표시
- `helpContent.ts`에서 콘텐츠 정의
- `@radix-ui/react-popover` 기반
- `cursor-pointer` 클래스 필수

```tsx
<HelpTooltip helpKey="splitCandidate" />
```

## OnboardingTour (deprecated 예정)

- `react-joyride` 기반 7단계 투어
- `useOnboarding.ts`로 localStorage 완료 상태 관리
- 제거 예정 (`tracking-todo` 참조)
