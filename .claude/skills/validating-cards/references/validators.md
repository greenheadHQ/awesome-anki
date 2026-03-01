# 검증기 4종 상세

## 공통 구조

모든 검증기는 `packages/core/src/validator/`에 위치.
`types.ts`에 검증 결과 타입 정의.

## 1. 팩트 체크 (fact-checker.ts)

- **방식**: LLM 기반 (Gemini/OpenAI)
- **API**: `POST /api/validate/fact-check`
- **입력**: 카드 텍스트
- **출력**: 사실 여부, 부정확한 부분 지적, 수정 제안

## 2. 최신성 검사 (freshness-checker.ts)

- **방식**: LLM 기반 (Gemini/OpenAI)
- **API**: `POST /api/validate/freshness`
- **입력**: 카드 텍스트
- **출력**: 기술 최신성 여부, 구버전 정보 지적, 업데이트 제안

## 3. 유사성 검사 (similarity-checker.ts)

- **방식**: Jaccard (기본) 또는 임베딩 (옵션)
- **API**: `POST /api/validate/similarity`
- **옵션**: `useEmbedding: boolean` (기본 false)

### Jaccard 모드
- 단어 집합 + 2-gram 비교
- 기본 threshold: 70%
- 로컬 처리 (빠름)

### 임베딩 모드
- Gemini gemini-embedding-001 사용
- 기본 threshold: 85%
- 의미적 유사도 (더 정확)
- `managing-embeddings` 스킬 참조

## 4. 문맥 일관성 검사 (context-checker.ts)

- **방식**: LLM 기반 (Gemini/OpenAI)
- **API**: `POST /api/validate/context`
- **특징**:
  - nid 링크로 연결된 카드 그룹 분석
  - 역방향 링크 검색 (다른 카드가 이 카드를 참조)
  - 관련 카드 간 논리적 연결 확인

## 전체 검증

- **API**: `POST /api/validate/all`
- 4종 **병렬 실행**으로 속도 최적화
