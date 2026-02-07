# 프롬프트 버전 관리 시스템 상세

## 데이터 구조

### PromptVersion

```typescript
interface PromptVersion {
  id: string;                    // "v1.0.0"
  name: string;                  // "SuperMemo 기반 최적화"
  systemPrompt: string;
  splitPromptTemplate: string;
  examples: FewShotExample[];
  config: PromptConfig;          // 카드 길이/규칙 설정
  status: 'draft' | 'active' | 'archived';
  metrics: PromptMetrics;        // 승인률, 평균 글자 수 등
  modificationPatterns: ModificationPatterns;
}
```

### PromptConfig

```typescript
interface PromptConfig {
  maxClozeChars: number;         // Cloze 최대 80자
  maxBasicFrontChars: number;    // Basic Front 최대 40자
  maxBasicBackChars: number;     // Basic Back 최대 30자
  // 기타 규칙 설정
}
```

### SplitHistoryEntry

```typescript
interface SplitHistoryEntry {
  promptVersionId: string;
  noteId: number;
  originalContent: string;
  splitCards: SplitCard[];
  userAction: 'approved' | 'modified' | 'rejected';
  modificationDetails?: {
    // 글자 수 줄임, 맥락 추가 등
  };
}
```

### Experiment (A/B 테스트)

```typescript
interface Experiment {
  controlVersionId: string;
  treatmentVersionId: string;
  controlResults: { splitCount, approvalRate, avgCharCount };
  treatmentResults: { splitCount, approvalRate, avgCharCount };
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

```typescript
// 버전 CRUD
await listPromptVersions();
await getPromptVersion('v1.0.0');
await createPromptVersion({ name, systemPrompt, ... });
await savePromptVersion(version);
await deletePromptVersion('v1.0.0');

// 활성 버전
await getActiveVersion();
await setActiveVersion('v1.0.0');
await getActivePrompts();  // 현재 활성 버전의 프롬프트

// 히스토리
await addHistoryEntry({ promptVersionId, noteId, ... });
await getHistory(startDate, endDate);
await getHistoryByVersion('v1.0.0');

// 메트릭 자동 업데이트
await updateVersionMetrics('v1.0.0');

// 실패 패턴 분석
const { patterns, insights } = await analyzeFailurePatterns('v1.0.0');
// insights: ["글자 수 초과가 65%: 프롬프트에서 상한선 강조 필요"]

// A/B 테스트
await createExperiment('테스트명', 'v1.0.0', 'v1.1.0');
await listExperiments();
await completeExperiment('exp-id', '결론', 'v1.1.0');
```

## 기본값 상수

- `DEFAULT_PROMPT_CONFIG` — 기본 카드 길이 설정
- `DEFAULT_METRICS` — 초기 메트릭 (0값)
- `DEFAULT_MODIFICATION_PATTERNS` — 초기 패턴 (빈 값)
