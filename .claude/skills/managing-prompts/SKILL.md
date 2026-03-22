---
name: managing-prompts
description: |
  프롬프트 버전 관리, A/B 테스트, 이진 패턴 힌트, 품질 추적 등 프롬프트 시스템 전반을 다루는 스킬.
  프롬프트 관련 질문이면 무조건 이 스킬을 먼저 확인할 것.
  Triggers: "프롬프트 버전 관리", "A/B 테스트 만들어", "SuperMemo 규칙",
  "Cloze Enhancer", "프롬프트 성능", "카드 길이 기준", "이진 패턴",
  "실패 패턴 분석", "시스템 프롬프트", "system prompt",
  "프롬프트 마이그레이션", "히스토리", "반려 사유", "활성 버전", "메트릭".
---

# 프롬프트 관리

## 프롬프트 버전 관리 개요

프롬프트 버전 관리, A/B 테스트, 품질 추적 시스템. SuperMemo's Twenty Rules 기반 카드 분할 품질 보장.

## 저장 구조

```
output/prompts/
├── versions/           # 버전 파일 (v1.0.0.json 등)
├── history/            # 분할 히스토리 (날짜별)
├── experiments/        # A/B 테스트
└── active-version.json # 현재 활성 버전
```

## 핵심 데이터 구조

- **PromptVersion**: id, name, description, createdAt, updatedAt, systemPrompt, splitPromptTemplate, analysisPromptTemplate, examples, config, status, metrics, modificationPatterns, parentVersionId?, changelog?
- **SplitHistoryEntry**: id, timestamp, promptVersionId, noteId, deckName, originalContent, originalCharCount, originalTags?, splitCards, userAction, rejectionReason?, modificationDetails?, aiModel?, splitReason?, executionTimeMs?, tokenUsage?, qualityChecks
- **Experiment**: id, name, createdAt, status, controlVersionId, treatmentVersionId, controlResults, treatmentResults, conclusion?, winnerVersionId?
- **ActiveVersionInfo**: versionId, activatedAt, activatedBy
- **REJECTION_REASONS**: 6개 상수 (too-granular, context-missing, char-exceeded, cloze-inappropriate, quality-low, other)

## 카드 길이 기준 / 필수 원칙

코드에서 직접 확인:
- **길이 기준**: `packages/core/src/prompt-version/types.ts` → `DEFAULT_PROMPT_CONFIG`
- **필수 원칙**: `packages/core/src/gemini/prompts.ts` → `SYSTEM_PROMPT`
- **이진 패턴**: `packages/core/src/gemini/cloze-enhancer.ts` → `BINARY_PATTERNS`

## LLM 경로 구분

> **Note**: Split 프롬프트는 `packages/core/src/llm/factory.ts`를 통해 멀티 LLM(Gemini/OpenAI) 지원. Cloze Enhancer는 `packages/core/src/gemini/cloze-enhancer.ts`에 위치하며, LLM API 호출 없이 순수 로컬 패턴 매칭 로직으로 동작합니다 (LLM 추상화 계층 미사용). `gemini/` 디렉토리에 있는 것은 역사적 이유(초기 Gemini 전용 시절의 잔재)이며, 실제로는 LLM 독립적인 유틸리티입니다.

## Cloze Enhancer (gemini/cloze-enhancer.ts)

이진 패턴 자동 감지 (26개)로 Yes/No Cloze에 힌트 자동 추가.

| 카테고리 | 예시 | 힌트 |
|----------|------|------|
| 존재/상태 | 있다/없다 | `있다 \| 없다` |
| 방향성 | 증가/감소 | `증가 ↑ \| 감소 ↓` |
| 동기화 | 동기/비동기 | `Sync \| Async` |
| 상태 | 상태/무상태 | `Stateful \| Stateless` |
| 계층 | 물리/논리 | `Physical \| Logical` |

주요 함수: `analyzeClozes()`, `checkCardQuality()`, `detectBinaryPattern()`, `enhanceCardsWithHints()`, `countCardChars()`, `detectCardType()`

## Self-Correction 루프

1. 생성 후 글자 수 검토
2. 상한선 초과 시 재작성
3. 그래도 초과 시 추가 분할

## 주요 API

```typescript
// 버전 관리
await listPromptVersions();          // storage.ts: listVersions()
await getPromptVersion('v1.0.0');    // storage.ts: getVersion()
await createPromptVersion({ name, systemPrompt, ... }); // storage.ts: createVersion()
await savePromptVersion(version);    // storage.ts: saveVersion()
await deletePromptVersion('v1.0.0'); // storage.ts: deleteVersion()
await setActiveVersion('v1.0.0');

// 히스토리 & 메트릭
await addHistoryEntry({ promptVersionId, noteId, ... });
await recordPromptMetricsEvent({ promptVersionId, userAction, splitCards });

// 실패 패턴 분석
const { patterns, insights } = await analyzeFailurePatterns('v1.0.0');

// A/B 테스트
await createExperiment('테스트명', 'v1.0.0', 'v1.1.0');
await getExperiment('exp-id');
```

> **export 이름 규칙**: `storage.ts` 내부 함수명(`listVersions`, `getVersion`, `saveVersion` 등)은 `packages/core/src/index.ts`에서 AnkiConnect `getVersion`과의 충돌을 피하기 위해 `as` 별칭으로 re-export됩니다 (`listPromptVersions`, `getPromptVersion`, `savePromptVersion` 등). 함수 자체가 이름이 다른 게 아니라, re-export 별칭입니다.

## 자주 발생하는 문제

- **export 이름 충돌**: `storage.ts`의 `getVersion` 등은 `index.ts`에서 `as getPromptVersion`으로 re-export (별칭, 함수명 자체 변경 아님)
- **SplitWorkspace 버전 선택**: 헤더 드롭다운에서 활성 버전 ✓ 표시
- **히스토리 자동 기록**: 분할 적용 시 `/api/prompts/history`로 자동 전송

## 상세 참조

- `references/version-system.md` — PromptVersion 타입, 저장 구조 상세
- `references/supermemo-rules.md` — 20 Rules, 카드 길이 기준
- `references/cloze-enhancer.md` — 이진 패턴 26개, 품질 검사
- `references/troubleshooting.md` — Phase 1 프롬프트 개선 결정사항
