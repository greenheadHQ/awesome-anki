# 프롬프트 버전 관리 시스템 상세

## 데이터 구조

### PromptVersion

```typescript
interface PromptVersion {
  id: string;                    // "v1.0.0" (자동 번호 부여)
  name: string;                  // "SuperMemo 기반 최적화"
  description: string;           // 버전 설명
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601

  // 프롬프트 내용
  systemPrompt: string;
  splitPromptTemplate: string;
  analysisPromptTemplate: string;

  // 예제
  examples: FewShotExample[];

  // 설정
  config: PromptConfig;

  // 상태
  status: 'draft' | 'active' | 'archived';

  // 메트릭
  metrics: PromptMetrics;        // 승인률, 평균 글자 수 등

  // 수정 패턴
  modificationPatterns: ModificationPatterns;

  // A/B 테스트용
  parentVersionId?: string;
  changelog?: string;
}
```

### PromptConfig

`packages/core/src/prompt-version/types.ts`에 정의. 필드 목록과 기본값은 코드에서 직접 확인.
```

### SplitHistoryEntry

```typescript
interface SplitHistoryEntry {
  id: string;                    // 히스토리 ID (자동 생성)
  timestamp: string;             // ISO 8601
  promptVersionId: string;
  noteId: number;
  deckName: string;

  // 입력
  originalContent: string;
  originalCharCount: number;
  originalTags?: string[];

  // 출력
  splitCards: Array<{
    title: string;
    content: string;
    cardType?: 'cloze' | 'basic';
    charCount?: number;
    contextTag?: string;
  }>;

  // 사용자 액션
  userAction: 'approved' | 'modified' | 'rejected';
  rejectionReason?: string;      // RejectionReasonId 또는 자유 텍스트
  modificationDetails?: {
    lengthReduced: boolean;
    contextAdded: boolean;
    clozeChanged: boolean;
    cardsMerged: boolean;
    cardsSplit: boolean;
    hintAdded: boolean;
  };

  // AI 메타데이터
  aiModel?: string;
  splitReason?: string;
  executionTimeMs?: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };

  // 품질 체크
  qualityChecks: {
    allCardsUnder80Chars: boolean;
    allClozeHaveHints: boolean;
    noEnumerations: boolean;
    allContextTagsPresent: boolean;
  } | null;
}
```

### REJECTION_REASONS 상수

```typescript
const REJECTION_REASONS = [
  { id: "too-granular",        label: "분할이 너무 세분화" },
  { id: "context-missing",    label: "맥락 태그 부적절" },
  { id: "char-exceeded",      label: "글자수 초과" },
  { id: "cloze-inappropriate", label: "Cloze 위치/내용 부적절" },
  { id: "quality-low",        label: "전반적 품질 미달" },
  { id: "other",              label: "기타" },
] as const;
```

### ActiveVersionInfo

```typescript
interface ActiveVersionInfo {
  versionId: string;
  activatedAt: string;           // ISO 8601
  activatedBy: string;           // "user" | "system" | "experiment"
}
```

### Experiment (A/B 테스트)

```typescript
interface Experiment {
  id: string;                    // "exp-{timestamp}"
  name: string;
  createdAt: string;             // ISO 8601
  status: 'running' | 'completed' | 'cancelled';
  controlVersionId: string;
  treatmentVersionId: string;
  controlResults: { splitCount: number; approvalRate: number; avgCharCount: number };
  treatmentResults: { splitCount: number; approvalRate: number; avgCharCount: number };
  conclusion?: string;
  winnerVersionId?: string;
}
```

## 저장 구조

```
output/prompts/
├── versions/           # 버전 파일
│   └── v1.0.0.json
├── history/            # 분할 히스토리 (날짜별)
│   └── history-2026-01-04.json
├── experiments/        # A/B 테스트
│   └── exp-{timestamp}.json
└── active-version.json # 현재 활성 버전
```

## 주요 함수 (packages/core/src/prompt-version/storage.ts)

> **참고**: storage.ts 내부 함수명은 `listVersions`, `getVersion`, `saveVersion` 등이며,
> `packages/core/src/index.ts`에서 AnkiConnect `getVersion`과의 충돌을 피하기 위해
> `as listPromptVersions`, `as getPromptVersion`, `as savePromptVersion` 등으로 re-export됩니다.

```typescript
// 버전 CRUD
await listVersions();              // re-export: listPromptVersions
await getVersion('v1.0.0');        // re-export: getPromptVersion
await createVersion({ name, systemPrompt, ... }); // re-export: createPromptVersion
await saveVersion(version);        // re-export: savePromptVersion
await deleteVersion('v1.0.0');     // re-export: deletePromptVersion

// 활성 버전
await getActiveVersion();          // → ActiveVersionInfo | null
await setActiveVersion('v1.0.0');  // 부작용: 기존 active 버전을 archived로 변경
await getActivePrompts();          // 현재 활성 버전의 PromptVersion 반환

// 히스토리
await addHistoryEntry({ promptVersionId, noteId, ... });
await getHistory(startDate, endDate);
await getHistoryByVersion('v1.0.0');

// 메트릭 갱신 (히스토리 본문 저장 없이 메트릭만)
await recordPromptMetricsEvent({ promptVersionId, userAction, splitCards });

// 실패 패턴 분석
const { patterns, insights } = await analyzeFailurePatterns('v1.0.0');
// insights: ["글자 수 초과가 65%: 프롬프트에서 상한선 강조 필요"]

// A/B 테스트
await createExperiment('테스트명', 'v1.0.0', 'v1.1.0');
await getExperiment('exp-id');
await listExperiments();
await completeExperiment('exp-id', '결론', 'v1.1.0');
```

## 버전 자동 번호 부여

`createVersion()`은 기존 버전의 최신 id를 파싱하여 다음 번호를 자동 계산합니다:
- 버전이 없으면 `v1.0.0`부터 시작
- 기존 최신이 `v1.0.2`이면 → `v1.0.3` (patch 증가)
- `id`, `createdAt`, `updatedAt`, `metrics`, `modificationPatterns`는 자동 설정

## setActiveVersion 부작용

`setActiveVersion(versionId)` 호출 시:
1. 기존 활성 버전의 status를 `archived`로 변경하고 저장
2. 새 버전의 status를 `active`로 변경하고 저장
3. `active-version.json`에 `ActiveVersionInfo` 기록

## 원격 SoT (Remote System Prompt)

MiniPC(AnkiConnect)에 시스템 프롬프트를 원격 저장하는 체계:

```typescript
// 키
const SYSTEM_PROMPT_CONFIG_KEY = "awesomeAnki.prompts.system";

// 페이로드
interface RemoteSystemPromptPayload {
  revision: number;
  systemPrompt: string;
  activeVersionId: string;
  migratedFromFileAt?: string;
  updatedAt: string;
}

// 마이그레이션 (파일 SoT → 원격 SoT, 서버 시작 시 1회)
await migrateLegacySystemPromptToRemoteIfNeeded();
// 결과: { migrated: boolean, reason: string, payload? }
```

마이그레이션 로직:
1. 원격에 이미 있으면 → `already-exists` (스킵)
2. 활성 버전이 없으면 → `no-active-version`
3. 활성 버전의 systemPrompt가 비어있으면 → `empty-active-system-prompt`
4. AnkiConnect가 config 액션을 지원하지 않으면 → `remote-config-action-unsupported`
5. 정상 이관 → `migrated` (revision: 0으로 시작)

## 동시성 처리

`packages/core/src/utils/atomic-write.ts` 사용:

- **atomicWriteFile**: 임시 파일에 먼저 쓴 후 `rename`으로 교체 (APFS 원자적)
- **withFileMutex**: in-process 뮤텍스로 같은 파일의 동시 쓰기 직렬화 (단일 Bun 프로세스 가정)
- 히스토리 파일 쓰기(`addHistoryEntry`)에서 `withFileMutex` 사용

## 기본값 상수

- `DEFAULT_PROMPT_CONFIG` — 기본 카드 길이 설정 (12 필드 전부 기본값)
- `DEFAULT_METRICS` — 초기 메트릭 (0값)
- `DEFAULT_MODIFICATION_PATTERNS` — 초기 패턴 (빈 값)
