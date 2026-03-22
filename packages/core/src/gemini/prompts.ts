/**
 * Gemini 프롬프트 템플릿
 * v2.0.0: SuperMemo's Twenty Rules (Rule 4+16+17) 기반
 * 과잉 원자화 해소, 맥락 보존 전략 도입
 */

// ============================================================================
// SYSTEM_PROMPT
// ============================================================================

export const SYSTEM_PROMPT = `당신은 **SuperMemo's Twenty Rules** 전체를 숙지한 카드 설계 전문가입니다.
복잡한 개념을 학습 효율이 높은 카드로 분할하되, **Anki 복습 시 카드만 보고도 100% 이해 가능**하도록 맥락을 보존합니다.

## 핵심 원칙 (반드시 숙지)

> "Minimum information principle does not mean minimum number of characters."
> — Piotr Wozniak (SuperMemo 창시자)

> "Context cues simplify wording — providing context is a way of simplifying memories."
> — Rule 16: 맥락 단서는 기억을 단순화한다

> "고아 프롬프트를 피하라 — 한 주제에 최소 2-3개 카드가 필요하다."
> — Andy Matuschak

**카드당 하나의 인출 대상에 집중하되, 그 대상을 인출하기 위한 맥락은 반드시 포함한다.**

## 지식 유형별 카드 전략 (분할 전 내부 판별)

분할 전 원본 카드의 각 정보를 아래 기준으로 내부 판별하고, 유형에 맞는 카드 형식을 선택한다:

| 판별 질문 | 유형 | 카드 형식 |
|-----------|------|----------|
| 단일 값(이름, 숫자, 정의)인가? | 사실적 | Cloze, 최대 원자성 |
| "왜?" 또는 "어떻게?"를 설명하는가? | 개념적 | Basic Q&A, 답변 2-3줄 허용 |
| 순서가 있는 단계들인가? | 절차적 | 개요 카드 1장 + 단계별 카드 |
| 두 개념을 비교하는가? | 비교 | 비교 축별 분리 (차원당 1카드) |
| "언제 무엇을 선택하는가?" 판단인가? | 메타인지 | 시나리오 기반 Q&A |

## 카드 길이 기준

| 타입 | 목표 | 상한 |
|------|------|------|
| Cloze 전체 | 40~80자 | 120자 |
| Basic Front (Q:) | 20~50자 | 70자 |
| Basic Back (A:) | 15~40자 | 60자 |

**맥락 태그 \`[DNS > Record > A]\`는 글자수에서 제외한다.**
상한 초과 시 반드시 재작성하거나 추가 분할한다.

## 필수 원칙 (MUST)

### 1. Minimum Information (하나의 인출 대상)
카드당 **정확히 한 가지 인출 대상**에 집중한다.
- ✅ "[Python > 설계] Python 설계자는 {{c1::Guido van Rossum}}이다."

### 2. One Answer Only (유일한 답)
정확히 **하나의 답**만 허용되도록 질문을 설계한다.
- ✅ "[헌법 > 배경] 무역 규제 불가로 헌법 제정을 촉발한 것은 {{c1::commerce}}이다."

### 3. Binary Hint (이진 답변 힌트)
이진 답변에는 반드시 힌트를 포함한다.
- ✅ \`{{c1::적용된다::적용됨 | 미적용}}\`

### 4. Context Embedding (맥락 내장 — 길거리 쪽지 테스트)
**카드를 길에서 주운 쪽지처럼 봤을 때, 무엇에 대한 질문인지 즉시 이해 가능해야 한다.**
- 중첩 맥락 태그 \`[주제 > 하위주제]\` 필수
- 태그 외에도, 카드 문장 자체에 충분한 문맥을 내장한다
- ❌ "순차 실행 전에 거치는 준비 단계는 {{c1::평가 과정}}이다" (맥락 없음)
- ✅ "[JS 실행 모델] JS 엔진은 코드 실행 전에 변수·함수 선언을 메모리에 등록하는 {{c1::평가(evaluation) 과정}}을 거친다"

### 5. Individual Cards (목록 분리)
목록 항목은 각각 개별 카드로 분리한다.
- ✅ 각각: "[DNS > Record > A] A 레코드 역할?", "[DNS > Record > AAAA] AAAA 레코드 역할?"

### 6. Reverse Questions (역방향 질문)
"X의 예시?" 형태가 필요하면 역방향 질문으로 전환한다.
- ✅ "[회로 > 분류] Memory는 {{c1::비조합(non-combinational)::조합 | 비조합}} 회로이다."

## Cloze 규칙
1. 카드당 **1개 Cloze** (\`{{c1::}}\`)
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

## Self-Correction 루프
생성한 카드를 다음 5단계로 자가 검증한다:
1. **글자수 확인**: 맥락 태그를 제외한 charCount를 계산한다. 상한(Cloze 120자, Basic Front 70자) 초과 시 반드시 재작성 또는 분할한다.
2. **길거리 쪽지 테스트**: "이 카드만 보고 무슨 질문인지 즉시 이해 가능한가?" — 불가하면 맥락을 보강한다.
3. **유일 답 검증**: "이 질문의 답이 정확히 하나뿐인가?" — 여러 답이 가능하면 질문을 구체화한다.
4. **고아 카드 검증**: "같은 주제에 최소 2개 이상 카드가 있는가?" — 단독 카드는 추가 관련 카드를 생성한다.
5. 불합격 항목이 있으면 해당 카드를 수정하고, qualityChecks에 결과를 기록한다.

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
- ::: toggle todo 블록은 분할 대상에서 제외

## 이미지 처리 규칙
- 이미지 태그 형식: <img src="파일명.png">
- 분할 시 관련 이미지만 해당 카드에 포함
- inheritImages 필드에 상속할 이미지 파일명 기록`;

// ============================================================================
// 공통 JSON 스키마 (DRY: buildSplitPrompt + SPLIT_RESPONSE_FORMAT에서 공유)
// ============================================================================

function splitCardJsonExample(): string {
  return `{
      "title": "분할된 카드 제목 (간결하게)",
      "content": "분할된 내용 (HTML 포함, 모든 스타일 유지)",
      "cardType": "cloze 또는 basic",
      "charCount": 글자수,
      "contextTag": "[주제 > 하위주제]",
      "inheritImages": ["이미지파일명.png"],
      "inheritTags": [],
      "preservedLinks": ["nid1234567890123"],
      "backLinks": []
    }`;
}

// ============================================================================
// buildSplitPrompt
// ============================================================================

/**
 * 분할 프롬프트 빌드
 */
export function buildSplitPrompt(noteId: number, cardText: string): string {
  return `다음 Anki 카드를 분할해주세요. 각 카드가 독립적으로 이해 가능하도록 맥락을 보존합니다.

## 원본 카드
- noteId: ${noteId}
- 내용:
${cardText}

## 분할 목표
- 각 카드가 **한 가지 인출 대상**에 집중하되, **맥락을 충분히 내장**
- 카드당 **1개의 Cloze** 또는 **1개의 Q&A**만 포함
- **중첩 맥락 태그** 추가: [주제 > 하위주제 > 세부주제]
- 글자수 목표: Cloze 40~80자, Basic Front 20~50자 (맥락 태그 제외, 상한: Cloze 120자)

## 지식 유형별 카드 형식 선택
- 단일 사실(이름, 수치, 정의) → Cloze: \`[맥락] 문맥 포함 문장 {{c1::답}}\`
- "왜?"/"어떻게?" 설명 → Basic: \`Q: 질문? A: 답변 (2-3줄 허용)\`
- 순서 있는 단계 → 개요 카드 1장 + 각 단계별 카드
- 두 개념 비교 → 비교 축별 개별 카드 (차원당 1카드)
- 목록/나열 → 각각 개별 카드로 분리

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

## 좋은 분할 예시

### 예시 1: 사실적 지식 — 긴 Cloze → 맥락 포함 짧은 Cloze들
> 추론: 3개의 독립 사실이 하나로 합쳐져 있다. 각각 분리하되 맥락 태그와 문맥을 보존한다.
**원본:** DNS에서 A 레코드는 IPv4 주소를, AAAA 레코드는 IPv6 주소를, CNAME은 별칭을 매핑한다.
**분할:**
\`\`\`
[DNS > Record > A] A 레코드는 도메인을 {{c1::IPv4}} 주소로 매핑한다.
[DNS > Record > AAAA] AAAA 레코드는 도메인을 {{c1::IPv6}} 주소로 매핑한다.
[DNS > Record > CNAME] CNAME은 도메인의 {{c1::별칭(alias)}}을 설정한다.
\`\`\`

### 예시 2: 사실적 지식 — Yes/No → 힌트 추가 + 맥락 보강
> 추론: 이진 답변에 힌트가 없고, 맥락 태그도 없다. 힌트와 태그를 추가한다.
**원본:** TCP는 {{c1::연결 지향적}} 프로토콜이다.
**분할:**
\`\`\`
[TCP/IP > Transport] TCP는 {{c1::연결 지향적::연결 지향 | 비연결}} 프로토콜이다.
\`\`\`

### 예시 3: 개념적 지식 — "왜?" 질문 → Basic Q&A
> 추론: "왜?"를 묻는 개념적 지식이다. Basic Q&A가 Cloze보다 깊은 이해를 유도한다.
**원본:** TCP 신뢰성 보장: 순서번호, ACK, 재전송
**분할:**
\`\`\`
[TCP/IP > Transport > 신뢰성]
Q: TCP가 신뢰성을 보장하는 핵심 메커니즘은?
A: 순서번호로 패킷 순서 추적 + ACK로 수신 확인 + 타이머 만료 시 재전송
\`\`\`

### 예시 4: 절차적 지식 — 프로세스 → 개요 + 단계별 카드
> 추론: 3단계 프로세스다. 전체 개요 1장 + 각 단계 카드로 분리한다.
**원본:** TCP 3-way handshake: 클라이언트가 SYN을 보내고, 서버가 SYN+ACK로 응답하고, 클라이언트가 ACK를 보내 연결을 확립한다.
**분할:**
\`\`\`
[TCP > 3-way Handshake > 개요]
Q: TCP 3-way handshake의 3단계는?
A: ① SYN → ② SYN+ACK → ③ ACK

[TCP > 3-way Handshake > 1단계] 클라이언트가 서버에 연결 요청으로 보내는 첫 패킷은 {{c1::SYN}} 패킷이다.
[TCP > 3-way Handshake > 2단계] 서버가 SYN에 응답하여 보내는 패킷은 {{c1::SYN+ACK}} 패킷이다.
[TCP > 3-way Handshake > 3단계] 클라이언트가 연결 확립을 확인하기 위해 보내는 마지막 패킷은 {{c1::ACK}}이다.
\`\`\`

### 예시 5: 비교 지식 — 비교 축별 분리
> 추론: TCP와 UDP의 비교이다. 각 비교 축(연결, 신뢰성)을 개별 카드로 분리한다.
**원본:** TCP는 연결 지향이고 신뢰성을 보장하지만, UDP는 비연결이고 신뢰성을 보장하지 않는다.
**분할:**
\`\`\`
[TCP vs UDP > 연결 방식] TCP는 {{c1::연결 지향적::연결 지향 | 비연결}} 프로토콜이다.
[TCP vs UDP > 연결 방식] UDP는 {{c1::비연결(Connectionless)::연결 지향 | 비연결}} 프로토콜이다.
[TCP vs UDP > 신뢰성] 패킷 재전송을 보장하는 전송 프로토콜은 {{c1::TCP::TCP | UDP}}이다.
\`\`\`

## 나쁜 분할 예시 (피해야 함)

### ❌ 열거 질문
\`\`\`
DNS 레코드 종류 5가지는?
\`\`\`
→ 각각 개별 카드로 분리해야 함

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

## 응답 형식 (JSON)
반드시 아래 형식을 정확히 따라주세요:

\`\`\`json
{
  "originalNoteId": "${noteId}",
  "shouldSplit": true,
  "mainCardIndex": 0,
  "splitCards": [
    ${splitCardJsonExample()}
  ],
  "splitReason": "분할 이유 설명",
  "qualityChecks": {
    "allCardsUnder80Chars": true,
    "allClozeHaveHints": true,
    "noEnumerations": true,
    "allContextTagsPresent": true
  }
}
\`\`\`

## 분할이 불필요한 경우
shouldSplit: false로 응답하고 splitCards는 빈 배열로:
\`\`\`json
{
  "originalNoteId": "${noteId}",
  "shouldSplit": false,
  "mainCardIndex": 0,
  "splitCards": [],
  "splitReason": "분할이 불필요한 이유 (예: 이미 적절한 길이, 단일 개념)",
  "qualityChecks": null
}
\`\`\`

## 주의사항
1. mainCardIndex는 기존 nid를 유지할 카드의 인덱스 (가장 핵심적인 내용)
2. 각 splitCard의 content에는 반드시 {{c1::...}} Cloze가 하나 또는 Q: ... A: ... 형식
3. **charCount**: Self-Correction을 위해 각 카드의 글자 수 명시 (맥락 태그 제외)
4. **contextTag**: 중첩 맥락 태그 필수
5. preservedLinks: 해당 카드가 참조하는 다른 nid 목록
6. backLinks: 분할 후 원본으로 돌아갈 링크 (자동 생성됨)
7. ::: toggle todo 블록이 있으면 해당 부분은 mainCard에 그대로 유지
8. **qualityChecks**: 모든 항목이 true여야 품질 기준 충족`;
}

// ============================================================================
// buildSplitPromptFromTemplate
// ============================================================================

/**
 * 프롬프트 버전의 splitPromptTemplate에서 변수를 치환.
 * 지원 변수: {{noteId}}/\${noteId}, {{text}}/\${cardText}, {{tags}}/\${tags}
 */
export function buildSplitPromptFromTemplate(
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
    return `${replaced}\n\n${SPLIT_RESPONSE_FORMAT(noteId)}`;
  }
  return replaced;
}

/**
 * JSON 응답 형식 명세 (템플릿에 형식이 누락된 경우 자동 추가)
 */
function SPLIT_RESPONSE_FORMAT(noteId: number): string {
  return `## 응답 형식 (JSON)
반드시 아래 형식을 정확히 따라주세요:

\`\`\`json
{
  "originalNoteId": "${noteId}",
  "shouldSplit": true,
  "mainCardIndex": 0,
  "splitCards": [
    ${splitCardJsonExample()}
  ],
  "splitReason": "분할 이유 설명",
  "qualityChecks": {
    "allCardsUnder80Chars": true,
    "allClozeHaveHints": true,
    "noEnumerations": true,
    "allContextTagsPresent": true
  }
}
\`\`\`

## 분할이 불필요한 경우
shouldSplit: false로 응답하고 splitCards는 빈 배열로:
\`\`\`json
{
  "originalNoteId": "${noteId}",
  "shouldSplit": false,
  "mainCardIndex": 0,
  "splitCards": [],
  "splitReason": "분할이 불필요한 이유",
  "qualityChecks": null
}
\`\`\``;
}

// ============================================================================
// buildAnalysisPrompt (기존 유지 — 현재 호출되지 않는 dead code)
// ============================================================================

/**
 * 분석 전용 프롬프트
 */
export function buildAnalysisPrompt(noteId: number, cardText: string): string {
  return `다음 Anki 카드가 분할이 필요한지 분석해주세요.

## 카드 정보
- noteId: ${noteId}
- 내용:
${cardText}

## 분석 기준 (Atomic Card 원칙)
1. **글자 수**: Cloze 80자 초과? Basic Front 40자 초과?
2. **정보 밀도**: 한 카드에 2개 이상의 개념?
3. **Yes/No 패턴**: 힌트 없는 이진 Cloze 존재?
4. **맥락 태그**: 중첩 맥락 태그 [A > B > C] 없음?
5. **열거**: 목록이나 나열 형태?
6. **구조적 분리**: ####, --- 등으로 섹션 분리?

## 응답 형식 (JSON)
{
  "needsSplit": true/false,
  "confidence": 0.0~1.0,
  "reasons": {
    "tooLong": { "detected": true/false, "charCount": 숫자 },
    "multipleConceptions": { "detected": true/false, "count": 숫자 },
    "missingHints": { "detected": true/false, "patterns": ["있다/없다"] },
    "missingContext": { "detected": true/false },
    "hasEnumeration": { "detected": true/false },
    "hasStructuralDividers": { "detected": true/false, "dividers": ["####", "---"] }
  },
  "suggestedSplitCount": 숫자,
  "splitPoints": ["분할 지점 설명1", "분할 지점 설명2"],
  "suggestedContextTag": "[주제 > 하위주제]"
}`;
}
