---
name: managing-prompts
description: |
  This skill should be used when the user asks about "프롬프트 버전 관리",
  "A/B 테스트 만들어", "SuperMemo 규칙", "Cloze Enhancer", "프롬프트 성능",
  "카드 길이 기준", "이진 패턴", "실패 패턴 분석".
  Covers prompt version management, A/B testing, Cloze Enhancer, and SuperMemo rules.
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

- **PromptVersion**: id, name, systemPrompt, splitPromptTemplate, config, status, metrics
- **SplitHistoryEntry**: promptVersionId, noteId, splitCards, userAction
- **Experiment**: controlVersionId, treatmentVersionId, results, conclusion

## 카드 길이 기준 (SuperMemo 기반)

| 타입 | 구성 | 기준 | 최대 |
|------|------|------|------|
| Cloze | 전체 | 40~60자 | 80자 |
| Basic | Front (Q:) | 20~30자 | 40자 |
| Basic | Back (A:) | ~20자 | 30자 |

## 필수 원칙 6가지

1. **Minimum Information**: 카드당 한 가지 사실만
2. **One Answer Only**: 하나의 답만 허용
3. **No Yes/No**: 힌트 필수 (`{{c1::값::옵션1 | 옵션2}}`)
4. **Context-Free**: 중첩 맥락 태그 필수 (`[DNS > Record > A]`)
5. **No Enumerations**: 개별 카드로 분리
6. **No Example Trap**: 역방향 질문 금지 ("X의 예시?" ❌)

## Cloze Enhancer (gemini/cloze-enhancer.ts)

이진 패턴 자동 감지 (25개)로 Yes/No Cloze에 힌트 자동 추가.

| 카테고리 | 예시 | 힌트 |
|----------|------|------|
| 존재/상태 | 있다/없다 | `있다 \| 없다` |
| 방향성 | 증가/감소 | `증가 ↑ \| 감소 ↓` |
| 동기화 | 동기/비동기 | `Sync \| Async` |
| 상태 | 상태/무상태 | `Stateful \| Stateless` |
| 계층 | 물리/논리 | `Physical \| Logical` |

주요 함수: `analyzeClozes()`, `checkCardQuality()`, `detectBinaryPattern()`

## Self-Correction 루프

1. 생성 후 글자 수 검토
2. 상한선 초과 시 재작성
3. 그래도 초과 시 추가 분할

## 주요 API

```typescript
// 버전 관리
await listPromptVersions();
await getPromptVersion('v1.0.0');
await createPromptVersion({ name, systemPrompt, ... });
await setActiveVersion('v1.0.0');

// 히스토리
await addHistoryEntry({ promptVersionId, noteId, ... });

// 실패 패턴 분석
const { patterns, insights } = await analyzeFailurePatterns('v1.0.0');

// A/B 테스트
await createExperiment('테스트명', 'v1.0.0', 'v1.1.0');
```

## 자주 발생하는 문제

- **export 이름 충돌**: `getVersion` → `getPromptVersion`으로 접두사 사용
- **SplitWorkspace 버전 선택**: 헤더 드롭다운에서 활성 버전 ✓ 표시
- **히스토리 자동 기록**: 분할 적용 시 `/api/prompts/history`로 자동 전송

## 상세 참조

- `references/version-system.md` — PromptVersion 타입, 저장 구조 상세
- `references/supermemo-rules.md` — 20 Rules, 카드 길이 기준
- `references/cloze-enhancer.md` — 이진 패턴 25개, 품질 검사
- `references/troubleshooting.md` — Phase 1 프롬프트 개선 결정사항
