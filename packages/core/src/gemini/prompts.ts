/**
 * Gemini 프롬프트 템플릿
 * v3.0.0: Mobile-Friendly Optimization (split / compact / skip)
 * 과잉 원자화 해소, 모바일 1스크린 기준으로 전환
 */

// ============================================================================
// SYSTEM_PROMPT
// ============================================================================

export const SYSTEM_PROMPT = `당신은 **모바일 친화적 카드 최적화 전문가**입니다.
Anki 카드를 모바일 화면에서 스크롤 없이 효과적으로 학습할 수 있도록 최적화합니다.

## 핵심 원칙

> "Minimum information principle does not mean minimum number of characters."
> — Piotr Wozniak (SuperMemo 창시자)

> "Context cues simplify wording — providing context is a way of simplifying memories."
> — Rule 16: 맥락 단서는 기억을 단순화한다

**서로 큰 관련이 없는 2개 이상 주제가 한 카드에 공존하지 않도록** 하되, 같은 주제 내 관련 정보는 한 카드에 유지한다.

## Operation 판정 가이드

카드를 분석한 뒤 아래 세 가지 중 하나를 선택한다:

| Operation | 조건 | 예시 |
|-----------|------|------|
| **split** | 서로 무관한 2개 이상 주제가 한 카드에 공존 | DNS 개요 + TCP 핸드셰이크가 한 카드에 → 분리 |
| **compact** | 모바일 1스크린 초과이지만, 쪼개면 학습 효과가 떨어지는 단일 주제 | CSS 명시도 규칙이 길지만 하나의 주제 → 압축/재구성 |
| **skip** | 이미 모바일 1스크린 내 단일 주제 | 짧은 Cloze 카드 → 변경 불필요 |

### Split 판정
- 한 카드에 **서로 독립적인 주제**가 2개 이상 공존하면 분리
- 분리 후 각 카드는 독립적으로 이해 가능해야 한다 (맥락 태그 + 문맥 내장)

### Compact 판정
- 단일 주제이지만 내용이 모바일 1스크린을 초과할 때 적용
- **(A) 내용 압축**: 같은 정보를 더 간결한 표현으로 재작성
- **(B) 정보 선별**: 핵심 학습 포인트만 남기고 부가 설명 제거
- **(C) 구조 재편**: 모바일 읽기 좋은 형태로 재구성 (표, 불릿 등)

### Skip 판정
- 이미 모바일 1스크린 내에서 단일 주제를 다루고 있으면 변경 불필요

## auditReport 작성 지침 (compact 시 필수)

compact 수행 시 반드시 감사 보고서를 작성한다:
- **preserved**: 유지한 핵심 정보 목록
- **removed**: 제거한 부가 정보 목록
- **transformed**: 구조를 변환한 항목 목록 (예: "장황한 문장 → 2열 비교표로 구조화")

## 지식 유형별 카드 전략

카드의 각 정보를 아래 기준으로 내부 판별하고, 유형에 맞는 카드 형식을 선택한다:

| 판별 질문 | 유형 | 카드 형식 |
|-----------|------|----------|
| 단일 값(이름, 숫자, 정의)인가? | 사실적 | Cloze |
| "왜?" 또는 "어떻게?"를 설명하는가? | 개념적 | Basic Q&A, 답변 2-3줄 허용 |
| 순서가 있는 단계들인가? | 절차적 | 개요 카드 1장 + 단계별 카드 |
| 두 개념을 비교하는가? | 비교 | 비교 축별 분리 (차원당 1카드) |
| "언제 무엇을 선택하는가?" 판단인가? | 메타인지 | 시나리오 기반 Q&A |

## 필수 원칙 (MUST)

### 1. One Answer Only (유일한 답)
정확히 **하나의 답**만 허용되도록 질문을 설계한다.
- ✅ "[헌법 > 배경] 무역 규제 불가로 헌법 제정을 촉발한 것은 {{c1::commerce}}이다."

### 2. Binary Hint (이진 답변 힌트)
이진 답변에는 반드시 힌트를 포함한다.
- ✅ \`{{c1::적용된다::적용됨 | 미적용}}\`

### 3. Context Embedding (맥락 내장 — 길거리 쪽지 테스트)
**카드를 길에서 주운 쪽지처럼 봤을 때, 무엇에 대한 질문인지 즉시 이해 가능해야 한다.**
- 중첩 맥락 태그 \`[주제 > 하위주제]\` 필수
- 태그 외에도, 카드 문장 자체에 충분한 문맥을 내장한다
- ❌ "순차 실행 전에 거치는 준비 단계는 {{c1::평가 과정}}이다" (맥락 없음)
- ✅ "[JS 실행 모델] JS 엔진은 코드 실행 전에 변수·함수 선언을 메모리에 등록하는 {{c1::평가(evaluation) 과정}}을 거친다"

### 4. Reverse Questions (역방향 질문)
"X의 예시?" 형태가 필요하면 역방향 질문으로 전환한다.
- ✅ "[회로 > 분류] Memory는 {{c1::비조합(non-combinational)::조합 | 비조합}} 회로이다."

## Cloze 규칙
1. 같은 주제 내 관련 Cloze 여러 개 허용 (c1, c2, ... 구분)
2. **Cloze 위치**: 가급적 문장 끝에 배치하여 자연스러운 인출을 유도
3. 이진 패턴 시 **힌트 필수**:
   - 있다/없다: \`{{c1::있다::있다 | 없다}}\`
   - 증가/감소: \`{{c1::증가::증가 ↑ | 감소 ↓}}\`
   - 동기/비동기: \`{{c1::동기::Sync | Async}}\`
   - 연결/비연결: \`{{c1::연결 지향::연결 지향 | 비연결}}\`
   - 상태/무상태: \`{{c1::Stateful::Stateful | Stateless}}\`
   - 가능/불가능: \`{{c1::가능::가능 ○ | 불가능 ✕}}\`
   - 선점/비선점: \`{{c1::선점형::Preemptive | Non-preemptive}}\`
   - 동적/정적: \`{{c1::동적::Dynamic | Static}}\`
   - 컴파일/인터프리트: \`{{c1::컴파일::Compiled | Interpreted}}\`
   - 직렬/병렬: \`{{c1::병렬::Serial | Parallel}}\`
   - 블로킹/논블로킹: \`{{c1::Non-blocking::Blocking | Non-blocking}}\`

## 긍정형 인출 지향
부정형 질문("X가 아닌 것은?") 대신 긍정형 질문("X의 특징인 Y를 대체하는 것은?")을 사용한다.

## 권장 원칙 (SHOULD)
- **Why > What**: "왜?" 질문을 사실 카드와 쌍으로 생성한다
- **Two-way**: Q→A뿐 아니라 A→Q 카드도 고려
- **Connections**: "X와 Y의 차이점?" 관계 카드 생성
- **Elaborative Encoding**: 같은 개념의 다양한 변형 질문

## 형식 유지 규칙
- 기존 <span style="color:...">, <font color>, <b>, <u> 등 HTML 인라인 스타일 절대 삭제 금지
- Callout: ::: tip, ::: warning, ::: error, ::: note, ::: link 보존
- Toggle: ::: toggle [type] [title] 보존
- 비교가 필요한 복합 개념은 HTML <table> 구조 유지
- 노트 간 상호 참조 링크 [제목|nid...] 보존
- ::: toggle todo 블록은 최적화 대상에서 제외

## 이미지 처리 규칙
- 이미지 태그 형식: <img src="파일명.png">
- 분할 시 관련 이미지만 해당 카드에 포함
- inheritImages 필드에 상속할 이미지 파일명 기록`;

// ============================================================================
// 공통 JSON 스키마 (DRY: buildOptimizationPrompt + OPTIMIZATION_RESPONSE_FORMAT에서 공유)
// ============================================================================

function splitCardJsonExample(): string {
  return `{
      "title": "카드 제목 (간결하게)",
      "content": "카드 내용 (HTML 포함, 모든 스타일 유지)",
      "cardType": "cloze 또는 basic",
      "contextTag": "[주제 > 하위주제]",
      "inheritImages": ["이미지파일명.png"],
      "inheritTags": [],
      "preservedLinks": ["nid1234567890123"],
      "backLinks": []
    }`;
}

// ============================================================================
// buildOptimizationPrompt
// ============================================================================

/**
 * 모바일 최적화 프롬프트 빌드 (split / compact / skip)
 */
export function buildOptimizationPrompt(noteId: number, cardText: string): string {
  return `다음 Anki 카드를 모바일에 최적화해주세요. 분석 후 split, compact, 또는 skip 중 하나를 선택합니다.

## 원본 카드
- noteId: ${noteId}
- 내용:
${cardText}

## 최적화 목표
- **모바일 1스크린**에서 스크롤 없이 학습 가능하도록 최적화
- 서로 **무관한 주제가 공존**하면 split, 단일 주제이지만 **길면** compact, **이미 적절**하면 skip
- 각 카드는 **맥락을 충분히 내장** (중첩 맥락 태그 [주제 > 하위주제] 추가)

## 지식 유형별 카드 형식 선택
- 단일 사실(이름, 수치, 정의) → Cloze: \`[맥락] 문맥 포함 문장 {{c1::답}}\`
- "왜?"/"어떻게?" 설명 → Basic: \`Q: 질문? A: 답변 (2-3줄 허용)\`
- 순서 있는 단계 → 개요 카드 1장 + 각 단계별 카드
- 두 개념 비교 → 비교 축별 개별 카드 (차원당 1카드)

## 이진 패턴 힌트 (필수)
다음 패턴 발견 시 반드시 힌트 추가:
- 있다/없다 → \`{{c1::있다::있다 | 없다}}\`
- 가능/불가능 → \`{{c1::가능::가능 ○ | 불가능 ✕}}\`
- 증가/감소 → \`{{c1::증가::증가 ↑ | 감소 ↓}}\`
- 동기/비동기 → \`{{c1::동기::Sync | Async}}\`
- 연결/비연결 → \`{{c1::연결 지향::연결 지향 | 비연결}}\`
- 상태/무상태 → \`{{c1::Stateful::Stateful | Stateless}}\`
- 물리/논리 → \`{{c1::물리::Physical | Logical}}\`
- 선점/비선점 → \`{{c1::선점형::Preemptive | Non-preemptive}}\`
- 동적/정적 → \`{{c1::동적::Dynamic | Static}}\`
- 블로킹/논블로킹 → \`{{c1::Non-blocking::Blocking | Non-blocking}}\`

## 좋은 최적화 예시

### 예시 1: Split — 서로 무관한 주제가 공존
> 추론: DNS 개요와 TCP 핸드셰이크가 한 카드에 있다. 서로 무관한 주제이므로 split.
**원본:** DNS는 도메인을 IP로 변환하는 시스템이다. TCP 3-way handshake는 SYN, SYN+ACK, ACK 3단계로 진행된다.
**결과 (split):**
\`\`\`
카드 1: [DNS > 개요] DNS는 도메인을 {{c1::IP}} 주소로 변환하는 시스템이다.
카드 2: [TCP > 3-way Handshake] TCP 3-way handshake는 {{c1::SYN}} → {{c2::SYN+ACK}} → {{c3::ACK}} 3단계로 진행된다.
\`\`\`

### 예시 2: Compact — 단일 주제이지만 모바일 1스크린 초과
> 추론: CSS 명시도는 하나의 주제이지만 설명이 길다. 쪼개면 학습 효과가 떨어지므로 compact.
**원본:** CSS 명시도 계산 규칙: inline 1000점, id 100점, class 10점, element 1점. !important는 모든 규칙을 덮어쓴다. 같은 명시도면 나중에 선언된 것이 우선. 상속은 직접 지정보다 항상 낮다. 전체 선택자(*)는 0점이다.
**결과 (compact):**
\`\`\`
[CSS > 명시도] 선택자별 가중치:
| 선택자 | 점수 |
|--------|------|
| inline | 1000 |
| #id | 100 |
| .class | 10 |
| element | 1 |
| * | 0 |

우선순위: {{c1::!important}} > inline > 명시도 합산 > 선언 순서
상속은 직접 지정보다 {{c2::항상 낮다::높다 | 낮다}}.
\`\`\`

### 예시 3: Skip — 이미 적절한 카드
> 추론: 짧고 모바일 1스크린 내에서 단일 주제를 다룬다. 변경 불필요.
**원본:** [DNS > Record > A] A 레코드는 도메인을 {{c1::IPv4}} 주소로 매핑한다.
**결과 (skip):** 변경 불필요.

### 예시 4: Split — 이진 힌트 추가 + 주제 분리
> 추론: 이진 답변에 힌트가 없고, 두 비교 축이 한 카드에 있다.
**원본:** TCP는 연결 지향이고, UDP는 비연결이다.
**결과 (split):**
\`\`\`
[TCP vs UDP > 연결 방식] TCP는 {{c1::연결 지향적::연결 지향 | 비연결}} 프로토콜이다.
[TCP vs UDP > 연결 방식] UDP는 {{c1::비연결(Connectionless)::연결 지향 | 비연결}} 프로토콜이다.
\`\`\`

## 나쁜 예시 (피해야 함)

### ❌ 예시 함정
\`\`\`
비조합 회로의 예시는?
\`\`\`
→ "[회로 > 분류] Memory는 {{c1::비조합(non-combinational)::조합 | 비조합}} 회로이다."

### ❌ 맥락 없는 질문 (길거리 쪽지 테스트 실패)
\`\`\`
이것의 역할은?
\`\`\`
→ "[DNS > Record > A] A 레코드는 도메인을 {{c1::IPv4}} 주소로 매핑한다."

${OPTIMIZATION_RESPONSE_FORMAT(noteId)}

## 주의사항
1. mainCardIndex는 기존 nid를 유지할 카드의 인덱스 (가장 핵심적인 내용) — split 시에만 사용
2. 각 splitCard의 content에는 Cloze 또는 Q: ... A: ... 형식 포함
3. **contextTag**: 중첩 맥락 태그 필수
4. preservedLinks: 해당 카드가 참조하는 다른 nid 목록
5. backLinks: 분할 후 원본으로 돌아갈 링크 (자동 생성됨)
6. ::: toggle todo 블록이 있으면 해당 부분은 mainCard에 그대로 유지
7. **qualityChecks**: 모든 항목이 true여야 품질 기준 충족
8. **compact 시**: auditReport에 preserved/removed/transformed 반드시 기재`;
}

/**
 * @deprecated buildOptimizationPrompt 사용 권장
 */
export function buildSplitPrompt(noteId: number, cardText: string): string {
  return buildOptimizationPrompt(noteId, cardText);
}

// ============================================================================
// OPTIMIZATION_RESPONSE_FORMAT
// ============================================================================

/**
 * JSON 응답 형식 명세 (discriminated union: split | compact | skip)
 */
function OPTIMIZATION_RESPONSE_FORMAT(noteId: number): string {
  return `## 응답 형식 (JSON)
반드시 아래 세 가지 형식 중 하나를 정확히 따라주세요:

### Split 응답 (서로 무관한 주제 분리)
\`\`\`json
{
  "originalNoteId": "${noteId}",
  "operation": "split",
  "mainCardIndex": 0,
  "splitCards": [
    ${splitCardJsonExample()}
  ],
  "operationReason": "분리 이유 설명",
  "qualityChecks": {
    "allClozeHaveHints": true,
    "allContextTagsPresent": true
  }
}
\`\`\`

### Compact 응답 (단일 주제 압축/재구성)
\`\`\`json
{
  "originalNoteId": "${noteId}",
  "operation": "compact",
  "compactedContent": "압축된 카드 내용 (HTML 포함, 모든 스타일 유지)",
  "operationReason": "압축 이유 설명",
  "auditReport": {
    "preserved": ["유지한 핵심 정보1", "유지한 핵심 정보2"],
    "removed": ["제거한 부가 정보"],
    "transformed": ["구조 변환 설명"]
  },
  "qualityChecks": {
    "allClozeHaveHints": true,
    "allContextTagsPresent": true
  }
}
\`\`\`

### Skip 응답 (변경 불필요)
\`\`\`json
{
  "originalNoteId": "${noteId}",
  "operation": "skip",
  "operationReason": "변경이 불필요한 이유"
}
\`\`\``;
}

// ============================================================================
// buildOptimizationPromptFromTemplate
// ============================================================================

/**
 * 프롬프트 버전의 splitPromptTemplate에서 변수를 치환.
 * 지원 변수: {{noteId}}/\${noteId}, {{text}}/\${cardText}, {{tags}}/\${tags}
 */
export function buildOptimizationPromptFromTemplate(
  template: string,
  noteId: number,
  text: string,
  tags?: string[],
): string {
  const tagsStr = tags?.join(", ") ?? "";
  const replacements: Record<string, string> = {
    noteId: String(noteId),
    text,
    cardText: text,
    tags: tagsStr,
  };
  const replaced = template.replace(
    /\{\{(noteId|text|tags)\}\}|\$\{(noteId|cardText|tags)\}/g,
    (_match, moustacheKey: string | undefined, dollarKey: string | undefined) =>
      replacements[moustacheKey ?? dollarKey ?? ""] ?? _match,
  );

  const hasResponseSchema =
    replaced.includes("응답 형식") ||
    /```json/i.test(replaced) ||
    /응답[^.\n]{0,40}json/i.test(replaced);

  // JSON 응답 형식이 템플릿에 없으면 기본 형식 추가
  if (!hasResponseSchema) {
    return `${replaced}\n\n${OPTIMIZATION_RESPONSE_FORMAT(noteId)}`;
  }
  return replaced;
}

/**
 * @deprecated buildOptimizationPromptFromTemplate 사용 권장
 */
export function buildSplitPromptFromTemplate(
  template: string,
  noteId: number,
  text: string,
  tags?: string[],
): string {
  return buildOptimizationPromptFromTemplate(template, noteId, text, tags);
}

// ============================================================================
// buildAnalysisPrompt (Mobile-Friendly 기준)
// ============================================================================

/**
 * 분석 전용 프롬프트 (Mobile-Friendly 원칙)
 */
export function buildAnalysisPrompt(noteId: number, cardText: string): string {
  return `다음 Anki 카드가 모바일 최적화가 필요한지 분석해주세요.

## 카드 정보
- noteId: ${noteId}
- 내용:
${cardText}

## 분석 기준 (Mobile-Friendly 원칙)
1. **모바일 1스크린 초과 여부**: 내용이 모바일 화면 1스크린을 초과하는가?
2. **서로 무관한 주제 공존 여부**: 한 카드에 서로 무관한 2개 이상 주제가 있는가?
3. **Yes/No 패턴**: 힌트 없는 이진 Cloze 존재?
4. **맥락 태그**: 중첩 맥락 태그 [A > B > C] 없음?
5. **구조적 분리**: ####, --- 등으로 섹션 분리?

## 응답 형식 (JSON)
{
  "needsOptimization": true/false,
  "confidence": 0.0~1.0,
  "reasons": {
    "mobileOverflow": { "detected": true/false, "description": "설명" },
    "multipleTopics": { "detected": true/false, "count": 숫자 },
    "missingHints": { "detected": true/false, "patterns": ["있다/없다"] },
    "missingContext": { "detected": true/false },
    "hasStructuralDividers": { "detected": true/false, "dividers": ["####", "---"] }
  },
  "suggestedOperation": "split 또는 compact 또는 skip",
  "suggestedContextTag": "[주제 > 하위주제]"
}`;
}
