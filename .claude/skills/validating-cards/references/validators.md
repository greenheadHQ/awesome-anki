# 검증기 4종 상세

## 공통 구조

모든 검증기는 `packages/core/src/validator/`에 위치.
`types.ts`에 검증 결과 타입 정의.

## 1. 팩트 체크 (fact-checker.ts)

- **방식**: LLM 기반 (Gemini/OpenAI, `provider`/`model` 선택 가능)
- **API**: `POST /api/clinic/fact-check`
- **입력**: `{ noteId, thorough?, provider?, model? }`
- **출력**: 사실 여부, 부정확한 부분 지적, 수정 제안
- **결과 타입**: `FactCheckResult` — `details.claims[]`, `details.overallAccuracy`

## 2. 최신성 검사 (freshness-checker.ts)

- **방식**: LLM 기반 (Gemini/OpenAI, `provider`/`model` 선택 가능)
- **API**: `POST /api/clinic/freshness`
- **입력**: `{ noteId, checkDate?, provider?, model? }`
- **출력**: 기술 최신성 여부, 구버전 정보 지적, 업데이트 제안
- **결과 타입**: `FreshnessResult` — `details.outdatedItems[]`

## 3. 유사성 검사 (similarity-checker.ts)

- **방식**: Jaccard (기본) 또는 임베딩 (옵션)
- **API**: `POST /api/clinic/similarity`
- **입력**: `{ noteId, deckName, threshold?, maxResults?, useEmbedding? }`
- **`provider`/`model` 파라미터 없음** — 유사성 검사는 LLM을 사용하지 않음

### Jaccard 모드
- 단어 집합 + 2-gram 비교
- 기본 threshold: 70%
- 중복 판정: 90% 이상
- 로컬 처리 (빠름)

### 임베딩 모드
- OpenAI `text-embedding-3-large` 사용 (3072차원)
- 기본 threshold: 85%
- 중복 판정: 95% 이상
- 의미적 유사도 (더 정확)
- 임베딩 실패 시 Jaccard로 자동 폴백
- `managing-embeddings` 스킬 참조

### 유틸리티 함수

```typescript
// 두 카드의 Jaccard 유사도 직접 계산
const sim = calculateSimilarity(text1, text2);  // 0-100

// 덱 전체 유사 카드 그룹 탐지 (Jaccard 기반)
const groups = await findSimilarGroups(cards, { threshold: 70 });
// Map<number, number[]> — noteId → 유사한 noteId 배열
```

## 4. 문맥 일관성 검사 (context-checker.ts)

- **방식**: LLM 기반 (Gemini/OpenAI, `provider`/`model` 선택 가능)
- **API**: `POST /api/clinic/context`
- **입력**: `{ noteId, includeReverseLinks?, maxRelatedCards?, thorough?, provider?, model? }`
- **특징**:
  - nid 링크로 연결된 카드 그룹 분석
  - 역방향 링크 검색 (다른 카드가 이 카드를 참조)
  - 관련 카드 간 논리적 연결 확인
- **결과 타입**: `ContextResult` — `details.inconsistencies[]`, `details.relatedCards[]`

### analyzeCardGroup

```typescript
// 카드 그룹 전체의 일관성 분석
const result = await analyzeCardGroup(cards, options);
// { overallCoherence: number, inconsistencies: Array<Inconsistency & { sourceNoteId }>,
//   groupStructure: Map<number, number[]> }
```

각 카드에 대해 `checkContext`를 순차 실행하고, severity 가중치로 전체 일관성 점수를 합산한다.

## 전체 검증

- **API**: `POST /api/clinic/all`
- **입력**: `{ noteId, deckName, provider?, model? }`
- 4종 **병렬 실행**으로 속도 최적화
- 유사성 검사는 Jaccard만 사용 (`useEmbedding` 전달 안 함)
- `provider`/`model`은 LLM 기반 검증(팩트 체크, 최신성, 문맥)에만 적용
