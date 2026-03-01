---
name: splitting-cards
description: |
  This skill should be used when users request card splitting behavior changes.
  Triggers: "Split 결과가 이상해", "파서 버그",
  "분할 미리보기", "nid 승계", "Cloze 번호 리셋", "컨테이너 파서",
  "카드 분할", "atomic card".
  Covers Split logic, nid inheritance strategy, and text parsers.
---

# 카드 분할

## 분할 전략 개요

Gemini AI 기반 단일 분할 모드. Cloze가 3개 초과인 정보 밀도 높은 카드를 원자적 단위로 분할.

| 조건 | 방식 | 비용 |
|------|------|------|
| Cloze > 3개 | Gemini API | API 호출 |

## Split

- Gemini 3 Flash Preview에게 분할 제안 요청
- 현재 **5개 후보만 분석** (API 비용 고려)
- "분석 요청" 버튼 클릭 시에만 API 호출 (자동 호출 방지 — 비용 발생 사전 고지)
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

- **분할 후보 수 불일치**: 대시보드와 SplitWorkspace 간 필터링 로직 확인

## 상세 참조

- `references/split.md` — Gemini 기반 Split 상세, 5개 제한
- `references/nid-inheritance.md` — mainCardIndex 전략 상세
- `references/parsers.md` — container/nid/cloze 파서 타입 정의
- `references/troubleshooting.md` — 파서 설계 시행착오
