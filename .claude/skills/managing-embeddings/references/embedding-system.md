# 임베딩 시스템 상세

## 모델 정보

- **모델**: `gemini-embedding-001` (GA, MTEB 상위권)
- **차원**: 768 (기본값)
- **입력 한도**: 8K 토큰
- **패키지**: `@google/genai`

## 주요 함수 (packages/core/src/embedding/)

### client.ts

```typescript
// 단일 텍스트 임베딩
const embedding = await getEmbedding(text);  // number[] (768차원)

// 배치 임베딩
const embeddings = await getEmbeddings(texts);  // number[][]

// 의미적 유사도 (단축)
const similarity = await getSemanticSimilarity(text1, text2);  // 0-100 (%)
```

### cosine.ts

```typescript
// 코사인 유사도 (0-100)
const sim = cosineSimilarity(vec1, vec2);

// 정규화 + 빠른 계산
const normalized = normalizeVector(vec);
const sim = fastCosineSimilarity(normVec1, normVec2);
```

### cache.ts

```typescript
// 캐시 구조
interface EmbeddingCache {
  [noteId: string]: {
    embedding: number[];
    textHash: string;    // MD5
    timestamp: number;
  }
}

// 저장 위치: output/embeddings/{deckNameHash}.json
// 덱 이름 → MD5 해시로 파일명 생성
```

## 캐시 증분 업데이트 흐름

1. 기존 캐시 로드
2. 각 카드의 텍스트 MD5 해시 계산
3. 해시가 변경된 카드만 새 임베딩 생성
4. 캐시 파일 업데이트

## Jaccard vs 임베딩 성능 비교

| 비교 | Jaccard | 임베딩 |
|------|---------|--------|
| 방식 | 단어 집합 + 2-gram | 의미 벡터 코사인 |
| 속도 | 빠름 (로컬) | 느림 (API 호출) |
| 정확도 | 표면적 유사도 | 의미적 유사도 |
| 기본 threshold | 70% | 85% |
| 캐시 | 없음 | 파일 기반 |
| 같은 주제 카드 | 낮게 나올 수 있음 | 99% |
| 다른 주제 카드 | 정확히 낮음 | 79% |
