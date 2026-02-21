# 웹 UI 트러블슈팅

## CSS 클래스 충돌

- **문제**: 커스텀 `.container` 클래스가 Tailwind의 `.container` 유틸리티와 충돌
- **증상**: 사이드바 오른쪽에 의도치 않은 `border-left` 표시
- **해결**: `.container-*` → `.callout-*`로 변경
- **관련 파일**: `packages/web/src/index.css`, `ContentRenderer.tsx`

## shadcn 파일 casing 충돌

- **문제**: `Button.tsx`와 `button.tsx` 경로 혼용 시 TS 중복 include 에러 발생
- **증상**: `differs only in casing` 타입체크 오류
- **해결**: `components/ui/*` import를 모두 소문자 경로로 통일
  - `../components/ui/button`
  - `../components/ui/card`
  - `../components/ui/popover`

## ContentRenderer `<br>` 태그 처리

- **문제**: Anki 카드의 `<br>` 태그가 렌더링되지 않음
- **해결**: `preprocessAnkiHtml` 함수에서 `<br>` → `\n`, `&nbsp;` → ` ` 변환

## ContentRenderer 파싱 미스매칭

- **문제**: `::: link`, `::: toggle` 컨테이너/nid 링크가 스타일 없이 표시
- **원인**: ReactMarkdown + rehypeRaw에서 복잡한 HTML/마크다운 혼합 처리 실패
- **해결**: ReactMarkdown → **markdown-it** 전면 리팩토링
  - markdown-it-container 플러그인으로 컨테이너 처리
  - highlight.js로 코드 하이라이팅
  - Cloze, nid 링크, 이미지 프록시 직접 전처리

## 레이아웃 스크롤 문제

- **문제**: 원본 카드 영역에서 스크롤 작동 안 함
- **원인**: flex 컨테이너에 `min-h-0` 누락
- **해결**: 부모 컨테이너에 `overflow-hidden`과 `min-h-0` 추가
  ```tsx
  <div className="col-span-5 flex flex-col min-h-0 overflow-hidden">
  ```

## 모바일 Drawer 열림 애니메이션이 안 보임

- **문제**: 햄버거 클릭 시 닫힘은 애니메이션되지만 열림은 즉시 표시됨
- **원인**: mount 타이밍에 최종 상태 클래스가 적용되어 transition 시작점이 사라짐
- **해결**: 모바일 Drawer/backdrop을 항상 mount하고 `open` 값으로 `translate-x`/`opacity`만 전환
  - 관련 파일: `components/layout/Sidebar.tsx`

## Drawer 빠른 연타 시 애니메이션 끊김

- **문제**: 버튼 연타 시 상태 전환이 겹쳐 뚝뚝 끊김
- **해결**: `isSidebarAnimating` 잠금으로 애니메이션 구간(약 220ms) 동안 입력 차단
  - 관련 파일: `components/layout/Layout.tsx`, `components/layout/Sidebar.tsx`

## 탭 전환이 뚝뚝 끊김

- **문제**: SplitWorkspace/PromptManager 탭 콘텐츠가 즉시 교체됨
- **해결**: 콘텐츠 래퍼에 `animate-in fade-in-0 slide-in-from-right-2 duration-200` 적용
  - 관련 파일: `pages/SplitWorkspace.tsx`, `pages/PromptManager.tsx`

## react-joyride import 에러

- **문제**: `CallBackProps` 타입 import 시 런타임 에러
- **원인**: 타입을 named export로 import하면 Vite/esbuild에서 런타임에 못 찾음
- **해결**: `type` 키워드 사용
  ```typescript
  import Joyride, { STATUS, type Step, type CallBackProps } from 'react-joyride';
  ```

## Tailwind CSS v4 설정

- **문제**: v4에서 `tailwindcss init` 명령어 변경
- **해결**: `@tailwindcss/postcss` 플러그인 사용 (`postcss.config.js`)

## Biome에서 Tailwind 지시어 파싱 실패

- **문제**: `@theme`, `@apply` 문법에서 Biome parse 에러
- **해결**: `biome.json`에 css parser 옵션 활성화
  ```json
  {
    "css": {
      "parser": {
        "tailwindDirectives": true
      }
    }
  }
  ```

## KaTeX CSS 로딩

```typescript
import 'katex/dist/katex.min.css';
```
ContentRenderer에서 직접 import.

## React Query 캐시 무효화 누락

분할 적용 후 반드시:
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```

## HelpTooltip cursor 누락

- **문제**: (?) 아이콘에 커서 변화 없음
- **해결**: `cursor-pointer` 클래스 추가

## useMutation 반환값을 useEffect 의존성에 넣으면 무한 루프

- **문제**: SplitWorkspace에서 카드 선택 후 사이드바 네비게이션이 작동하지 않음 (URL만 변경, 페이지 미전환)
- **원인**: `useMutation()` 반환값(`splitPreview`)을 `useEffect` 의존성 배열에 포함. 이 객체는 매 렌더마다 새 참조를 생성하여 effect → `reset()` → 상태변경 → 재렌더 → effect의 무한 루프 발생. React의 라우트 전환을 방해
- **해결**: `useEffect` 대신 **이벤트 핸들러**에서 직접 처리
  ```typescript
  // ❌ 잘못된 패턴
  useEffect(() => {
    if (selectedCard) {
      splitPreview.reset();
      splitPreview.mutate(...);
    }
  }, [selectedCard, splitPreview]); // splitPreview는 매 렌더마다 새 참조

  // ✅ 올바른 패턴
  const handleSelectCard = (card: SplitCandidate | null) => {
    setSelectedCard(card);
    if (card) {
      splitPreview.reset();
      splitPreview.mutate(...);
    }
  };
  ```
- **규칙**: `useMutation` 반환값은 절대 `useEffect` deps에 넣지 말 것. 이벤트 핸들러나 콜백에서 직접 호출

## 포트 충돌 (개발 서버)

```bash
pkill -f "vite" 2>/dev/null
pkill -f "bun.*server" 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null
```

## radix-ui/react-popover

```bash
bun add @radix-ui/react-popover
```
HelpTooltip의 Popover 기반.

## CSS 커스텀 스타일 참고

### Cloze 하이라이트
```css
.cloze {
  background-color: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
  padding: 0.1em 0.3em;
  border-radius: 0.25rem;
}
```

### Callout 컨테이너
```css
.callout {
  margin: 1rem 0;
  padding: 1rem;
  border-radius: 0.5rem;
  border-left: 4px solid;
}
.callout-tip { border-color: hsl(142 76% 36%); }
.callout-warning { border-color: hsl(38 92% 50%); }
.callout-error { border-color: hsl(0 84% 60%); }
```
