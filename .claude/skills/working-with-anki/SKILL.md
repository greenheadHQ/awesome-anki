---
name: working-with-anki
description: |
  This skill should be used when users request AnkiConnect operations.
  Triggers: "AnkiConnect 연결 안 돼", "test 프로필", "ease factor 복제",
  "카드 정보 조회", "학습 데이터", "AnkiConnect API", "Anki 프로필",
  "카드 모델".
  Covers AnkiConnect API wrapper, test profile safety, and scheduling data replication.
---

# AnkiConnect 작업

## 안전 규칙 (최우선)

- **반드시 `test` 프로필에서만 작업**: `open -a Anki --args -p test`
- 기본 프로필 접근 **절대 금지** — 실제 학습 데이터 보호
- `--apply` 없이 항상 미리보기 먼저 확인

## AnkiConnect 기본 정보

- **주소**: `$ANKI_CONNECT_URL` (미설정 시 `http://localhost:8765` 폴백, MiniPC headless Anki는 Tailscale 전용)
- **애드온 코드**: 2055492159
- **대상 모델**: `KaTeX and Markdown Cloze` (필드: Text, Back Extra)
- **API 버전**: 6

## API 래퍼 (packages/core/src/anki/)

| 파일 | 역할 |
|------|------|
| `client.ts` | `ankiConnect(action, params)` 래퍼 함수 |
| `operations.ts` | 카드 CRUD, 분할 적용 |
| `backup.ts` | 분할 전 백업, 롤백 |
| `scheduling.ts` | ease factor 복제 |
| `difficulty.ts` | 학습 통계 기반 어려운 카드 탐지 (Recursive Splitting) |

### 주요 API 호출 패턴

```typescript
// 기본 호출
const result = await ankiConnect('deckNames', {});

// 카드 정보 조회
const cardInfo = await ankiConnect('cardsInfo', { cards: [cardId] });
// → interval, factor, due, reps, lapses 등

// 노트 필드 업데이트 (메인 카드 nid 유지)
await ankiConnect('updateNoteFields', {
  note: { id: originalNoteId, fields: newFields }
});

// 새 노트 추가 (서브 카드)
const newNoteIds = await ankiConnect('addNotes', {
  notes: subCards.map(card => ({ deckName, modelName, fields, tags }))
});
```

## 학습 데이터 복제

- **복제 가능**: ease factor (`setEaseFactors` API)
- **복제 불가**: interval, due — AnkiConnect API 제한
- 대안으로 Anki 플러그인 직접 개발 가능성 있으나 미구현

## 백업/롤백

- **저장 위치**: `output/backups/{timestamp}_{noteId}.json`
- **저장 내용**: 원본 필드, 태그, 생성된 카드 ID
- **롤백**: 원본 복원 + 생성된 카드 삭제

## 연결 확인

```bash
# 직접 테스트
curl -s $ANKI_CONNECT_URL -X POST -d '{"action":"deckNames","version":6}' | python3 -m json.tool
```

## 자주 발생하는 문제

- **연결 실패**: Anki가 실행 중인지 + AnkiConnect 애드온 활성화 확인
- **프로필 혼동**: 반드시 `open -a Anki --args -p test`로 실행
- **cardsInfo vs notesInfo**: 학습 데이터는 `cardsInfo`에서 조회

## 상세 참조

- `references/ankiconnect-api.md` — API 래퍼 상세, 주요 메서드
- `references/scheduling.md` — ease factor 복제, 제한사항
- `references/troubleshooting.md` — 연결 문제, 프로필 안전
