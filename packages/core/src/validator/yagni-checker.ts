/**
 * YAGNI 감지 — 학습 ROI가 낮은 지엽적/fragile 지식의 Cloze를 식별
 *
 * CS/프로그래밍 도메인에서 암기 가치가 낮은 정보를 감지한다:
 * - 빠르게 변하는 구체적 버전 번호·포트 번호·옵션 플래그
 * - 실무에서 참조로 충분한 트리비아 (검색 5초면 해결되는 것)
 * - 도메인 무관 잡지식
 */

import { createLLMClient, getDefaultModelId } from "../llm/factory.js";
import type { LLMModelId } from "../llm/types.js";
import type { YagniResult } from "./types.js";
import { cleanCardText } from "./utils.js";

const YAGNI_CHECK_PROMPT = `
당신은 Anki 학습 카드의 YAGNI(You Aren't Gonna Need It) 분석가입니다.

## 역할
카드에 포함된 Cloze 삭제({{cN::...}}) 중 학습 ROI가 낮은 항목을 식별합니다.
"이걸 암기하는 것보다 검색하는 게 빠르고 정확한가?"가 핵심 판단 기준입니다.

## YAGNI 판단 기준
1. **포트 번호·프로토콜 번호**: 실무에서 참조로 충분 (예: DNS 53, HTTP 80)
2. **특정 버전·날짜**: 빠르게 변하는 정보 (예: "Python 3.12에서 추가된...")
3. **구현 세부사항**: API 호출 한 번이면 확인 가능 (예: 함수 시그니처 암기)
4. **열거형 완전 나열**: 전체 목록 암기가 불필요 (예: HTTP 상태 코드 전체)
5. **도메인 무관 잡지식**: CS/프로그래밍과 관련 없는 부수 정보

## YAGNI가 아닌 것
- 핵심 개념·원리 (예: TCP 3-way handshake 과정)
- 자주 쓰이는 관용구 (예: Big-O 복잡도)
- 면접에서 물어볼 수 있는 기초 지식
- 디버깅 시 즉시 필요한 핵심 동작 원리

## 입력
카드 원문이 제공됩니다. Cloze 마크업({{cN::내용}})이 포함되어 있습니다.
각 Cloze의 번호(N)를 기준으로 YAGNI 여부를 판단하세요.

## 응답 형식 (JSON)
{
  "isYagni": true/false,
  "reason": "YAGNI 판단 근거 (한 문장)",
  "affectedClozes": [Cloze 번호들],
  "confidence": 0-100
}

isYagni가 false이면 affectedClozes는 빈 배열([])로 반환하세요.
`;

export interface YagniCheckOptions {
  modelId?: LLMModelId;
}

/**
 * 카드 YAGNI 감지
 */
export async function checkYagni(
  cardContent: string,
  options: YagniCheckOptions = {},
): Promise<YagniResult> {
  const cleanContent = cleanCardText(cardContent);

  const clozeMatches = cardContent.match(/\{\{c(\d+)::/g);
  const clozeNumbers = clozeMatches
    ? [...new Set(clozeMatches.map((m) => Number.parseInt(m.match(/\d+/)![0], 10)))]
    : [];

  // Cloze가 없는 카드는 LLM 호출 불필요 — 즉시 valid 반환
  if (clozeNumbers.length === 0) {
    return {
      status: "valid",
      type: "yagni",
      message: "Cloze가 없는 카드입니다",
      confidence: 100,
      details: { isYagni: false, reason: "", affectedClozes: [] },
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const resolvedModelId: LLMModelId = options.modelId ?? getDefaultModelId();
    const client = createLLMClient(resolvedModelId.provider);

    const prompt = `
${YAGNI_CHECK_PROMPT}

## 분석할 카드 내용:
${cardContent}

## 정제된 텍스트 (참고용):
${cleanContent}

## 카드에 존재하는 Cloze 번호: ${JSON.stringify(clozeNumbers)}
`;

    const llmResult = await client.generateContent(prompt, {
      responseMimeType: "application/json",
      maxOutputTokens: 2048,
      model: resolvedModelId.model,
    });

    const text = llmResult.text;
    const parsed = JSON.parse(text);

    // 타입 가드: LLM 응답을 신뢰하지 않고 각 필드를 안전하게 변환
    const isYagni = typeof parsed.isYagni === "boolean" ? parsed.isYagni : false;
    const reason = typeof parsed.reason === "string" ? parsed.reason : "";
    const rawClozes = Array.isArray(parsed.affectedClozes)
      ? parsed.affectedClozes.filter(
          (c: unknown) => typeof c === "number" && Number.isInteger(c) && clozeNumbers.includes(c),
        )
      : [];
    const affectedClozes: number[] = isYagni ? [...new Set<number>(rawClozes)] : [];
    // isYagni=true인데 affectedClozes가 비면 LLM 응답 불일치 → isYagni를 false로 override
    const resolvedIsYagni = isYagni && affectedClozes.length > 0;
    const rawConfidence = typeof parsed.confidence === "number" ? parsed.confidence : 80;

    // 상태 결정
    let status: YagniResult["status"] = "valid";
    if (resolvedIsYagni) {
      status = affectedClozes.length >= clozeNumbers.length ? "error" : "warning";
    }

    return {
      status,
      type: "yagni",
      message: getYagniMessage(status, resolvedIsYagni, affectedClozes.length, clozeNumbers.length),
      confidence: Math.min(100, Math.max(0, rawConfidence)),
      details: {
        isYagni: resolvedIsYagni,
        reason,
        affectedClozes,
      },
      timestamp: new Date().toISOString(),
      modelId: llmResult.modelId,
      tokenUsage: llmResult.tokenUsage,
      actualCost: llmResult.actualCost,
    };
  } catch (error) {
    console.error("YAGNI 감지 실패:", error);
    return {
      status: "unknown",
      type: "yagni",
      message: "YAGNI 감지를 수행할 수 없습니다.",
      confidence: 0,
      details: {
        isYagni: false,
        reason: "",
        affectedClozes: [],
      },
      timestamp: new Date().toISOString(),
    };
  }
}

function getYagniMessage(
  status: string,
  isYagni: boolean,
  affectedCount: number,
  totalCount: number,
): string {
  if (!isYagni) {
    return "학습 가치가 충분한 카드입니다";
  }
  switch (status) {
    case "warning":
      return `YAGNI Cloze ${affectedCount}개 감지 (전체 ${totalCount}개 중)`;
    case "error":
      return `카드 전체가 YAGNI — Cloze ${affectedCount}개 모두 학습 ROI 낮음`;
    default:
      return "분석 불가";
  }
}
