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

## shadcn UI primitives

- `packages/web/src/components/ui/button.tsx`: variant/size API 유지(`default|secondary|destructive|outline|ghost|link`, `default|sm|lg|icon`)
- `packages/web/src/components/ui/card.tsx`: `CardHeader/CardTitle/CardContent` 구조 기반
- `packages/web/src/components/ui/popover.tsx`: HelpTooltip/반려 사유 팝오버
- `packages/web/src/components/ui/select.tsx`: Dashboard/CardBrowser/SplitWorkspace 헤더 필터
- `packages/web/src/components/ui/table.tsx`: CardBrowser/PromptManager 목록
- `packages/web/src/components/ui/dialog.tsx`: BackupManager 롤백 확인/결과 모달
- `packages/web/src/components/ui/model-badge.tsx`: LLM 프로바이더/모델 배지 + `formatCostUsd`

## SplitPreviewCard

- 분할 미리보기 개별 카드
- ContentRenderer + Raw/Rendered 토글
- "캐시된 결과" 배지 표시

## HelpTooltip

- (?) 아이콘 클릭 시 Popover 표시
- `helpContent.ts`에서 콘텐츠 정의
- shadcn `Popover` 컴포넌트 사용 (`packages/web/src/components/ui/popover`)
- `cursor-pointer` 클래스 필수

```tsx
<HelpTooltip helpKey="splitCandidate" />
```

## Error Boundary (2단 구조)

### 1단: 최상위 (react-error-boundary)

`ErrorFallback` 컴포넌트 — BrowserRouter/QueryClientProvider 바깥에서 최후 방어선.

```tsx
// packages/web/src/components/ErrorFallback.tsx
<ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
  <QueryClientProvider>
    <BrowserRouter>...</BrowserRouter>
  </QueryClientProvider>
</ErrorBoundary>
```

- "예기치 않은 오류가 발생했습니다" + 새로고침 버튼
- React Router/Provider 레벨 에러 캐치

### 2단: 라우트별 (React Router v7 errorElement)

`RouteError` 컴포넌트 — 각 Route에 `errorElement` 설정.

```tsx
// packages/web/src/components/RouteError.tsx
<Route path="split" element={<SplitWorkspace />} errorElement={<RouteError />} />
```

- "페이지 오류" + "홈으로 돌아가기" 링크
- 한 페이지 에러가 다른 페이지에 영향 안 줌
- `useRouteError()` 훅으로 에러 정보 접근

### 새 페이지 추가 시

Route에 `errorElement={<RouteError />}` 반드시 포함:
```tsx
<Route path="new-page" element={<NewPage />} errorElement={<RouteError />} />
```

## 디자인 토큰

- 전역 토큰/타이포 유틸은 `packages/web/src/index.css`에 정의
- 대표 토큰:
  - `typo-h1`, `typo-h2`, `typo-h3`, `typo-body`, `typo-body-lg`, `typo-body-sm`, `typo-caption`
  - `--primary`, `--muted`, `--success`, `--warning`, `--info`

## 테스트 컴포넌트

- `packages/web/tests/components/button.test.tsx`
- `packages/web/tests/components/card.test.tsx`
- `packages/web/tests/components/dialog.test.tsx`

## SyncStatusBadge

- `packages/web/src/components/SyncStatusBadge.tsx`
- 동기화 상태 표시 배지 (미동기화/성공/기록 없음)
- `SyncStatusState` 타입 기반, `sync-status.ts` 연동
- SplitHistory 페이지에서 사용

## ModelBadge

- `packages/web/src/components/ui/model-badge.tsx`
- LLM 프로바이더/모델 표시 (Gemini: 파란색, OpenAI: 녹색)
- `formatCostUsd` 유틸 함수 함께 export
- SplitWorkspace, SplitHistory 페이지에서 사용
