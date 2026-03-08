# 임베딩 시스템 상세

## 모델 정보

- **모델**: `text-embedding-3-large` (OpenAI)
- **차원**: 3072 (기본값, `dimensions` 옵션으로 축소 가능)
- **입력 한도**: 8K 토큰
- **패키지**: `openai`
- **API 키**: `OPENAI_API_KEY` 환경변수 필수

## 레거시 정보 (마이그레이션 감지용)

```typescript
export const LEGACY_EMBEDDING_PROVIDER = "gemini";
export const LEGACY_EMBEDDING_MODEL = "gemini-embedding-001";
// 레거시 차원: 768
```

기존 Gemini 캐시가 남아 있으면 provider/model 불일치로 감지되어 자동 재생성된다.

## 주요 함수 (packages/core/src/embedding/)

### client.ts

```typescript
// 단일 텍스트 임베딩
const embedding = await getEmbedding(text, options?);  // number[] (3072차원)

// 배치 임베딩 (BATCH_SIZE=100, 빈 텍스트 자동 필터링)
const embeddings = await getEmbeddings(texts, options?, onProgress?);  // number[][]

// 의미적 유사도 (단축)
const similarity = await getSemanticSimilarity(text1, text2, options?);  // 0-100 (%)

// 텍스트 전처리 (Cloze/HTML/컨테이너 제거)
const cleaned = preprocessTextForEmbedding(text);
```

`EmbeddingOptions`는 `{ dimensions?: number }` — text-embedding-3 계열에서 차원 축소를 지원한다.

### cosine.ts

```typescript
// 코사인 유사도 (0-100, -1~1을 0~100으로 변환)
const sim = cosineSimilarity(vec1, vec2);

// 정규화 + 빠른 계산 (L2 정규화된 벡터 전용)
const normalized = normalizeVector(vec);
const sim = fastCosineSimilarity(normVec1, normVec2);
```

### cache.ts

```typescript
// 캐시 구조 (스키마 v1)
interface EmbeddingCache {
  schemaVersion: number;     // EMBEDDING_CACHE_SCHEMA_VERSION = 1
  deckName: string;
  provider: string;          // "openai"
  model: string;             // "text-embedding-3-large"
  dimension: number;         // 3072
  lastUpdated: number;
  embeddings: Record<string, CachedEmbedding>;
}

interface CachedEmbedding {
  embedding: number[];
  textHash: string;    // MD5
  timestamp: number;
}

// 저장 위치: EMBEDDING_CACHE_DIR || "output/embeddings/" → {deckNameHash}.json
// 덱 이름 → MD5 해시 앞 12자로 파일명 생성
```

### 캐시 호환성 검사

캐시 로드 시 provider/model/schemaVersion이 현재 설정과 맞는지 확인한다.

```typescript
// 불일치 사유 반환 (null이면 호환)
const reason = getCacheIncompatibilityReason(cache);
// → "schema_version_mismatch" | "provider_mismatch" | "model_mismatch" | null

// boolean 편의 함수
const ok = isCacheCompatible(cache);
```

불일치 감지 시 기존 캐시를 버리고 새 캐시를 생성한다. 서버 라우트(`/api/embedding/generate`)와 유사성 검사기(`similarity-checker.ts`) 모두 이 패턴을 사용한다.

## 캐시 증분 업데이트 흐름

1. 기존 캐시 로드 (`loadCache`)
2. 호환성 검사 (`getCacheIncompatibilityReason`) — 불일치 시 새 캐시 생성
3. 각 카드의 텍스트 MD5 해시 계산 (`getTextHash`)
4. 해시가 변경된 카드만 새 임베딩 생성 (`getCachedEmbedding` → miss → `getEmbedding`)
5. 삭제된 노트 정리 (`cleanupCache`)
6. 캐시 파일 저장 (`saveCache`, atomic write)

## Jaccard vs 임베딩 성능 비교

| 비교 | Jaccard | 임베딩 |
|------|---------|--------|
| 방식 | 단어 집합 + 2-gram | OpenAI 의미 벡터 코사인 |
| 속도 | 빠름 (로컬) | 느림 (API 호출) |
| 정확도 | 표면적 유사도 | 의미적 유사도 |
| 기본 threshold | 70% | 85% |
| 캐시 | 없음 | 파일 기반 |
| 같은 주제 카드 | 낮게 나올 수 있음 | 99% |
| 다른 주제 카드 | 정확히 낮음 | 79% |
| 중복 판정 | 90% 이상 | 95% 이상 |
