/**
 * Verbose 감지 - LLM을 사용하여 카드가 원자적 지식 단위인지 판단
 */

import { createLLMClient, getDefaultModelId } from "../llm/factory.js";
import type { LLMModelId } from "../llm/types.js";
import type { VerboseResult } from "./types.js";
import { cleanCardText } from "./utils.js";

const VERBOSE_CHECK_PROMPT = `
당신은 Anki 학습 카드의 원자성(atomicity) 분석가입니다.

## 역할
하나의 Anki 카드에 독립적 개념이 여러 개 섞여 있는지 판단합니다.
SuperMemo의 "최소 정보 원칙"에 따라, 한 장의 카드는 하나의 원자적 지식만 담아야 합니다.

## 분석 기준
1. **독립 개념 수**: 카드에 포함된 서로 독립적인 개념/사실의 수
2. **Cloze 간 응집도**: 여러 Cloze가 하나의 맥락을 공유하는지, 독립적 사실인지
3. **분할 가능성**: Split 시 각 분할 카드가 자기완결적으로 성립하는지

## 판단 규칙
- 독립 개념이 3개 이상이면 "split" 권장
- 독립 개념이 2개이더라도 서로 무관한 영역이면 "split" 권장
- 모든 Cloze가 하나의 핵심 개념을 다각도로 묻는 경우 "ok"

## 주의사항
- 마크다운 문법(#, *, ::, {{c1::}})은 무시하고 의미만 분석
- 컨테이너 구분자(:::)는 무시
- 리스트 항목이 같은 개념의 하위 요소인지, 독립 개념인지 구분

## 응답 형식 (JSON)
{
  "wordCount": 카드 전체 글자 수 (공백 제외),
  "clozeCount": Cloze 삭제 수,
  "conceptCount": 독립 개념 수,
  "concepts": ["개념1 설명", "개념2 설명", ...],
  "recommendation": "split" | "ok",
  "suggestedSplitCount": 권장 분할 수 (split인 경우만, 2-5)
}
`;

export interface VerboseCheckOptions {
  modelId?: LLMModelId;
}

/**
 * 카드 Verbose 감지
 */
export async function checkVerbose(
  cardContent: string,
  options: VerboseCheckOptions = {},
): Promise<VerboseResult> {
  const cleanContent = cleanCardText(cardContent);

  const clozeMatches = cardContent.match(/\{\{c\d+::/g);
  const actualClozeCount = clozeMatches ? clozeMatches.length : 0;

  try {
    const resolvedModelId: LLMModelId = options.modelId ?? getDefaultModelId();
    const client = createLLMClient(resolvedModelId.provider);

    const prompt = `
${VERBOSE_CHECK_PROMPT}

## 분석할 카드 내용:
${cleanContent}
`;

    const llmResult = await client.generateContent(prompt, {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      model: resolvedModelId.model,
    });

    const text = llmResult.text;
    const parsed = JSON.parse(text);

    // 타입 가드: LLM 응답을 신뢰하지 않고 각 필드를 안전하게 변환
    const wordCount =
      typeof parsed.wordCount === "number" ? parsed.wordCount : cleanContent.replace(/\s/g, "").length;
    const clozeCount = typeof parsed.clozeCount === "number" ? parsed.clozeCount : actualClozeCount;
    const conceptCount = typeof parsed.conceptCount === "number" ? parsed.conceptCount : 1;
    const concepts: string[] = Array.isArray(parsed.concepts)
      ? parsed.concepts.filter((c: unknown) => typeof c === "string")
      : [];
    const recommendation = parsed.recommendation === "split" ? "split" : "ok";
    const rawSplit = typeof parsed.suggestedSplitCount === "number" ? parsed.suggestedSplitCount : conceptCount;
    const suggestedSplitCount = recommendation === "split" ? rawSplit : undefined;
    const rawConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 80;

    // 상태 결정
    let status: VerboseResult["status"] = "valid";
    if (recommendation === "split") {
      status = conceptCount >= 4 ? "error" : "warning";
    }

    return {
      status,
      type: "verbose",
      message: getVerboseMessage(status, conceptCount, recommendation),
      confidence: Math.min(100, Math.max(0, rawConfidence)),
      details: {
        wordCount,
        clozeCount,
        conceptCount,
        concepts,
        recommendation,
        suggestedSplitCount,
      },
      timestamp: new Date().toISOString(),
      modelId: llmResult.modelId,
      tokenUsage: llmResult.tokenUsage,
      actualCost: llmResult.actualCost,
    };
  } catch (error) {
    console.error("Verbose 감지 실패:", error);
    return {
      status: "unknown",
      type: "verbose",
      message: "Verbose 감지를 수행할 수 없습니다.",
      confidence: 0,
      details: {
        wordCount: cleanContent.replace(/\s/g, "").length,
        clozeCount: actualClozeCount,
        conceptCount: 0,
        concepts: [],
        recommendation: "ok",
      },
      timestamp: new Date().toISOString(),
    };
  }
}

function getVerboseMessage(status: string, conceptCount: number, recommendation: string): string {
  if (recommendation === "ok") {
    return `원자적 카드입니다 (개념 ${conceptCount}개)`;
  }
  switch (status) {
    case "warning":
      return `분할 권장 — 독립 개념 ${conceptCount}개 감지`;
    case "error":
      return `분할 필요 — 독립 개념 ${conceptCount}개가 혼재`;
    default:
      return "분석 불가";
  }
}
