---
name: developing-web-ui
description: |
  React 프론트엔드의 컴포넌트, 훅, 렌더링, 스타일 관련 작업이면 반드시 이 스킬을 먼저 확인할 것.
  Triggers: "React 컴포넌트 추가", "ContentRenderer 수정",
  "TanStack Query", "CSS 충돌", "웹 UI 버그", "페이지 추가",
  "Tailwind 스타일", "렌더링 문제", "shadcn", "shadcn 컴포넌트",
  "shadcn 마이그레이션", "variant API", "UI 마이그레이션", "마이그레이션",
  "toast", "sonner", "Toaster", "DiffViewer", "ContentPreview",
  "BottomSheet", "CompactSelector", "markdown 렌더링",
  "모바일 반응형", "useMediaQuery", "useIsMobile", "훅 추가",
  "query hook", "캐시 무효화", "staleTime", "분할 미리보기 UI",
  "분할 반려 UI", "카드 브라우저", "어려운 카드".
  Covers the React frontend, components, hooks, query patterns,
  rendering pipeline, and UI troubleshooting.
---

# 웹 UI 개발

## 프론트엔드 구조

```
packages/web/src/
├── pages/           # 페이지 컴포넌트
├── components/
│   ├── card/        # ContentRenderer, ContentPreview, DiffViewer, SplitPreviewCard
│   ├── help/        # HelpTooltip
│   ├── layout/      # Layout, Sidebar
│   ├── ui/          # shadcn/ui 스타일 (button, card, popover, select, table,
│   │                #   dialog, model-badge, bottom-sheet, compact-selector)
│   ├── validation/  # ValidationPanel
│   ├── ErrorFallback.tsx
│   ├── RouteError.tsx
│   └── SyncStatusBadge.tsx
├── hooks/           # TanStack Query 훅 + 유틸 훅
│   ├── useCards.ts         # useCards, useCardDetail + useBackups, useRollback (중복)
│   ├── useBackups.ts       # useBackups, useRollback (정규 위치)
│   ├── useDecks.ts         # useDecks, useDeckStats
│   ├── useDifficultCards.ts # useDifficultCards
│   ├── useHistory.ts       # useHistoryList, useHistoryDetail, useHistorySyncHealth
│   ├── useMediaQuery.ts    # useMediaQuery, useIsMobile
│   ├── usePrompts.ts       # usePromptVersions, usePromptVersion, useActivePrompt,
│   │                       #   useSystemPrompt, useActivatePrompt, useSaveSystemPrompt,
│   │                       #   useExperiments, useExperiment, useCreateExperiment,
│   │                       #   useCompleteExperiment
│   ├── useSplit.ts         # useLLMModels, useSplitPreview, useSplitApply,
│   │                       #   useSplitReject, getCachedSplitPreview
│   └── useValidationCache.ts
└── lib/
    ├── api.ts               # API 클라이언트 (fetch wrapper)
    ├── query-keys.ts        # TanStack Query 키 팩토리
    ├── markdown-renderer.ts # Anki 카드 렌더링 파이프라인
    ├── constants.ts         # 상수 정의
    ├── sync-status.ts       # 동기화 상태 타입/유틸
    ├── view-transition.ts   # View Transition API 래퍼
    ├── helpContent.ts       # HelpTooltip 콘텐츠 정의
    └── utils.ts             # cn() 등 공용 유틸
```

### 훅 중복 주의

`useBackups`와 `useRollback`가 `useCards.ts`와 `useBackups.ts` 양쪽에 존재한다.
import 시 어느 쪽을 참조하는지 확인 필요. 정규 위치는 `useBackups.ts`.

## 페이지 목록

| 페이지 | 경로 | 역할 |
|--------|------|------|
| Dashboard | / | 덱 선택, 통계 카드, 빠른 작업 |
| SplitWorkspace | /split | 3단 레이아웃 (후보 목록 / 원본 / 미리보기) |
| CardBrowser | /browse | 카드 테이블 + 검증 상태 |
| BackupManager | /backups | 백업 목록 + 롤백 |
| PromptManager | /prompts | 버전/히스토리/실험/메트릭 탭 |
| SplitHistory | /history | 분할 히스토리 목록 + 세션 상세 |
| Help | /help | 전체 기능 설명, FAQ, 용어집 |

## 핵심 컴포넌트

### ContentRenderer & ContentPreview

Markdown + Cloze 렌더링. **markdown-it** 기반 (`lib/markdown-renderer.ts`).

**처리 순서** (`renderAnkiContent` 함수 기준):
1. `preprocessAnkiHtml`: HTML 엔티티 + `<br>` -> `\n` 변환
2. `processCloze`: Cloze 구문 -> `<span class="cloze">` 변환
3. `processNidLinks`: nid 링크 -> `<a class="nid-link">` 변환 (마크다운 파싱 전에 처리)
4. `md.render()`: markdown-it 렌더링 (컨테이너 플러그인 포함, highlight.js 코드 하이라이팅)
5. `processImages`: 이미지 경로를 API 프록시(`/api/media/`)로 변환

**KaTeX 단계는 없다.** `rehype-katex`가 `package.json`에 레거시 의존성으로 남아 있지만,
실제 렌더링 파이프라인에서 KaTeX 처리를 수행하지 않는다. Anki 템플릿 측에서 KaTeX가 이미
HTML로 렌더링된 상태로 들어오므로 `html: true` 옵션으로 통과시킨다.

`ContentPreview`는 토글 없이 렌더링만 수행하는 컴팩트 버전.

### DiffViewer & SplitPreviewCard

**둘 다 `components/card/DiffViewer.tsx`에 위치** (단독 파일 아님).

- `DiffViewer`: 분할 전후 라인 기반 diff 비교 (메인 카드 변경 + 서브 카드 목록)
- `SplitPreviewCard`: 분할 미리보기 개별 카드 (ContentRenderer + Raw/Rendered 토글 + 메인/번호 배지)

### SplitWorkspace (3단 레이아웃)
- 왼쪽 (3/12): 분할 후보 목록 + Cloze 수 뱃지
- 중앙 (5/12): 원본 카드 (ContentRenderer + 검증 패널)
- 오른쪽 (4/12): 분할 미리보기 + LLM 모델 선택 (ModelBadge) + 적용/반려 버튼

### ValidationPanel
4종 검증 결과 표시. `validating-cards` 스킬 참조.

## 토스트 알림 (sonner)

`sonner` 라이브러리의 `Toaster` 컴포넌트를 `App.tsx`에 전역 마운트.
페이지에서 `import { toast } from "sonner"`로 직접 호출.

```typescript
toast.success("분할이 적용되었습니다");
toast.error(`분석 실패: ${message}`);
toast.warning("히스토리 세션이 없습니다");
toast.info("분할 결과가 반려되었습니다");
```

설정: `position="bottom-right"`, `richColors`, `duration={4000}`.

## TanStack Query 패턴

```typescript
// 훅 구조
export function useCards(deckName: string, options: CardOptions) {
  return useQuery({
    queryKey: queryKeys.cards.byDeck(deckName, options),
    queryFn: () => api.cards.list(deckName, options),
    enabled: !!deckName,
    staleTime: 30 * 1000,
  });
}

// 캐시 무효화 (분할 적용 후)
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```

### 주요 staleTime 값

| 훅 | staleTime | 이유 |
|----|-----------|------|
| `useCards` | 30초 | 카드 데이터는 분할 외엔 잘 안 바뀜 |
| `useBackups` | 30초 | 백업도 동일 |
| `useDifficultCards` | 60초 | 학습 데이터 기반, 자주 안 바뀜 |
| `useLLMModels` | 5분 | 모델 목록은 서버 재시작 전엔 고정 |

## CSS 주의사항

- **`.container` 충돌**: Tailwind의 `.container` 유틸리티와 충돌 -> `.callout`로 변경
- **flex 스크롤**: 부모에 `min-h-0` + `overflow-hidden` 필수
- **타이포 토큰 사용**: 페이지 헤더/본문은 `typo-h1`, `typo-h2`, `typo-body` 등 디자인 시스템 유틸 우선 사용
- **모바일 Drawer 전환**: Sidebar는 `translate-x` + backdrop `opacity` 전환으로 열림/닫힘 애니메이션 보장

## 자주 발생하는 문제

- **`<br>` 태그 미처리**: `preprocessAnkiHtml`에서 `<br>` -> `\n` 변환
- **스크롤 안 됨**: flex 컨테이너에 `min-h-0` 누락
- **분할 미리보기 캐싱**: React Query `setQueryData`로 카드별 독립 캐시
- **Shadcn 파일 casing 충돌**: `Button.tsx`/`button.tsx` 혼용 시 TS 중복 포함 오류 -> 소문자 import 경로 통일

## 테스트 패턴

- 컴포넌트 테스트: `packages/web/tests/components/*.test.tsx` (Vitest + Testing Library)
- E2E 스모크: `packages/web/tests/e2e/smoke.spec.ts` (Playwright)
- 실행 명령:
  - `bun run --cwd packages/web test`
  - `bun run --cwd packages/web test:e2e` (`packages/web/playwright.config.ts`의 `webServer`가 `bun run preview`를 자동 실행하므로 별도 dev 서버 기동 불필요)

## 상세 참조

- `references/pages.md` -- 7개 페이지 역할 상세
- `references/components.md` -- ContentRenderer, DiffViewer, ValidationPanel 상세
- `references/query-patterns.md` -- TanStack Query 훅, 캐싱 전략
- `references/troubleshooting.md` -- CSS 충돌, 렌더링 문제
