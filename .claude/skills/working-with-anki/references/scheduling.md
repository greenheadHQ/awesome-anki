# 학습 데이터 복제 상세 (scheduling.ts)

소스: `packages/core/src/anki/scheduling.ts`

## 인터페이스

```typescript
interface CardSchedulingInfo {
  cardId: number;
  interval: number;   // 일 단위 간격
  factor: number;     // ease factor (2500 = 250%)
  due: number;        // 다음 복습 예정일
  reps: number;       // 복습 횟수
  lapses: number;     // 실패 횟수
  type: number;       // 카드 타입 (0=new, 1=learning, 2=review)
  queue: number;      // 큐 (0=new, 1=learning, 2=review)
}

interface FullCardInfo extends CardSchedulingInfo {
  noteId: number;
  deckName: string;
  modelName: string;
  fields: Record<string, { value: string; order: number }>;
  tags: string[];
}
```

## 함수별 상세

### `cloneSchedulingAfterSplit(originalNoteId, newCardIds)` -- 메인 진입점

분할 후 학습 데이터 복제 헬퍼. split apply 라우트에서 호출됨.

1. `findCardsByNote(originalNoteId)`로 원본 노트의 카드 찾기
2. 카드가 없으면 `{ copied: false }` 반환
3. 첫 번째 카드의 스케줄링 정보 조회
4. **리뷰 카드(type=2)이고 reps>0인 경우에만** `copySchedulingToNewCards()` 호출
5. 새 카드/learning 카드는 복제 건너뜀

```typescript
// 반환 타입
{ copied: boolean; sourceScheduling?: CardSchedulingInfo }
```

**왜 type=2 && reps>0만?** 아직 학습하지 않은 카드(new/learning)는 복제할 학습 데이터가 없으므로 건너뛴다. 충분히 복습한 카드만 ease factor를 복제해서 새 카드가 처음부터 적절한 난이도로 시작하게 한다.

### `copySchedulingToNewCards(sourceCardId, targetCardIds)`

원본 카드의 ease factor를 새 카드들에 복제. `setEaseFactors` API 사용.

- 기본값(2500)이 아닌 경우에만 복제 (기본값이면 변경 불필요)
- 실패 시 `console.warn`으로 경고만 출력 (비치명적)

### `setCardScheduling(cardId, scheduling)`

개별 카드의 스케줄링 설정. 현재 `factor` (ease factor)만 설정 가능.

- `setEaseFactors` API로 ease factor 설정
- `interval`, `due`는 AnkiConnect로 직접 설정 불가 (주석으로 명시됨)

### `getCardSchedulingInfo(cardIds)`

`cardsInfo` API를 호출하여 `CardSchedulingInfo`만 추출 (FullCardInfo에서 필요한 필드만 매핑).

### `getFullCardInfo(cardIds)`

`cardsInfo` API를 호출하여 전체 카드 정보를 반환. backup.ts와 difficulty.ts에서 사용.

### `findCardsByNote(noteId)`

`findCards` API에 `nid:{noteId}` 쿼리를 보내 해당 노트의 카드 ID들을 반환.

## 복제 불가 항목

| 필드 | 이유 |
|------|------|
| `interval` | AnkiConnect에 직접 설정 API 없음 |
| `due` | `setDueDate` API가 있으나 상대 날짜만 지원 |
| `reps`, `lapses` | 직접 설정 API 없음 |

대안으로 Anki 플러그인 직접 개발하여 DB 조작 가능성이 있으나 미구현 (기술 부채).
