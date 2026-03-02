---
name: managing-embeddings
description: |
  This skill should be used when users request embedding generation or analysis.
  Triggers: "임베딩 생성", "코사인 유사도", "캐시 어디에",
  "임베딩 상태", "의미 유사도", "text-embedding-3-large",
  "벡터 차원".
  Covers OpenAI embedding API, file-based cache strategy, and text preprocessing.
---

# 임베딩 관리

## 기술 스택

- **모델**: `text-embedding-3-large` (OpenAI)
- **차원**: 3072 (기본값)
- **입력 한도**: 8K 토큰

## LLM 추상화 미사용

> **Note**: 임베딩은 `packages/core/src/llm/` 추상화 계층을 사용하지 않고, `packages/core/src/embedding/client.ts`에서 `openai` SDK를 직접 호출합니다. OpenAI 기반 임베딩 전용 모듈입니다.

## 모듈 구조 (packages/core/src/embedding/)

| 파일 | 역할 |
|------|------|
| `client.ts` | OpenAI 임베딩 API 클라이언트 |
| `cosine.ts` | 코사인 유사도 계산 (0-100%) |
| `cache.ts` | 파일 기반 증분 캐시 |

## 주요 함수

```typescript
// 단일 텍스트 임베딩
const embedding = await getEmbedding(text);  // number[] (3072차원)

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

- **캐시 위치 혼동**: 덱 이름을 MD5 해시로 변환하여 파일명 생성
- **캐시 호환성**: 레거시 Gemini 캐시는 자동 감지 후 재생성 필요

## 상세 참조

- `references/embedding-system.md` — text-embedding-3-large, 캐시 전략 상세
- `references/preprocessing.md` — Cloze/HTML/컨테이너 제거 로직
- `references/troubleshooting.md` — OpenAI API 키, 캐시 호환성
