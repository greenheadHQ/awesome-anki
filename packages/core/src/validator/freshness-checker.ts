/**
 * 최신성 검사 - 기술 변화로 인한 outdated 내용 감지
 */

import { GoogleGenAI } from "@google/genai";
import {
  assertExternalAIEnabled,
  sanitizeForExternalAI,
} from "../privacy/index.js";
import type { FreshnessResult, OutdatedItem } from "./types.js";

const MODEL_NAME = "gemini-2.0-flash";

let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

const FRESHNESS_CHECK_PROMPT = `
당신은 컴퓨터 과학(CS) 및 프로그래밍 분야의 기술 트렌드 전문가입니다.

## 역할
학습 카드(Anki)의 내용이 최신 정보인지 검사합니다.

## 검사 기준
1. **버전 정보**: 언급된 소프트웨어/라이브러리 버전이 최신인가?
2. **권장 사항**: 더 이상 권장되지 않는 방법이 있는가? (deprecated)
3. **기술 변화**: 해당 기술이 여전히 현업에서 사용되는가?
4. **보안 이슈**: 보안상 문제가 있는 오래된 방법이 있는가?

## 주의사항
- 기본 CS 원리 (알고리즘, 자료구조, 네트워크 기초)는 시대를 초월하므로 outdated로 표시하지 않음
- 특정 프레임워크, 라이브러리, 도구에 대한 정보만 최신성 검사
- 마크다운 문법은 무시하고 내용만 검사

## 응답 형식 (JSON)
{
  "outdatedItems": [
    {
      "content": "outdated 내용",
      "reason": "outdated 이유",
      "currentInfo": "현재 권장 정보",
      "severity": "low|medium|high"
    }
  ],
  "isFresh": true/false,
  "freshness": 0-100,
  "summary": "전체 검사 요약"
}
`;

export interface FreshnessCheckOptions {
  checkDate?: string; // 기준 날짜 (기본: 현재)
}

/**
 * 카드 내용 최신성 검사
 */
export async function checkFreshness(
  cardContent: string,
  options: FreshnessCheckOptions = {},
): Promise<FreshnessResult> {
  assertExternalAIEnabled("validation");

  const client = getClient();

  // Cloze 마크업 제거
  const cleanContent = cardContent
    .replace(/\{\{c\d+::([^}]+?)(?:::[^}]+)?\}\}/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/:::\s*\w+[^\n]*\n?/g, "")
    .replace(/^:::\s*$/gm, "")
    .trim();
  const sanitizedContent = sanitizeForExternalAI(cleanContent, "validation");

  const currentDate =
    options.checkDate || new Date().toISOString().split("T")[0];

  const prompt = `
${FRESHNESS_CHECK_PROMPT}

## 기준 날짜: ${currentDate}

## 검사할 카드 내용:
${sanitizedContent}
`;

  try {
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini 응답이 비어있습니다.");
    }

    const parsed = JSON.parse(text);

    // 결과 변환
    const outdatedItems: OutdatedItem[] = (parsed.outdatedItems || []).map(
      (item: {
        content?: string;
        reason?: string;
        currentInfo?: string;
        severity?: string;
      }) => ({
        content: item.content || "",
        reason: item.reason || "",
        currentInfo: item.currentInfo,
        severity: item.severity || "low",
      }),
    );

    const freshness = parsed.freshness ?? (parsed.isFresh ? 100 : 50);

    // 상태 결정
    let status: FreshnessResult["status"] = "valid";
    const highSeverityCount = outdatedItems.filter(
      (i) => i.severity === "high",
    ).length;
    const mediumSeverityCount = outdatedItems.filter(
      (i) => i.severity === "medium",
    ).length;

    if (highSeverityCount > 0) {
      status = "error";
    } else if (mediumSeverityCount > 0 || freshness < 70) {
      status = "warning";
    }

    // 권장 액션 결정
    let recommendedAction: string | undefined;
    if (status === "error") {
      recommendedAction = "카드 내용을 최신 정보로 업데이트하세요.";
    } else if (status === "warning") {
      recommendedAction = "일부 내용 검토가 필요합니다.";
    }

    return {
      status,
      type: "freshness",
      message: parsed.summary || getStatusMessage(status, outdatedItems.length),
      confidence: freshness,
      details: {
        outdatedItems,
        lastKnownUpdate: currentDate,
        recommendedAction,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("최신성 검사 실패:", error);
    return {
      status: "unknown",
      type: "freshness",
      message: "최신성 검사를 수행할 수 없습니다.",
      confidence: 0,
      details: {
        outdatedItems: [],
      },
      timestamp: new Date().toISOString(),
    };
  }
}

function getStatusMessage(status: string, outdatedCount: number): string {
  switch (status) {
    case "valid":
      return "내용이 최신 상태입니다.";
    case "warning":
      return `${outdatedCount}개 항목 검토 필요`;
    case "error":
      return `${outdatedCount}개 항목 업데이트 필요`;
    default:
      return "검사 불가";
  }
}
