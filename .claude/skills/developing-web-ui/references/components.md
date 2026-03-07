# 핵심 컴포넌트 상세

## ContentRenderer & ContentPreview

Markdown + Cloze 렌더링. **markdown-it** 기반 (`packages/web/src/lib/markdown-renderer.ts`).

### 처리 순서 (renderAnkiContent 함수)

실제 파이프라인 순서. 소스: `packages/web/src/lib/markdown-renderer.ts`의 `renderAnkiContent()`.

1. `preprocessAnkiHtml`: `&nbsp;` -> ` `, `&lt;br&gt;` -> `\n`, `<br>` -> `\n`, 연속 줄바꿈 정리
2. `processCloze`: `{{c1::내용::힌트}}` -> `<span class="cloze" data-cloze="1">내용</span>`
3. `processNidLinks`: `[제목|nid1234567890123]` -> `<a class="nid-link" data-nid="...">제목</a>`
4. `md.render()`: markdown-it 렌더링 (컨테이너 플러그인 + highlight.js 코드 하이라이팅)
5. `processImages`: 로컬 이미지 경로 -> `/api/media/` 프록시 경로 변환

**KaTeX 단계는 없다.** Anki 템플릿 측에서 KaTeX가 이미 HTML로 렌더링된 상태로 전달되므로,
markdown-it의 `html: true` 옵션으로 그대로 통과시킨다. `rehype-katex`는 `package.json`에
레거시 의존성으로 남아 있을 뿐, 렌더링 파이프라인에서 사용하지 않는다.

### ContentRenderer 사용법

```tsx
<ContentRenderer
  content={cardText}
  showToggle={true}         // Raw/렌더링 토글
  defaultView="rendered"    // 기본 뷰
/>
```

### ContentPreview

토글 없이 렌더링만 수행하는 컴팩트 버전. `ContentRenderer.tsx`에 같이 정의.

```tsx
<ContentPreview content={cardText} className="..." />
```

### 리팩토링 참고

- ReactMarkdown에서 markdown-it으로 전면 리팩토링된 이력
- markdown-it-container 플러그인으로 `::: type` 구문 처리 (tip, warning, error, note, link, toggle)
- `markdown-it-mark` 플러그인으로 `==highlight==` 구문 처리

## DiffViewer & SplitPreviewCard

**둘 다 `packages/web/src/components/card/DiffViewer.tsx`에 위치.** 별도 파일이 아님.

### DiffViewer

분할 전후 라인 기반 diff 비교 컴포넌트.

- 메인 카드: 원본과의 라인별 diff 표시 (추가/삭제/동일 컬러 코딩)
- 서브 카드: 새로 생성되는 카드 내용 표시
- 사용처: SplitWorkspace 미리보기 영역

```tsx
<DiffViewer
  original={originalText}
  splitCards={splitCards}
/>
```

### SplitPreviewCard

분할 미리보기 개별 카드. ContentRenderer + Raw/Rendered 토글 + 메인/번호 배지.

```tsx
<SplitPreviewCard card={card} index={idx} />
```

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
- `packages/web/src/components/ui/bottom-sheet.tsx`: 모바일 바텀 시트 UI
- `packages/web/src/components/ui/compact-selector.tsx`: 컴팩트 선택기 UI

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

`ErrorFallback` 컴포넌트 -- BrowserRouter/QueryClientProvider 바깥에서 최후 방어선.

```tsx
// packages/web/src/components/ErrorFallback.tsx
<ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
  <QueryClientProvider>
    <BrowserRouter>...</BrowserRouter>
  </QueryClientProvider>
</ErrorBoundary>
```

### 2단: 라우트별 (React Router v7 errorElement)

`RouteError` 컴포넌트 -- 각 Route에 `errorElement` 설정.

```tsx
// packages/web/src/components/RouteError.tsx
<Route path="split" element={<SplitWorkspace />} errorElement={<RouteError />} />
```

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

## 테스트 컴포넌트

- `packages/web/tests/components/button.test.tsx`
- `packages/web/tests/components/card.test.tsx`
- `packages/web/tests/components/dialog.test.tsx`
