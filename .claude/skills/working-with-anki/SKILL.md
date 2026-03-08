---
name: working-with-anki
description: |
  AnkiConnect 연결, 카드/덱/모델 조회, 학습 데이터 복제, 백업/롤백, 어려운 카드 탐지,
  커스텀 config 액션 등 Anki와의 모든 상호작용을 다룬다.
  Triggers: "AnkiConnect 연결", "test 프로필", "ease factor 복제",
  "카드 정보 조회", "학습 데이터", "AnkiConnect API", "Anki 프로필",
  "카드 모델", "어려운 카드", "난이도 탐지", "difficulty",
  "백업", "롤백", "분할 적용", "scheduling", "스케줄링",
  "getConfig", "setConfig", "커스텀 액션".
  Covers AnkiConnect API wrapper, scheduling clone, backup/rollback,
  difficulty detection, and custom config actions.
---

# AnkiConnect 작업

## 안전 규칙 (최우선)

- **반드시 `test` 프로필에서만 작업**: `open -a Anki --args -p test`
- 기본 프로필 접근 **절대 금지** -- 실제 학습 데이터 보호
- `--apply` 없이 항상 미리보기 먼저 확인

## AnkiConnect 기본 정보

- **주소**: `$ANKI_CONNECT_URL` (미설정 시 `http://localhost:8765` 폴백, MiniPC headless Anki는 Tailscale 전용)
- **애드온 코드**: 2055492159
- **대상 모델**: `KaTeX and Markdown Cloze` (필드: Text, Back Extra)
- **API 버전**: 6

## API 래퍼 (packages/core/src/anki/)

| 파일 | 역할 | 주요 export |
|------|------|-------------|
| `client.ts` | AnkiConnect 저수준 래퍼 + 고수준 함수 | `ankiConnect()`, `getVersion()`, `getProfiles()`, `getDeckNames()`, `getModelNames()`, `getModelFieldNames()`, `findNotes()`, `getNotesInfo()`, `updateNoteFields()`, `addNote()`, `addNotes()`, `addTags()`, `removeTags()`, `deleteNotes()`, `sync()`, `getConfig()`, `setConfig()` |
| `operations.ts` | 카드 CRUD, 분할 적용 (nid 승계) | `getDeckNotes()`, `getNoteById()`, `updateMainCard()`, `addSplitCards()`, `applySplitResult()`, `extractTextField()`, `extractTags()` |
| `backup.ts` | 분할 전 백업, 롤백 (날짜별 파일, 원자적 쓰기) | `createBackup()`, `preBackup()`, `updateBackupWithCreatedNotes()`, `rollback()`, `listBackups()`, `getLatestBackupId()` |
| `scheduling.ts` | 학습 데이터 조회/복제 (6개 함수) | `getCardSchedulingInfo()`, `getFullCardInfo()`, `findCardsByNote()`, `setCardScheduling()`, `copySchedulingToNewCards()`, `cloneSchedulingAfterSplit()` |
| `difficulty.ts` | 학습 통계 기반 어려운 카드 탐지 | `computeDifficultyScore()`, `getDifficultyReasons()`, `getDifficultCards()`, `DEFAULT_THRESHOLDS` |

### 주요 API 호출 패턴

```typescript
// 고수준 래퍼 (client.ts) -- ankiConnect() 직접 호출 대신 이것을 사용
const decks = await getDeckNames();
const notes = await findNotes('deck:"덱이름"');
const infos = await getNotesInfo([noteId]);
await addTags([noteId], 'tag1 tag2');
await sync();

// 커스텀 config (miniPC 확장 전용)
const val = await getConfig<string>('some-key');
await setConfig('some-key', { foo: 'bar' });
```

## 학습 데이터 복제 (scheduling.ts)

- **`cloneSchedulingAfterSplit(originalNoteId, newCardIds)`**: 메인 진입점
  - 원본 노트의 카드를 찾아 스케줄링 정보 조회
  - **리뷰 카드(type=2)이고 reps>0인 경우에만** ease factor 복제
  - 새 카드/learning 카드는 복제 건너뜀
- **복제 가능**: ease factor (`setEaseFactors` API)
- **복제 불가**: interval, due -- AnkiConnect API 제한

## 어려운 카드 탐지 (difficulty.ts)

- **`getDifficultCards(deckName, thresholds?)`**: 덱 내 어려운 카드를 난이도순으로 반환
  - 100개 배치로 `getFullCardInfo` 호출, noteId별 중복 제거(최악 성적 카드 유지)
  - `DEFAULT_THRESHOLDS`: minLapses=3, maxEaseFactor=2100, minReps=5
- **`computeDifficultyScore(lapses, easeFactor, interval, reps)`**: 0-100 복합 점수
  - lapses 50% + ease factor 30% + interval 20% 가중치

## 백업/롤백 (backup.ts)

- **저장 위치**: `$ANKI_SPLITTER_BACKUP_DIR` 또는 `output/backups/`
- **파일 형식**: `backup-{YYYY-MM-DD}.json` (날짜별, 하루에 여러 엔트리)
- **버전 포맷**: `BackupFile { version: 1, entries: BackupEntry[] }`
- **저장 내용**: deckName, originalNoteId, 원본 fields/tags/modelName, createdNoteIds
- **원자적 쓰기**: `atomicWriteFileSync()` + `withFileMutex()` (in-process 직렬화)
- **손상 파일 격리**: `quarantineCorruptedBackup()` -- `.corrupt-{timestamp}` 접미사
- **`preBackup(deckName, noteId)`**: 분할 적용 전 원본 상태 미리 저장
- **`rollback(backupId)`**: 생성된 서브 카드 삭제 + 원본 필드/태그 복원 + 스케줄링 경고
  - 태그 완전 복원: 현재 태그 전체 제거 후 백업된 태그 재적용
  - 반환에 `warning: "카드 스케줄링 메타데이터는 자동 복원되지 않습니다."` 포함

## 커스텀 Config 액션 (getConfig/setConfig)

- 공식 AnkiConnect에는 없는 miniPC 커스텀 확장
- `mapUnsupportedConfigActionError()`: 미지원 에러를 감지하여 `UNSUPPORTED_REMOTE_CONFIG_ACTION` 코드로 매핑
- 미지원 패턴: "unsupported action", "unknown action", "action not found", 또는 bare action name

## 연결 확인

```bash
# 직접 테스트
curl -s "${ANKI_CONNECT_URL:-http://localhost:8765}" -X POST -d '{"action":"deckNames","version":6}' | python3 -m json.tool
```

## 자주 발생하는 문제

- **연결 실패**: Anki가 실행 중인지 + AnkiConnect 애드온 활성화 확인
- **프로필 혼동**: 반드시 `open -a Anki --args -p test`로 실행
- **cardsInfo vs notesInfo**: 학습 데이터는 `cardsInfo`에서 조회
- **getConfig/setConfig 실패**: miniPC 커스텀 확장 미설치

## 상세 참조

- `references/ankiconnect-api.md` -- API 래퍼 상세, 모든 고수준 함수
- `references/scheduling.md` -- 학습 데이터 복제 함수별 상세
- `references/backup-system.md` -- 백업 파일 구조, 원자적 쓰기, 격리
- `references/troubleshooting.md` -- 연결 문제, 프로필 안전, 커스텀 config 에러
