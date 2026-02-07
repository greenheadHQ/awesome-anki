# 웹 UI 트러블슈팅

## CSS 클래스 충돌

- **문제**: 커스텀 `.container` 클래스가 Tailwind의 `.container` 유틸리티와 충돌
- **증상**: 사이드바 오른쪽에 의도치 않은 `border-left` 표시
- **해결**: `.container-*` → `.callout-*`로 변경
- **관련 파일**: `packages/web/src/index.css`, `ContentRenderer.tsx`

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
