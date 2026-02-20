---
name: splitting-cards
description: |
  This skill should be used when users request card splitting behavior changes.
  Triggers: "Hard Split이 뭐야", "Soft Split 결과가 이상해", "파서 버그",
  "분할 미리보기", "nid 승계", "Cloze 번호 리셋", "컨테이너 파서",
  "카드 분할", "atomic card".
  Covers Hard/Soft Split logic, nid inheritance strategy, and text parsers.
---

# 카드 분할

## 분할 전략 개요

| 전략 | 트리거 | 방식 | 비용 |
|------|--------|------|------|
| Hard Split | `####` 헤더 2개 이상 | 정규식 | 없음 |
| Soft Split | Cloze > 3개, 구분자 없음 | Gemini API | API 호출 |

Hard Split과 Soft Split은 **상호 배타적** — Hard 가능하면 Soft는 false.

## Hard Split

- **기준**: `####` 헤더가 **2개 이상** 있을 때만 분할 가능
- **`---` 구분선은 제외**: 사용자가 분할 용도로 사용하지 않음 (설계 결정)
- 정규식 기반으로 빠르고 정확
- 카드 선택 시 자동 미리보기 (비용 없음)

```typescript
const headerCount = hardSplitPoints.filter((p) => p.type === 'header').length;
canHardSplit = headerCount >= 2;
```

## Soft Split

- Gemini 3 Flash Preview에게 분할 제안 요청
- 현재 **5개 후보만 분석** (API 비용 고려)
- "Gemini 분석 요청" 버튼 클릭 시에만 API 호출 (자동 호출 방지 — 비용 발생 사전 고지)
- 프롬프트 버전 선택 가능 — `managing-prompts` 스킬 참조

## nid 승계 전략

- **메인 카드** (`mainCardIndex`): `updateNoteFields`로 기존 nid 유지
- **서브 카드**: `addNotes`로 새 nid 생성 + 원본으로의 역링크 삽입
- 기존 nid 링크가 깨지지 않도록 보장

## Cloze 번호 처리

- **결정**: 분할 후 모든 카드는 `{{c1::}}`로 리셋
- **이유**: 1 Note = 1 Atomic Card 원칙

## 파서 모듈 (packages/core/src/parser/)

| 파서 | 역할 | 패턴 |
|------|------|------|
| container-parser | `::: type [title]` 구문 | 상태 머신 (스택 기반 depth 추적) |
| nid-parser | `[제목\|nid{13자리}]` 링크 | 정규식 |
| cloze-parser | `{{c숫자::내용::힌트?}}` | 정규식 |

### 설계 결정: 컨테이너 파서

- 정규식만으로는 중첩 `::: toggle` 처리 불가 → **상태 머신 채택**
- 스택 기반으로 depth 추적, 중첩된 컨테이너 정확히 파싱

## 분할 제외 규칙

- `::: toggle todo` 블록은 분할 대상에서 **제외** (미완성 상태)
- purple 플래그 카드도 주의 필요

## 스타일 보존

반드시 보존해야 하는 HTML 태그:
- `<span style="color:...">`, `<font color>`, `<b>`, `<u>`, `<sup>`
- `formatters.ts`에서 검증 로직 제공

## 자주 발생하는 문제

- **canSoftSplit 누락**: `SplitAnalysis` 인터페이스에 `canSoftSplit` 필드 필수
- **자동 Gemini 호출**: `useSplit.ts`에서 `useGemini` 파라미터는 반드시 `boolean` 타입으로 전달
- **분할 후보 수 불일치**: 대시보드와 SplitWorkspace 간 필터링 로직 확인

## 상세 참조

- `references/hard-split.md` — 정규식 기반 Hard Split 상세
- `references/soft-split.md` — Gemini 기반 Soft Split, 5개 제한
- `references/nid-inheritance.md` — mainCardIndex 전략 상세
- `references/parsers.md` — container/nid/cloze 파서 타입 정의
- `references/troubleshooting.md` — 파서 설계 시행착오, Phase 4 이슈
