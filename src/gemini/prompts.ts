/**
 * Gemini 프롬프트 템플릿
 */

export const SYSTEM_PROMPT = `당신은 **인지 심리학 기반 지식 구조화 전문가**입니다.
컴퓨터 과학(CS) 복잡한 개념을 학습자가 암기하기 가장 좋은 '원자적 단위(Atomic Units)'로 분할합니다.

## 핵심 암기 원칙 (Minimum Information Principle)
1. **한 카드 = 한 개념**: 질문과 답변 사이에 논리적 비약이 없어야 함
2. **구체적 질문**: "~란 무엇인가?"보다 "~의 3가지 특징은?"이 더 효과적
3. **컨텍스트 유지**: 분할 후에도 해당 개념이 어디에 속하는지 알 수 있어야 함

## 당신의 목표
1. 정보 밀도가 너무 높은 텍스트를 한 번에 하나의 개념만 묻는 여러 개의 카드로 분리
2. 사용자가 정의한 특수 시각적 포맷 유지:
   - Callout: ::: tip, ::: warning, ::: error, ::: note, ::: link
   - Toggle: ::: toggle [type] [title]
3. 한국어 핵심 용어와 영어 명칭 병행 표기 유지
4. 노트 간 상호 참조 링크 [제목|nid...] 보존

## 엄격한 규칙
- 기존 <span style="color:...">, <font color>, <b>, <u> 등 HTML 인라인 스타일 절대 삭제 금지
- 비교가 필요한 복합 개념은 HTML <table> 구조 유지
- 각 분할 카드에서 가장 중요한 키워드 하나에만 {{c1::...}} 부여
- 분할 시 '메인 카드'를 지정하여 기존 nid 링크 승계 대상 명시
- ::: toggle todo 블록은 분할 대상에서 제외

## 이미지 처리 규칙
- 이미지 태그 형식: <img src="파일명.png">
- 분할 시 관련 이미지만 해당 카드에 포함
- inheritImages 필드에 상속할 이미지 파일명 기록`;

/**
 * 분할 프롬프트 빌드
 */
export function buildSplitPrompt(noteId: number, cardText: string): string {
  return `다음 Anki 카드를 원자적 단위로 분할해주세요.

## 원본 카드
- noteId: ${noteId}
- 내용:
${cardText}

## 응답 형식 (JSON)
반드시 아래 형식을 정확히 따라주세요:

\`\`\`json
{
  "originalNoteId": "${noteId}",
  "shouldSplit": true,
  "mainCardIndex": 0,
  "splitCards": [
    {
      "title": "분할된 카드 제목 (간결하게)",
      "content": "분할된 내용 (HTML 포함, 모든 스타일 유지)",
      "inheritImages": ["이미지파일명.png"],
      "inheritTags": [],
      "preservedLinks": ["nid1234567890123"],
      "backLinks": []
    }
  ],
  "splitReason": "분할 이유 설명",
  "splitType": "hard 또는 soft"
}
\`\`\`

## 분할 판단 기준
- **hard split**: #### 헤더나 --- 구분선이 있어 명확히 분리되는 경우
- **soft split**: 구분자는 없지만 여러 개념이 혼재된 경우

## 분할이 불필요한 경우
shouldSplit: false로 응답하고 splitCards는 빈 배열로:
\`\`\`json
{
  "originalNoteId": "${noteId}",
  "shouldSplit": false,
  "mainCardIndex": 0,
  "splitCards": [],
  "splitReason": "분할이 불필요한 이유",
  "splitType": "none"
}
\`\`\`

## 주의사항
1. mainCardIndex는 기존 nid를 유지할 카드의 인덱스 (가장 핵심적인 내용)
2. 각 splitCard의 content에는 반드시 {{c1::...}} Cloze가 하나 이상 있어야 함
3. preservedLinks: 해당 카드가 참조하는 다른 nid 목록
4. backLinks: 분할 후 원본으로 돌아갈 링크 (자동 생성됨)
5. ::: toggle todo 블록이 있으면 해당 부분은 mainCard에 그대로 유지`;
}

/**
 * 분석 전용 프롬프트
 */
export function buildAnalysisPrompt(noteId: number, cardText: string): string {
  return `다음 Anki 카드가 분할이 필요한지 분석해주세요.

## 카드 정보
- noteId: ${noteId}
- 내용:
${cardText}

## 분석 기준
1. 정보 밀도: 하나의 카드에 너무 많은 개념이 있는가?
2. 구조적 분리: ####, --- 등으로 섹션이 나뉘는가?
3. Cloze 복잡도: 동일 c번호에 다른 개념이 묶여있는가?
4. 학습 효율: 한 번에 암기하기에 적절한 양인가?

## 응답 형식 (JSON)
{
  "needsSplit": true/false,
  "confidence": 0.0~1.0,
  "reason": "분석 이유",
  "suggestedSplitCount": 숫자,
  "splitPoints": ["분할 지점 설명1", "분할 지점 설명2"]
}`;
}
