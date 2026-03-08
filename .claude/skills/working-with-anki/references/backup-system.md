# 백업 시스템 상세 (backup.ts)

소스: `packages/core/src/anki/backup.ts`

## 파일 구조

### 백업 디렉토리

- **경로**: `$ANKI_SPLITTER_BACKUP_DIR` 또는 `{cwd}/output/backups/`
- `ensureBackupDir()`로 자동 생성

### 날짜별 파일

파일명 패턴: `backup-{YYYY-MM-DD}.json`

하루에 여러 분할이 발생하면 같은 파일에 엔트리가 append된다.

```typescript
interface BackupFile {
  version: 1;
  entries: BackupEntry[];
}

interface BackupEntry {
  id: string;                  // "{originalNoteId}-{Date.now()}"
  timestamp: string;           // ISO 8601
  deckName: string;
  originalNoteId: number;
  originalContent: {
    noteId: number;
    fields: Record<string, { value: string; order: number }>;
    tags: string[];
    modelName: string;
  };
  createdNoteIds: number[];    // 분할로 생성된 서브 카드 ID
}
```

## 원자적 쓰기

`atomicWriteFileSync()` (`packages/core/src/utils/atomic-write.ts`):
1. 임시 파일(`{path}.{pid}.tmp`)에 먼저 쓴다
2. `renameSync()`으로 원자적 교체 (APFS에서 원자적)
3. 실패 시 임시 파일 정리

`withFileMutex()`: in-process 뮤텍스로 같은 파일의 동시 쓰기를 직렬화. 단일 Bun 프로세스이므로 충분.

## 손상 파일 격리 (quarantine)

`quarantineCorruptedBackup(filePath)`:
- 읽기 실패한 백업 파일을 `{path}.corrupt-{timestamp}`로 rename
- rename 실패 시 경고만 출력하고 빈 백업으로 대체
- `isBackupFile()`: `version === 1 && Array.isArray(entries)` 검증

## Pre-Backup 패턴

분할 적용 전에 원본 상태를 미리 저장하는 2단계 패턴:

1. **`preBackup(deckName, noteId)`**: 분할 전에 호출. `createdNoteIds: []`로 엔트리 생성
2. **`updateBackupWithCreatedNotes(backupId, createdNoteIds)`**: 분할 적용 후 호출. 생성된 노트 ID 추가

**왜 2단계?** 분할 적용 중 실패하면 자동 롤백이 필요한데, 그 시점에 이미 백업이 있어야 한다. pre-backup으로 분할 전에 원본을 안전하게 저장해둔다.

## 롤백 상세

`rollback(backupId)`:

1. `findBackupFileContainingEntry()`로 해당 엔트리를 포함하는 파일 탐색 (오늘 파일 우선)
2. 생성된 서브 카드들 삭제 (`deleteNotes`)
3. 원본 노트 필드 복원 (`updateNoteFields`)
4. **태그 완전 복원**: 현재 태그 전체 제거 후 백업된 태그 재적용
5. 백업 엔트리 제거 (롤백 완료 표시)
6. **스케줄링 경고**: `"카드 스케줄링 메타데이터는 자동 복원되지 않습니다."` -- ease factor 등은 복원 불가

반환 구조:
```typescript
{
  success: boolean;
  restoredNoteId?: number;
  deletedNoteIds?: number[];
  restoredFieldNames?: string[];
  restoredTags?: string[];
  warning?: string;  // 스케줄링 복원 불가 경고
  error?: string;
}
```

## 백업 목록/검색

- `listBackups()`: 모든 백업 파일의 엔트리를 최신순 정렬로 반환
- `getLatestBackupId()`: 가장 최근 백업 ID
- `listBackupFiles()`: 절대 경로 목록 (`backup-*.json` 패턴)
- `getBackupFileCandidates()`: 오늘 파일 우선 + 나머지 파일 (탐색 순서 최적화)
