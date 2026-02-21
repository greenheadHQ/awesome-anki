# AnkiConnect API 래퍼 상세

## 기본 정보

- **주소**: `$ANKI_CONNECT_URL` (MiniPC headless Anki, Tailscale 전용)
- **API 버전**: 6
- **애드온 코드**: 2055492159
- **대상 모델**: `KaTeX and Markdown Cloze` (필드: Text, Back Extra)

## API 래퍼 (packages/core/src/anki/client.ts)

```typescript
// 기본 호출 패턴 (기본 타임아웃 5초)
const result = await ankiConnect(action, params);

// 타임아웃 커스텀 (배치 작업 등)
const result = await ankiConnect(action, params, { timeout: 30000 });
```

## 타임아웃 및 에러 유형

| 에러 타입 | 상황 | HTTP 코드 |
|-----------|------|-----------|
| `TimeoutError` | Anki 응답 지연 (기본 5초 초과) | 504 |
| `AnkiConnectError` | 연결 거부, HTTP 에러, API 에러 | 502 |

- `AbortSignal.timeout()`으로 구현 (Bun 네이티브 지원)
- 연결 거부 vs 타임아웃 자동 구분
- 배치 작업(임베딩 생성 등)에서는 `{ timeout: 30000 }` 권장

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
curl -s $ANKI_CONNECT_URL -X POST -d '{
  "action": "deckNames",
  "version": 6
}' | python3 -m json.tool
```
