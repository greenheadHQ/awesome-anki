---
name: managing-embeddings
description: |
  This skill should be used when the user asks about "임베딩 생성",
  "코사인 유사도", "캐시 어디에", "임베딩 상태", "의미 유사도",
  "embedding-001", "벡터 차원".
  Covers Gemini embedding API, file-based cache strategy, and text preprocessing.
---

# 임베딩 관리

## 기술 스택

- **모델**: `gemini-embedding-001` (GA, MTEB 상위권)
- **차원**: 768 (기본값)
- **입력 한도**: 8K 토큰
- **taskType**: `SEMANTIC_SIMILARITY` (문자열로 직접 지정)

## 모듈 구조 (packages/core/src/embedding/)

| 파일 | 역할 |
|------|------|
| `client.ts` | Gemini 임베딩 API 클라이언트 |
| `cosine.ts` | 코사인 유사도 계산 (0-100%) |
| `cache.ts` | 파일 기반 증분 캐시 |

## 주요 함수

```typescript
// 단일 텍스트 임베딩
const embedding = await getEmbedding(text);  // number[] (768차원)

// 의미적 유사도
const similarity = await getSemanticSimilarity(text1, text2);  // 0-100 (%)

// 유사성 검사 (임베딩 모드)
const result = await checkSimilarity(targetCard, allCards, {
  useEmbedding: true, deckName: '덱명', threshold: 85
});
```

## 텍스트 전처리

임베딩 생성 전 반드시 정리:
1. Cloze 구문에서 내용만 추출 (`{{c1::DNS}}` → `DNS`)
2. HTML 태그 제거
3. 컨테이너 구문 제거 (`::: tip` 등)
4. nid 링크에서 제목만 추출

## 캐시 전략

- **저장 위치**: `output/embeddings/{deckNameHash}.json`
- **구조**: `{ [noteId]: { embedding, textHash, timestamp } }`
- **증분 업데이트**: MD5 해시로 텍스트 변경 감지, 변경된 카드만 재생성
- **캐시 확인**: `GET /api/embedding/status/:deckName`
- **캐시 삭제**: `DELETE /api/embedding/cache/:deckName`

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | /api/embedding/generate | 덱 전체 임베딩 생성 (증분) |
| GET | /api/embedding/status/:deckName | 캐시 상태 확인 |
| DELETE | /api/embedding/cache/:deckName | 캐시 삭제 |
| POST | /api/embedding/single | 단일 텍스트 임베딩 (디버깅) |

## 자주 발생하는 문제

- **TaskType 미지원**: `@google/genai`에서 `TaskType` enum이 export 안 됨 → 문자열 `'SEMANTIC_SIMILARITY'`로 직접 지정
- **캐시 위치 혼동**: 덱 이름을 MD5 해시로 변환하여 파일명 생성

## 상세 참조

- `references/embedding-system.md` — gemini-embedding-001, 캐시 전략 상세
- `references/preprocessing.md` — Cloze/HTML/컨테이너 제거 로직
- `references/troubleshooting.md` — TaskType 미지원, 캐시 위치
