---
name: splitting-cards
description: |
  카드 분할 로직, LLM 기반 Split, nid 승계 전략, 텍스트 파서,
  비용 추정, 배치 분할 등 카드 분할의 모든 측면을 다룬다.
  Triggers: "Split 결과가 이상해", "파서 버그",
  "분할 미리보기", "nid 승계", "Cloze 번호 리셋", "컨테이너 파서",
  "카드 분할", "atomic card", "분할 비용", "split cost",
  "배치 분할", "batch split", "분할 적용", "split apply",
  "분할 검증", "스타일 보존".
  Covers Split logic, nid inheritance strategy, text parsers,
  cost estimation, batch split, and split validation.
---

# 카드 분할

## 분할 전략 개요

멀티 LLM(Gemini/OpenAI) 기반 단일 분할 모드. Cloze가 3개 초과인 정보 밀도 높은 카드를 원자적 단위로 분할.

| 조건 | 방식 | 비용 |
|------|------|------|
| Cloze > 3개 | LLM API (Gemini or OpenAI) | API 호출 |

## Split

- 선택된 LLM 모델에 분할 제안 요청 (기본: gemini-3-flash-preview)
- 현재 **5개 후보만 분석** (API 비용 고려)
- "분석 요청" 버튼 클릭 시에만 API 호출 (자동 호출 방지 -- 비용 발생 사전 고지)
- 프롬프트 버전 선택 가능 -- `managing-prompts` 스킬 참조
- 모델 선택: 클라이언트에서 `provider`/`model` 파라미터로 지정 가능, 미지정 시 서버 기본값 사용

### 비용 추정 (`estimateSplitCost()`)

분할 전 예상 비용 계산:
- 입력 토큰: `countTokens(systemPrompt + userPrompt)` 로 실제 프롬프트 기반 계산
- 출력 토큰: `입력 * ESTIMATED_OUTPUT_INPUT_RATIO(0.7)`, 상한 `SPLIT_MAX_OUTPUT_TOKENS(8192)`
- worst-case: 출력이 maxOutputTokens까지 나오는 경우의 비용 (예산 검사용)
- `checkBudget()`: 서버 예산 상한 + 클라이언트 예산을 비교

### 배치 분할 (`requestBatchCardSplit()`)

다수 카드를 한번에 분할:
- `BATCH_SIZE = 10`: 배치당 10개 카드 병렬 처리 (`Promise.allSettled`)
- `DELAY_MS = 1000`: 배치 간 1초 딜레이 (rate limit 대응)
- `onProgress` 콜백으로 진행 상황 보고
- 개별 카드 실패 시 건너뛰고 나머지 계속 처리

### 프롬프트 빌더 (`packages/core/src/gemini/prompts.ts`)

| 함수 | 용도 |
|------|------|
| `buildSplitPrompt(noteId, text)` | 기본 분할 프롬프트 생성 |
| `buildSplitPromptFromTemplate(template, noteId, text, tags)` | 버전별 템플릿 변수 치환 (`{{noteId}}`, `{{text}}`, `{{tags}}`) |
| `buildAnalysisPrompt(noteId, text)` | 분할 필요성 분석 전용 프롬프트 |

## nid 승계 전략

- **메인 카드** (`mainCardIndex`): `updateNoteFields`로 기존 nid 유지
- **서브 카드**: `addSplitCards()`로 새 nid 생성 + 원본으로의 역링크 삽입 (`addNotes`는 내부 구현)
- 기존 nid 링크가 깨지지 않도록 보장

## Cloze 번호 처리

- **결정**: 분할 후 모든 카드는 `{{c1::}}`로 리셋
- **이유**: 1 Note = 1 Atomic Card 원칙

## 파서 모듈 (packages/core/src/parser/)

| 파서 | 역할 | 패턴 |
|------|------|------|
| container-parser | `::: type [title]` 구문 | 상태 머신 (스택 기반 depth 추적) |
| nid-parser | `[제목\|nid{13자리}]` 링크 | `NID_LINK_REGEX` |
| cloze-parser | `{{c숫자::내용::힌트?}}` | `CLOZE_REGEX` |

### 설계 결정: 컨테이너 파서

- 정규식만으로는 중첩 `::: toggle` 처리 불가 -- **상태 머신 채택**
- 스택 기반으로 depth 추적, 중첩된 컨테이너 정확히 파싱

## 유틸리티

| 파일 | 역할 |
|------|------|
| `packages/core/src/utils/formatters.ts` | 스타일 보존 검증 (`validateStylePreservation`), HTML 엔티티, 카드 제목 정규화, 이미지 경로 추출 |
| `packages/core/src/gemini/validator.ts` | zod 스키마 검증 (`validateSplitResponse`), Cloze 존재 검증, 스타일 보존 검증 |

## 분할 제외 규칙

- `::: toggle todo` 블록은 분할 대상에서 **제외** (미완성 상태)
- purple 플래그 카드도 주의 필요

## 스타일 보존

반드시 보존해야 하는 HTML 태그:
- `<span style="color:...">`, `<font color>`, `<b>`, `<u>`, `<sup>`
- `formatters.ts`의 `validateStylePreservation()`: 원본과 결과의 스타일 비교
- `validator.ts`의 `validateStylePreservation()`: 원본과 결과의 HTML 태그 수 비교

## 자주 발생하는 문제

- **분할 후보 수 불일치**: 대시보드와 SplitWorkspace 간 필터링 로직 확인

## 상세 참조

- `references/split.md` -- LLM 기반 Split 상세, 비용/예산 가드, 배치 분할
- `references/nid-inheritance.md` -- mainCardIndex 전략, 역링크 형식
- `references/parsers.md` -- container/nid/cloze 파서 타입 정의
- `references/troubleshooting.md` -- 파서 설계 시행착오
