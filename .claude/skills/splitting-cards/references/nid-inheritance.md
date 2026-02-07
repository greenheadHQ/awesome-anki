# nid 승계 전략

## 목적

분할 후 기존 nid 링크가 깨지지 않도록 보장.

## 전략

### 메인 카드 (mainCardIndex)

- Gemini 응답의 `mainCardIndex`가 가리키는 카드
- `updateNoteFields`로 기존 노트의 필드만 업데이트
- **기존 nid 유지** — 다른 카드에서 이 nid를 참조하는 링크 보존

```typescript
await ankiConnect('updateNoteFields', {
  note: {
    id: originalNoteId,
    fields: { Text: mainCardContent, 'Back Extra': '' }
  }
});
```

### 서브 카드

- `addNotes`로 새 노트 생성 (새 nid 부여)
- 원본 카드로의 **역링크** 자동 삽입

```typescript
const newNoteIds = await ankiConnect('addNotes', {
  notes: subCards.map(card => ({
    deckName,
    modelName: 'KaTeX and Markdown Cloze',
    fields: { Text: card.content, 'Back Extra': '' },
    tags: card.tags
  }))
});
```

## 역링크 형식

새 카드에 원본 카드로의 nid 링크 삽입:
```
[원본 카드 제목|nid{원본nid}]
```

## Gemini 응답 형식

```typescript
interface SplitResponse {
  mainCardIndex: number;  // 기존 nid를 유지할 카드 인덱스
  splitCards: Array<{
    content: string;
    inheritImages: string[];
    inheritTags: string[];
    preservedLinks: string[];
    backLinks: string[];
  }>;
}
```
