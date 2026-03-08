# nid 승계 전략

## 목적

분할 후 기존 nid 링크가 깨지지 않도록 보장.

## 전략

### 메인 카드 (mainCardIndex)

- LLM 응답의 `mainCardIndex`가 가리키는 카드
- `updateNoteFields`로 기존 노트의 필드만 업데이트
- **기존 nid 유지** -- 다른 카드에서 이 nid를 참조하는 링크 보존

```typescript
// operations.ts: updateMainCard()
await updateNoteFields(originalNoteId, { Text: mainCardContent });
```

### 서브 카드

- `addNotes`로 새 노트 생성 (새 nid 부여)
- 원본 카드로의 **역링크** 자동 삽입

```typescript
// operations.ts: addSplitCards()
const notes = cards.map(card => ({
  deckName,
  modelName: 'KaTeX and Markdown Cloze',
  fields: { Text: card.content, 'Back Extra': '' },
  tags: [...originalTags, ...card.inheritTags],
}));
const results = await addNotes(notes);
```

## 역링크 형식

새 카드에 원본 카드로의 nid 링크 삽입. `createBackLink()` (`nid-parser.ts`):

```
[원문: 원본 카드 제목|nid{원본nid}]
```

**주의**: `원문: ` 접두사가 포함됨. `createBackLink(originalTitle, originalNid)`는 내부적으로 `createNidLink('원문: ' + originalTitle, originalNid)`를 호출.

## LLM 응답 스키마 (zod, validator.ts)

```typescript
// SplitResponseSchema
const SplitResponseSchema = z.object({
  originalNoteId: z.union([z.string(), z.number()]).transform(String),
  shouldSplit: z.boolean(),
  mainCardIndex: z.number().int().min(0),
  splitCards: z.array(SplitCardSchema),
  splitReason: z.string(),
  qualityChecks: QualityChecksSchema,  // optional, nullable
});

// SplitCardSchema
const SplitCardSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  cardType: z.enum(['cloze', 'basic']).optional().default('cloze'),
  charCount: z.number().int().min(0).optional(),
  contextTag: z.string().optional(),
  inheritImages: z.array(z.string()).default([]),
  inheritTags: z.array(z.string()).default([]),
  preservedLinks: z.array(z.string()).default([]),
  backLinks: z.array(z.string()).default([]),
});

// QualityChecksSchema
const QualityChecksSchema = z.object({
  allCardsUnder80Chars: z.boolean(),
  allClozeHaveHints: z.boolean(),
  noEnumerations: z.boolean(),
  allContextTagsPresent: z.boolean(),
}).optional().nullable();
```

### 분할 불필요 응답

`shouldSplit: false`이면 `splitCards: []`, `qualityChecks: null`.

### 검증 규칙

- `shouldSplit=true`이면 `splitCards`가 비어있으면 에러
- `mainCardIndex >= splitCards.length`이면 에러
- `originalNoteId`는 string/number 모두 허용 (transform으로 String 변환)

## 분할 적용 흐름 (operations.ts: `applySplitResult()`)

1. `splitCards[mainCardIndex]`를 `updateMainCard()`로 기존 nid에 적용
2. 나머지 카드를 `addSplitCards()`로 새 노트 생성
3. 반환: `{ mainNoteId: originalNoteId, newNoteIds: number[] }`
