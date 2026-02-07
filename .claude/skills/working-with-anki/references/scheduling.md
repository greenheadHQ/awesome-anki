# 학습 데이터 복제 및 제한사항

## ease factor 복제

분할 시 원본 카드의 ease factor를 새 카드에 복제하여 학습 난이도 유지.

```typescript
// packages/core/src/anki/scheduling.ts
await ankiConnect('setEaseFactors', {
  cards: newCardIds,
  easeFactors: Array(newCardIds.length).fill(originalFactor)
});
```

## 복제 불가 항목

### interval

- AnkiConnect의 `setEaseFactors` API는 ease factor만 설정 가능
- `interval` (복습 간격)은 직접 설정하는 API 미존재
- Anki 내부 스케줄러가 관리

### due

- `due` (다음 복습 일자)도 직접 설정 불가
- `setDueDate` API가 있으나, 상대 날짜만 지원

## 대안

- Anki 플러그인 직접 개발하여 DB 직접 조작 가능성
- 현재는 미구현 (기술 부채로 추적 중)
