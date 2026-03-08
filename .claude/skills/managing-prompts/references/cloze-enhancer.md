# Cloze Enhancer 상세

## 개요

`packages/core/src/gemini/cloze-enhancer.ts`에서 이진 패턴을 자동 감지하여 Yes/No Cloze에 힌트를 추가. `gemini/` 디렉토리에 있지만 LLM API를 호출하지 않는 순수 로컬 패턴 매칭 유틸리티입니다.

## 지원 패턴 (26개)

| 카테고리 | 패턴 (개수) | 힌트 예시 |
|----------|------------|----------|
| 존재/상태 (4) | 있다/없다, 가능/불가능, 필요/불필요, 포함/미포함 | `있다 \| 없다` |
| 방향성 (6) | 증가/감소, 상향/하향, 상승/하락, 빠르다/느리다, 크다/작다, 높다/낮다 | `증가 ↑ \| 감소 ↓` |
| 연결/동기화 (4) | 동기/비동기, 블로킹/논블로킹, 연결 지향/비연결, 직렬/병렬 | `Sync \| Async` |
| 상태 (4) | 상태/무상태, 유상태/무상태, 영구/임시, 휘발성/비휘발성 | `Stateful \| Stateless` |
| 계층 (4) | 물리/논리, 하드웨어/소프트웨어, 로컬/원격, 내부/외부 | `Physical \| Logical` |
| 평가 (4) | 장점/단점, 적용된다/적용되지 않는다, 성공/실패, 허용/금지 | `Pros ✓ \| Cons ✗` |

## 주요 함수

```typescript
// 텍스트 분석 및 힌트 추가
const analysis = analyzeClozes(cardText);
// 결과: { original, enhanced, enhancedCount, clozeMatches[] }

// 카드 배열 일괄 힌트 추가
const results = enhanceCardsWithHints(cards);
// 입력: Array<{ content: string }>
// 결과: Array<{ content: string, enhanced: boolean, enhancedCount: number }>

// 카드 품질 검사
const quality = checkCardQuality(cardText);
// 결과: {
//   charCount: number,
//   isUnder80Chars: boolean,
//   hasHint: boolean,
//   needsHint: boolean,
//   hasContextTag: boolean,
//   cardType: 'cloze' | 'basic',
//   issues: string[]
// }

// 이진 패턴 감지
const pattern = detectBinaryPattern("연결 지향적");
// 반환 타입: BinaryPattern | null
// BinaryPattern = { pattern: RegExp, hint: string, category: string }

// 카드 글자 수 계산 (Cloze 마크업, HTML 태그, 맥락 태그 제외)
const chars = countCardChars(content);

// 카드 타입 자동 감지
const type = detectCardType(content); // "cloze" | "basic"
// Q: ... A: ... 형식이면 "basic", Cloze 마크업이 있으면 "cloze", 기본값 "cloze"
```

## LLM 응답 스키마 확장

```typescript
interface SplitCard {
  // 기존 필드...
  cardType?: 'cloze' | 'basic';
  charCount?: number;
  contextTag?: string;   // "[DNS > Record > A]"
}

interface QualityChecks {
  allCardsUnder80Chars: boolean;
  allClozeHaveHints: boolean;
  noEnumerations: boolean;
  allContextTagsPresent: boolean;
}
```
