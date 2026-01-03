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

## 10. 디버깅 팁

### 10.1 API 응답 확인
```bash
curl -s http://localhost:3000/api/decks | python3 -m json.tool
curl -s http://localhost:3000/api/cards/1757399484677 | python3 -m json.tool
```

### 10.2 AnkiConnect 직접 테스트
```bash
curl -s http://localhost:8765 -X POST -d '{
  "action": "deckNames",
  "version": 6
}' | python3 -m json.tool
```

### 10.3 타입체크
```bash
bun run --cwd packages/web tsc --noEmit
bun run --cwd packages/server tsc --noEmit
```
