# AnkiConnect API 래퍼 상세

## 기본 정보

- **주소**: `$ANKI_CONNECT_URL` (MiniPC headless Anki, Tailscale 전용)
- **API 버전**: 6 (`ANKI_CONNECT_VERSION`)
- **기본 타임아웃**: 5000ms (`DEFAULT_TIMEOUT`)
- **애드온 코드**: 2055492159
- **대상 모델**: `KaTeX and Markdown Cloze` (필드: Text, Back Extra)

## 저수준 래퍼 (packages/core/src/anki/client.ts)

```typescript
// 범용 호출 (기본 타임아웃 5초)
const result = await ankiConnect<T>(action, params);

// 타임아웃 커스텀 (배치 작업 등)
const result = await ankiConnect<T>(action, params, { timeout: 30000 });
```

모든 고수준 함수는 내부적으로 `ankiConnect()`를 호출한다.

## 고수준 래퍼 함수 (client.ts에서 직접 export)

외부에서는 `ankiConnect()`를 직접 호출하지 않고, 아래 래퍼 함수를 사용한다.

### 조회 함수

| 함수 | AnkiConnect 액션 | 반환 타입 | 용도 |
|------|-------------------|-----------|------|
| `getVersion()` | `version` | `number` | 연결 확인 |
| `getProfiles()` | `getProfiles` | `string[]` | 프로필 목록 |
| `getDeckNames()` | `deckNames` | `string[]` | 덱 목록 |
| `getModelNames()` | `modelNames` | `string[]` | 모델 목록 |
| `getModelFieldNames(modelName)` | `modelFieldNames` | `string[]` | 모델 필드 |
| `findNotes(query)` | `findNotes` | `number[]` | 노트 ID 검색 |
| `getNotesInfo(notes)` | `notesInfo` | `NoteInfo[]` | 노트 상세 정보 |

### CRUD 함수

| 함수 | AnkiConnect 액션 | 반환 타입 | 용도 |
|------|-------------------|-----------|------|
| `updateNoteFields(noteId, fields)` | `updateNoteFields` | `null` | 필드 업데이트 (nid 유지) |
| `addNote(deckName, modelName, fields, tags)` | `addNote` | `number` | 단일 노트 추가 |
| `addNotes(notes)` | `addNotes` | `(number\|null)[]` | 배치 노트 추가 |
| `addTags(notes, tags)` | `addTags` | `null` | 태그 추가 |
| `removeTags(notes, tags)` | `removeTags` | `null` | 태그 제거 |
| `deleteNotes(notes)` | `deleteNotes` | `null` | 노트 삭제 |
| `sync()` | `sync` | `null` | 동기화 실행 |

### 커스텀 Config 함수 (miniPC 확장 전용)

```typescript
// 공식 AnkiConnect에 없는 커스텀 액션
const val = await getConfig<T>(key);     // "getConfig" 액션
await setConfig(key, value);              // "setConfig" 액션 (params: { key, val })
```

- `mapUnsupportedConfigActionError()`가 미지원 에러를 감지하여 `AnkiConnectError`(`UNSUPPORTED_REMOTE_CONFIG_ACTION`)로 변환
- 에러 감지 패턴: "unsupported action", "unknown action", "action not found", 또는 bare action name

### 주요 인터페이스

```typescript
interface NoteInfo {
  noteId: number;
  profile: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
  modelName: string;
  mod: number;
  cards: number[];
}

interface NoteFields {
  [fieldName: string]: string;  // 모델별 필드 유연하게 대응
}
```

## 타임아웃 및 에러 유형

| 에러 타입 | 상황 | HTTP 코드 | 코드 |
|-----------|------|-----------|------|
| `TimeoutError` | Anki 응답 지연 (기본 5초 초과) | 504 | -- |
| `AnkiConnectError` | 연결 거부, HTTP 에러, API 에러 | 502 | -- |
| `AnkiConnectError` | 커스텀 config 미지원 | 502 | `UNSUPPORTED_REMOTE_CONFIG_ACTION` |

- `AbortSignal.timeout()`으로 구현 (Bun 네이티브 지원)
- 연결 거부 vs 타임아웃 자동 구분
- 배치 작업(임베딩 생성 등)에서는 `{ timeout: 30000 }` 권장

## operations.ts -- 고수준 카드 작업

| 함수 | 용도 |
|------|------|
| `getDeckNotes(deckName)` | 덱의 모든 노트 조회 (findNotes + getNotesInfo) |
| `getNoteById(noteId)` | 특정 노트 조회 |
| `updateMainCard(noteId, newText, backExtra?)` | 메인 카드 업데이트 (nid 유지) |
| `addSplitCards(deckName, cards, originalTags)` | 서브 카드 배치 추가 |
| `applySplitResult(deckName, result, originalTags)` | 분할 결과 적용 (mainCard 업데이트 + 서브 카드 추가) |
| `extractTextField(note)` | NoteInfo에서 Text 필드 추출 |
| `extractTags(note)` | NoteInfo에서 태그 추출 |

## 직접 테스트

```bash
curl -s $ANKI_CONNECT_URL -X POST -d '{
  "action": "deckNames",
  "version": 6
}' | python3 -m json.tool
```
