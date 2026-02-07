# AnkiConnect API 래퍼 상세

## 기본 정보

- **주소**: localhost:8765
- **API 버전**: 6
- **애드온 코드**: 2055492159
- **대상 모델**: `KaTeX and Markdown Cloze` (필드: Text, Back Extra)

## API 래퍼 (packages/core/src/anki/client.ts)

```typescript
// 기본 호출 패턴
const result = await ankiConnect(action: string, params?: object);
```

## 주요 메서드

### 덱/노트 조회

```typescript
// 덱 이름 목록
await ankiConnect('deckNames', {});

// 특정 덱의 노트 ID 목록
await ankiConnect('findNotes', { query: `deck:"덱이름"` });

// 노트 정보 (필드, 태그 등)
await ankiConnect('notesInfo', { notes: [noteId] });

// 카드 정보 (학습 데이터 포함)
await ankiConnect('cardsInfo', { cards: [cardId] });
// → interval, factor, due, reps, lapses
```

### 노트 CRUD

```typescript
// 노트 필드 업데이트 (기존 nid 유지)
await ankiConnect('updateNoteFields', {
  note: { id: noteId, fields: { Text: newText, 'Back Extra': '' } }
});

// 새 노트 추가
const noteIds = await ankiConnect('addNotes', {
  notes: [{
    deckName: '덱이름',
    modelName: 'KaTeX and Markdown Cloze',
    fields: { Text: content, 'Back Extra': '' },
    tags: ['tag1', 'tag2']
  }]
});

// 노트 삭제
await ankiConnect('deleteNotes', { notes: [noteId] });
```

### 학습 데이터

```typescript
// ease factor 설정
await ankiConnect('setEaseFactors', {
  cards: [cardId1, cardId2],
  easeFactors: [2500, 2500]
});
```

## 직접 테스트

```bash
curl -s http://localhost:8765 -X POST -d '{
  "action": "deckNames",
  "version": 6
}' | python3 -m json.tool
```
