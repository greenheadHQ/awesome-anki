# 임베딩 트러블슈팅

## Gemini SDK TaskType 미지원

- **문제**: `@google/genai` 패키지에서 `TaskType` enum이 export되지 않음
  ```typescript
  import { GoogleGenAI, TaskType } from '@google/genai';
  // error TS2305: Module has no exported member 'TaskType'.
  ```
- **해결**: 문자열로 직접 지정
  ```typescript
  config: {
    taskType: 'SEMANTIC_SIMILARITY',  // 문자열로 직접
    outputDimensionality: 768,
  }
  ```
- **사용 가능한 taskType**:
  - `RETRIEVAL_QUERY` — 검색 쿼리
  - `RETRIEVAL_DOCUMENT` — 검색 문서
  - `SEMANTIC_SIMILARITY` — 의미적 유사도 (권장)
  - `CLASSIFICATION` — 분류
  - `CLUSTERING` — 클러스터링

## 임베딩 캐시 위치 혼동

- 캐시 파일: `output/embeddings/{deckNameHash}.json`
- 덱 이름을 **MD5 해시**로 변환하여 파일명 생성
- 직접 확인:
  ```bash
  curl -s "http://localhost:3000/api/embedding/status/덱이름" | python3 -m json.tool
  ```
- 캐시 삭제:
  ```bash
  curl -X DELETE "http://localhost:3000/api/embedding/cache/덱이름"
  ```
