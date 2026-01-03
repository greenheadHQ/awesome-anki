# Troubleshooting & 개발 기록

이 문서는 프로젝트 개발 과정에서 발생한 문제와 해결 방법을 기록합니다.

---

## 1. 환경 설정 이슈

### 1.1 bun 런타임 사용
- **상황**: 프로젝트는 npm 대신 bun을 사용
- **주의**: `npm install` 대신 `bun install` 사용
- **설정**: `package.json`의 scripts에서 `tsx` 대신 `bun run` 사용

### 1.2 Anki 프로필 안전 규칙
- **중요**: 항상 `test` 프로필에서만 작업
- **실행 방법**: `open -a Anki --args -p test`
- **이유**: 기본 프로필의 학습 데이터 보호

---

## 2. CSS 클래스 충돌

### 2.1 `.container` vs Tailwind `.container`
- **문제**: 커스텀 `.container` 클래스가 Tailwind의 `.container` 유틸리티와 충돌
- **증상**: 사이드바 오른쪽에 의도치 않은 `border-left` 표시
- **해결**: 클래스명을 `.container` → `.callout`로 변경

**변경 파일:**
- `packages/web/src/index.css`: `.container-*` → `.callout-*`
- `packages/web/src/components/card/ContentRenderer.tsx`: HTML 출력 시 `callout` 클래스 사용

```css
/* Before */
.container { border-left: 4px solid; }
.container-tip { ... }

/* After */
.callout { border-left: 4px solid; }
.callout-tip { ... }
```

---

## 3. 모노레포 설정

### 3.1 패키지 구조
```
packages/
├── core/     # 핵심 로직 (CLI + 웹 공용)
├── server/   # Hono REST API
└── web/      # React 프론트엔드
```

### 3.2 export 충돌 문제
- **문제**: `packages/core/src/index.ts`에서 `export *` 사용 시 이름 충돌
- **충돌 항목**:
  - `SplitCard`: `anki/operations.ts`와 다른 파일에서 중복
  - `validateStylePreservation`: `gemini/validator.ts`와 `utils/formatters.ts`에서 중복
- **해결**: `export *` 대신 명시적 named export 사용

```typescript
// Before (충돌 발생)
export * from './anki/index.js';
export * from './gemini/index.js';

// After (명시적 export)
export {
  ankiConnect,
  getVersion,
  // ... 개별 항목 나열
} from './anki/client.js';
```

---

## 4. Gemini API

### 4.1 모델 업그레이드
- **이전**: `gemini-2.0-flash`
- **현재**: `gemini-3-flash-preview`
- **특징**:
  - 1M 토큰 입력 지원
  - 구조화된 출력 지원
  - 더 정확한 분할 제안

### 4.2 API 키 설정
- `.env` 파일에 `GEMINI_API_KEY` 설정 필요
- `.env.example` 참고

---

## 5. AnkiConnect API

### 5.1 학습 데이터 복제 제한
- **문제**: `interval`, `due` 필드는 AnkiConnect로 직접 설정 불가
- **해결**: `ease factor`만 복제 가능
- **API**: `setEaseFactors` 사용

### 5.2 카드 정보 조회
```typescript
// cardsInfo API로 학습 데이터 조회
const cardInfo = await ankiConnect('cardsInfo', { cards: [cardId] });
// 결과: interval, factor, due, reps, lapses 등
```

---

## 6. 웹 GUI 이슈

### 6.1 Tailwind CSS v4 설정
- **문제**: Tailwind v4에서 `tailwindcss init` 명령어 변경됨
- **해결**: `@tailwindcss/postcss` 플러그인 사용

```javascript
// postcss.config.js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

### 6.2 KaTeX CSS 로딩
- **설정**: `ContentRenderer.tsx`에서 직접 import
```typescript
import 'katex/dist/katex.min.css';
```

### 6.3 React Query 캐시 무효화
- **주의**: 분할 적용 후 카드 목록과 백업 목록 캐시 무효화 필요
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
queryClient.invalidateQueries({ queryKey: queryKeys.backups.all });
```

---

## 7. 파서 설계

### 7.1 컨테이너 파서 (상태 머신)
- **문제**: 정규식만으로는 중첩 `::: toggle` 처리 불가
- **해결**: 스택 기반 상태 머신 방식
```typescript
interface ParserState {
  depth: number;
  stack: ContainerBlock[];
  currentBlock: ContainerBlock | null;
}
```

### 7.2 Cloze 번호 처리
- **결정**: 분할 후 모든 카드는 `{{c1::}}`로 리셋
- **이유**: 1 Note = 1 Atomic Card 원칙

---

## 8. 개발 서버 실행

### 8.1 동시 실행
```bash
# 서버 + 클라이언트 동시
bun run dev

# 개별 실행
bun run dev:server  # localhost:3000
bun run dev:web     # localhost:5173
```

### 8.2 포트 충돌 해결
```bash
# 포트 사용 중인 프로세스 종료
lsof -ti:3000 | xargs kill -9
```

---

## 9. Git 커밋 히스토리 참고

주요 커밋:
- `feat: 웹 GUI MVP 구현 (Phase 1-2 완료)` - 모노레포 설정, API 서버
- `feat: Phase 3 - 분할 작업 UI 구현` - SplitWorkspace, ContentRenderer
- `fix: CSS 클래스명 충돌 해결` - .container → .callout
- `feat: Gemini 3 Flash Preview로 업그레이드`
- `feat: rollback, 학습 데이터 복제, --note 플래그 구현`

---

## 10. Phase 4 이슈 및 해결

### 10.1 원본 카드 텍스트 말줄임 문제

**문제**: SplitWorkspace에서 원본 카드 텍스트가 `...`으로 잘려서 표시됨

**원인**: `GET /api/cards/deck/:name` API에서 목록 조회 시 성능을 위해 텍스트를 200자로 잘라서 반환

```typescript
// packages/server/src/routes/cards.ts 라인 39
text: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
```

**해결**: 카드 선택 시 `useCardDetail` 훅으로 상세 API 호출하여 전체 텍스트 가져오기

```typescript
// packages/web/src/pages/SplitWorkspace.tsx
const { data: cardDetail, isLoading: isLoadingDetail } = useCardDetail(
  selectedCard?.noteId ?? null
);

// ContentRenderer에 전체 텍스트 전달
<ContentRenderer content={cardDetail?.text || selectedCard.text} />
```

### 10.2 Hard Split 기준 문제

**문제**: `---` 구분선이 분석에서 Hard Split 가능으로 감지되지만, 실제로 사용자는 `---`를 카드 분할 용도로 사용하지 않음

**이전 로직**:
- `canHardSplit`: `---` 또는 `####` 헤더가 있으면 true
- 실제 분할: `####` 헤더로만 분할

**수정된 로직**:
- `canHardSplit`: `####` 헤더가 **2개 이상** 있을 때만 true
- `---` 구분선은 Hard Split 기준에서 완전히 제외

```typescript
// packages/core/src/splitter/atomic-converter.ts
const headerCount = hardSplitPoints.filter((p) => p.type === 'header').length;
return {
  canHardSplit: headerCount >= 2, // 최소 2개 이상의 헤더 필요
  // ...
};
```

**참고**: Hard Split은 거의 사용되지 않을 것으로 예상됨. Soft Split (Gemini) 위주로 사용 권장.

### 10.3 ContentRenderer <br> 태그 처리

**문제**: Anki 카드의 `<br>` 태그가 ReactMarkdown에서 제대로 렌더링되지 않음

**해결**: `preprocessAnkiHtml` 함수 추가하여 `<br>` 태그를 줄바꿈으로 변환

```typescript
// packages/web/src/components/card/ContentRenderer.tsx
function preprocessAnkiHtml(text: string): string {
  let processed = text;
  processed = processed.replace(/<br\s*\/?>/gi, '\n');
  processed = processed.replace(/&nbsp;/gi, ' ');
  return processed;
}
```

### 10.4 레이아웃 스크롤 문제

**문제**: 원본 카드 영역에서 스크롤이 작동하지 않음

**원인**: flex 컨테이너에서 `min-h-0`가 없으면 overflow가 제대로 작동하지 않음

**해결**: 부모 컨테이너에 `overflow-hidden`과 `min-h-0` 추가

```tsx
<div className="col-span-5 flex flex-col min-h-0 overflow-hidden">
  <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
    <CardContent className="flex-1 overflow-y-auto p-4 min-h-0">
```

### 10.5 ContentRenderer 파싱 문제 (해결됨)

**문제**: 원본 카드의 렌더링된 뷰에서 ::: 컨테이너, nid 링크 등이 제대로 표시되지 않음

**증상**:
- `::: link`, `::: toggle` 등 컨테이너가 스타일 없이 표시
- `[제목|nid...]` 형식의 nid 링크가 파싱되지 않음
- HTML과 마크다운이 혼합된 내용이 깨짐

**원인**:
- ReactMarkdown + rehypeRaw 조합에서 복잡한 HTML/마크다운 혼합 처리 문제

**해결**:
- ReactMarkdown → markdown-it으로 전면 리팩토링
- markdown-it-container 플러그인으로 컨테이너 처리
- highlight.js로 코드 하이라이팅
- 직접 전처리: Cloze, nid 링크, 이미지 프록시

**관련 파일**: `packages/web/src/components/card/ContentRenderer.tsx`

---

## 11. Phase 5-6 이슈

### 11.1 useValidationCache 상태 공유 문제

**문제**: `useValidateCard` 훅에서 검증 성공 후 CardBrowser의 상태가 업데이트되지 않음

**원인**: `useValidationCache()` 훅이 각 컴포넌트에서 별도의 React 상태를 생성

**해결**: `useSyncExternalStore`를 사용하여 전역 상태 공유

```typescript
// 전역 캐시 상태
let globalCache: ValidationCache = loadCacheFromStorage();
const listeners = new Set<() => void>();

export function useValidationCache() {
  const cache = useSyncExternalStore(subscribe, getSnapshot);
  // ...
}
```

### 11.2 분할 미리보기 렌더링 문제

**문제**: SplitWorkspace의 분할 미리보기에서 Raw HTML로만 표시되고 KaTeX/Markdown이 렌더링되지 않음

**해결**: `SplitPreviewCard` 컴포넌트에 `ContentRenderer` 적용 + Raw/Rendered 토글 추가

---

## 12. 임베딩 모듈 이슈

### 12.1 Gemini SDK TaskType 미지원

**문제**: `@google/genai` 패키지에서 `TaskType` enum이 export되지 않음

```typescript
// 에러 발생
import { GoogleGenAI, TaskType } from '@google/genai';
// error TS2305: Module '"@google/genai"' has no exported member 'TaskType'.
```

**해결**: 문자열로 직접 지정

```typescript
import { GoogleGenAI } from '@google/genai';

const response = await client.models.embedContent({
  model: 'gemini-embedding-001',
  contents: text,
  config: {
    taskType: 'SEMANTIC_SIMILARITY', // 문자열로 직접 지정
    outputDimensionality: 768,
  },
});
```

**참고**: 사용 가능한 taskType 값
- `RETRIEVAL_QUERY` - 검색 쿼리
- `RETRIEVAL_DOCUMENT` - 검색 문서
- `SEMANTIC_SIMILARITY` - 의미적 유사도 (권장)
- `CLASSIFICATION` - 분류
- `CLUSTERING` - 클러스터링

### 12.2 임베딩 캐시 위치

- 캐시 파일: `output/embeddings/{deckNameHash}.json`
- 덱 이름을 MD5 해시로 변환하여 파일명 생성
- 텍스트 변경 감지: MD5 해시로 비교

```bash
# 캐시 상태 확인
curl -s "http://localhost:3000/api/embedding/status/덱이름" | python3 -m json.tool

# 캐시 삭제
curl -X DELETE "http://localhost:3000/api/embedding/cache/덱이름"
```

---

## 13. 디버깅 팁

### 13.1 API 응답 확인
```bash
curl -s http://localhost:3000/api/decks | python3 -m json.tool
curl -s http://localhost:3000/api/cards/1757399484677 | python3 -m json.tool
```

### 13.2 AnkiConnect 직접 테스트
```bash
curl -s http://localhost:8765 -X POST -d '{
  "action": "deckNames",
  "version": 6
}' | python3 -m json.tool
```

### 13.3 타입체크
```bash
bun run --cwd packages/web tsc --noEmit
bun run --cwd packages/server tsc --noEmit
```
