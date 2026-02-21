---
name: developing-web-ui
description: |
  This skill should be used when users request web UI development or debugging.
  Triggers: "React 컴포넌트 추가", "ContentRenderer 수정",
  "TanStack Query", "CSS 충돌", "웹 UI 버그", "페이지 추가",
  "Tailwind 스타일", "렌더링 문제".
  Covers the React frontend, components, query patterns, and UI troubleshooting.
---

# 웹 UI 개발

## 프론트엔드 구조

```
packages/web/src/
├── pages/           # 페이지 컴포넌트
├── components/      # 공유 컴포넌트
│   ├── card/        # ContentRenderer 등
│   ├── help/        # HelpTooltip
│   ├── ui/          # shadcn/ui 스타일 (button, card, popover, select, table, dialog)
│   └── onboarding/  # OnboardingTour (deprecated 예정)
├── hooks/           # TanStack Query 훅
└── lib/             # api.ts, query-keys.ts, helpContent.ts
```

## 페이지 목록

| 페이지 | 경로 | 역할 |
|--------|------|------|
| Dashboard | / | 덱 선택, 통계 카드, 빠른 작업 |
| SplitWorkspace | /split | 3단 레이아웃 (후보 목록 / 원본 / 미리보기) |
| CardBrowser | /browse | 카드 테이블 + 검증 상태 |
| BackupManager | /backups | 백업 목록 + 롤백 |
| PromptManager | /prompts | 버전/히스토리/실험/메트릭 탭 |
| Help | /help | 전체 기능 설명, FAQ, 용어집 |

## 핵심 컴포넌트

### ContentRenderer
Markdown + KaTeX + Cloze 렌더링. **markdown-it** 기반 (ReactMarkdown에서 마이그레이션).

**처리 순서**:
1. Cloze 구문 → `<span class="cloze">` 변환
2. 컨테이너 구문 → `<div class="callout-*">` 변환
3. Markdown → HTML (markdown-it + highlight.js)
4. KaTeX 수식 렌더링
5. nid 링크 처리
6. 이미지 프록시 (AnkiConnect)

### SplitWorkspace (3단 레이아웃)
- 왼쪽 (3/12): 분할 후보 목록 + Hard/Soft 뱃지
- 중앙 (5/12): 원본 카드 (ContentRenderer + 검증 패널)
- 오른쪽 (4/12): 분할 미리보기 + 적용 버튼

### ValidationPanel
4종 검증 결과 표시. `validating-cards` 스킬 참조.

## TanStack Query 패턴

```typescript
// 훅 구조
export function useCards(deckName: string, options: CardOptions) {
  return useQuery({
    queryKey: queryKeys.cards.list(deckName, options),
    queryFn: () => api.cards.list(deckName, options),
    enabled: !!deckName,
  });
}

// 캐시 무효화 (분할 적용 후)
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```

## CSS 주의사항

- **`.container` 충돌**: Tailwind의 `.container` 유틸리티와 충돌 → `.callout`로 변경
- **flex 스크롤**: 부모에 `min-h-0` + `overflow-hidden` 필수
- **KaTeX CSS**: ContentRenderer에서 `import 'katex/dist/katex.min.css'` 직접 import
- **타이포 토큰 사용**: 페이지 헤더/본문은 `typo-h1`, `typo-h2`, `typo-body` 등 디자인 시스템 유틸 우선 사용
- **모바일 Drawer 전환**: Sidebar는 `translate-x` + backdrop `opacity` 전환으로 열림/닫힘 애니메이션 보장

## 자주 발생하는 문제

- **`<br>` 태그 미처리**: `preprocessAnkiHtml`에서 `<br>` → `\n` 변환
- **스크롤 안 됨**: flex 컨테이너에 `min-h-0` 누락
- **react-joyride import 에러**: 타입은 `type` 키워드로 import (`type CallBackProps`)
- **분할 미리보기 캐싱**: React Query `setQueryData`로 카드별 독립 캐시
- **Shadcn 파일 casing 충돌**: `Button.tsx`/`button.tsx` 혼용 시 TS 중복 포함 오류 발생 → 소문자 import 경로 통일

## 테스트 패턴

- 컴포넌트 테스트: `packages/web/tests/components/*.test.tsx` (Vitest + Testing Library)
- E2E 스모크: `packages/web/tests/e2e/smoke.spec.ts` (Playwright)
- 실행 명령:
  - `bun run --cwd packages/web test`
  - `bun run --cwd packages/web test:e2e` (`packages/web/playwright.config.ts`의 `webServer`가 `bun run preview`를 자동 실행하므로 별도 dev 서버 기동 불필요)

## 상세 참조

- `references/pages.md` — 6개 페이지 역할 상세
- `references/components.md` — ContentRenderer, ValidationPanel 상세
- `references/query-patterns.md` — TanStack Query 훅, 캐싱 전략
- `references/troubleshooting.md` — CSS 충돌, 렌더링 문제
