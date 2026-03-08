---
name: managing-embeddings
description: |
  USE THIS SKILL for anything related to embeddings, vector similarity, or semantic search.
  Triggers: "임베딩 생성", "코사인 유사도", "캐시 어디에",
  "임베딩 상태", "의미 유사도", "text-embedding-3-large",
  "openai embedding", "벡터 차원", "3072", "임베딩 캐시",
  "embedding 마이그레이션", "레거시 캐시", "embedding fallback",
  "유사도 검사 임베딩 모드", "임베딩 배치", "rate limit 429".
  Covers OpenAI embedding API, file-based cache with migration, and text preprocessing.
---

# 임베딩 관리

## 기술 스택

- **모델**: `text-embedding-3-large` (OpenAI)
- **차원**: 3072 (기본값, `dimensions` 옵션으로 축소 가능)
- **입력 한도**: 8K 토큰
- **패키지**: `openai`
- **API 키**: `OPENAI_API_KEY` 환경변수 필수

## LLM 추상화 미사용

> 임베딩은 `packages/core/src/llm/` 추상화 계층을 사용하지 않고, `packages/core/src/embedding/client.ts`에서 `openai` 패키지를 직접 호출한다. 따라서 임베딩은 OpenAI 전용이며, LLM 프로바이더 설정(`ANKI_SPLITTER_DEFAULT_LLM_PROVIDER`)과 독립적으로 동작한다.

## 모듈 구조 (packages/core/src/embedding/)

| 파일 | 역할 |
|------|------|
| `client.ts` | OpenAI 임베딩 API 클라이언트 (`text-embedding-3-large`) |
| `cosine.ts` | 코사인 유사도 계산 (0-100%) |
| `cache.ts` | 파일 기반 증분 캐시 (호환성 검사, 레거시 마이그레이션 포함) |
| `index.ts` | 모듈 re-export |

## 주요 상수

```typescript
export const EMBEDDING_PROVIDER = "openai";
export const EMBEDDING_MODEL = "text-embedding-3-large";
export const EMBEDDING_EXPECTED_DIMENSION = 3072;

// 레거시 (Gemini → OpenAI 마이그레이션 감지용)
export const LEGACY_EMBEDDING_PROVIDER = "gemini";
export const LEGACY_EMBEDDING_MODEL = "gemini-embedding-001";
```

## 주요 함수

```typescript
// 단일 텍스트 임베딩
const embedding = await getEmbedding(text, options?);  // number[] (3072차원)

// 의미적 유사도
const similarity = await getSemanticSimilarity(text1, text2, options?);  // 0-100 (%)

// 배치 임베딩 (BATCH_SIZE=100, rate limit 딜레이 자동 적용)
const embeddings = await getEmbeddings(texts, options?, onProgress?);  // number[][]

// 유사성 검사 (임베딩 모드)
const result = await checkSimilarity(targetCard, allCards, {
  useEmbedding: true, deckName: '덱명', threshold: 85
});
```

`EmbeddingOptions`는 `dimensions?: number` 필드 하나만 가진다. 지정하면 모델이 차원 축소된 벡터를 반환한다.

## 배치 처리 및 재시도

- **BATCH_SIZE**: 100건씩 OpenAI API 호출
- **배치 간 딜레이**: 350ms (`EMBEDDING_BATCH_DELAY_MS`)
- **재시도**: 최대 2회 (`EMBEDDING_MAX_ATTEMPTS`), 재시도 간 350ms 대기
- **재시도 대상**: 408, 429, 500, 502, 503, 504 상태코드 및 네트워크 오류

## 텍스트 전처리

`preprocessTextForEmbedding()` — 임베딩 생성 전 반드시 적용 (자동):
1. Cloze 구문에서 내용만 추출 (`{{c1::DNS}}` → `DNS`)
2. HTML 태그 제거
3. 컨테이너 구문 제거 (`::: tip` 등)
4. nid 링크에서 제목만 추출

## 캐시 전략

- **저장 위치**: `EMBEDDING_CACHE_DIR` 환경변수 또는 `output/embeddings/` (기본)
- **파일명**: `{deckNameHash}.json` (MD5 앞 12자)
- **캐시 구조**:
  ```typescript
  interface EmbeddingCache {
    schemaVersion: number;  // EMBEDDING_CACHE_SCHEMA_VERSION = 1
    deckName: string;
    provider: string;       // "openai"
    model: string;          // "text-embedding-3-large"
    dimension: number;      // 3072
    lastUpdated: number;
    embeddings: Record<string, CachedEmbedding>;
  }
  ```
- **증분 업데이트**: MD5 해시로 텍스트 변경 감지, 변경된 카드만 재생성
- **호환성 검사**: `getCacheIncompatibilityReason(cache)` — schema/provider/model 불일치 감지
  - 불일치 시 자동으로 캐시 재생성 (레거시 Gemini 캐시 → OpenAI 캐시 마이그레이션)
- **캐시 확인**: `GET /api/embedding/status/:deckName`
- **캐시 삭제**: `DELETE /api/embedding/cache/:deckName`

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | /api/embedding/generate | 덱 전체 임베딩 생성 (증분, 마이그레이션 자동) |
| GET | /api/embedding/status/:deckName | 캐시 상태 + 호환성 확인 |
| DELETE | /api/embedding/cache/:deckName | 캐시 삭제 |
| POST | /api/embedding/single | 단일 텍스트 임베딩 (디버깅) |

## 자주 발생하는 문제

- **OPENAI_API_KEY 미설정**: `OPENAI_API_KEY가 설정되지 않았습니다` 에러 → `.env`에 키 추가
- **Rate Limit 429**: 배치 처리 시 자동 딜레이 적용, 서버 라우트에서도 10건마다 400ms 대기
- **캐시 마이그레이션**: Gemini에서 OpenAI로 변경 후 첫 실행 시 자동 감지 및 재생성
- **차원 불일치**: 레거시 캐시는 768차원 (Gemini), 현재는 3072차원 (OpenAI) — 호환성 검사가 자동 처리
- **캐시 위치 혼동**: 덱 이름을 MD5 해시로 변환하여 파일명 생성

## 상세 참조

- `references/embedding-system.md` — OpenAI text-embedding-3-large, 캐시 호환성/마이그레이션 상세
- `references/preprocessing.md` — Cloze/HTML/컨테이너 제거 로직
- `references/troubleshooting.md` — OPENAI_API_KEY, rate limit, 캐시 마이그레이션
