# Cloze Enhancer 상세

## 개요

`packages/core/src/gemini/cloze-enhancer.ts`에서 이진 패턴을 자동 감지하여 Yes/No Cloze에 힌트를 추가.

## 지원 패턴 (25개)

| 카테고리 | 패턴 예시 | 힌트 |
|----------|----------|------|
| 존재/상태 | 있다/없다, 가능/불가능, 필요/불필요 | `있다 \| 없다` |
| 방향성 | 증가/감소, 상향/하향, 빠르다/느리다 | `증가 ↑ \| 감소 ↓` |
| 연결/동기화 | 동기/비동기, 블로킹/논블로킹, 연결/비연결 | `Sync \| Async` |
| 상태 | 상태/무상태, 영구/임시, 휘발성/비휘발성 | `Stateful \| Stateless` |
| 계층 | 물리/논리, 하드웨어/소프트웨어 | `Physical \| Logical` |
| 평가 | 장점/단점, 성공/실패, 허용/금지 | `Pros ✓ \| Cons ✗` |

## 주요 함수

```typescript
// 텍스트 분석 및 힌트 추가
const analysis = analyzeClozes(cardText);
// 결과: { original, enhanced, enhancedCount, clozeMatches[] }

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
// 결과: { pattern, hint: "연결 지향 | 비연결", category: "connection" }
```

## Gemini 응답 스키마 확장

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
