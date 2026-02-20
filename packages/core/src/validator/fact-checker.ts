/**
 * 팩트 체크 - Gemini를 사용한 카드 내용 사실 검증
 */

import { GoogleGenAI } from "@google/genai";
import {
  assertExternalAIEnabled,
  sanitizeForExternalAI,
} from "../privacy/index.js";
import type { ClaimVerification, FactCheckResult } from "./types.js";

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

const FACT_CHECK_PROMPT = `
당신은 컴퓨터 과학(CS) 및 프로그래밍 분야의 팩트 체커입니다.

## 역할
학습 카드(Anki)의 내용이 사실에 기반한 정확한 정보인지 검증합니다.

## 검증 기준
1. **기술적 정확성**: 프로그래밍 언어, 프레임워크, 알고리즘 설명이 정확한가?
2. **용어 정확성**: 기술 용어가 올바르게 사용되었는가?
3. **버전/시기 정확성**: 특정 버전이나 시기에 대한 정보가 정확한가?
4. **개념 정확성**: CS 개념이 올바르게 설명되었는가?

## 주의사항
- 마크다운 문법(#, *, ::, {{c1::}})은 무시하고 내용만 검증
- 확실하지 않은 내용은 "unknown"으로 표시
- 틀린 내용이 있으면 올바른 정보 제공

## 응답 형식 (JSON)
{
  "claims": [
    {
      "claim": "검증할 주장",
      "isVerified": true/false,
      "confidence": 0-100,
      "correction": "수정 내용 (틀린 경우만)",
      "source": "참고 출처 (있는 경우)"
    }
  ],
  "overallAccuracy": 0-100,
  "summary": "전체 검증 요약"
}
`;

export interface FactCheckOptions {
  thorough?: boolean; // 심층 검증 (더 많은 토큰 사용)
}

/**
 * 카드 내용 팩트 체크
 */
export async function checkFacts(
  cardContent: string,
  options: FactCheckOptions = {},
): Promise<FactCheckResult> {
  assertExternalAIEnabled("validation");

  const client = getClient();

  // Cloze 마크업 제거하여 순수 텍스트 추출
  const cleanContent = cardContent
    .replace(/\{\{c\d+::([^}]+?)(?:::[^}]+)?\}\}/g, "$1") // Cloze 제거
    .replace(/<[^>]+>/g, " ") // HTML 태그 제거
    .replace(/:::\s*\w+[^\n]*\n?/g, "") // 컨테이너 시작 제거
    .replace(/^:::\s*$/gm, "") // 컨테이너 끝 제거
    .trim();
  const sanitizedContent = sanitizeForExternalAI(cleanContent, "validation");

  const prompt = `
${FACT_CHECK_PROMPT}

## 검증할 카드 내용:
${sanitizedContent}
`;

  try {
    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: options.thorough ? 4096 : 2048,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini 응답이 비어있습니다.");
    }

    const parsed = JSON.parse(text);

    // 결과 변환
    const claims: ClaimVerification[] = (parsed.claims || []).map(
      (c: {
        claim?: string;
        isVerified?: boolean;
        confidence?: number;
        correction?: string;
        source?: string;
      }) => ({
        claim: c.claim || "",
        isVerified: c.isVerified ?? true,
        confidence: c.confidence ?? 50,
        correction: c.correction,
        source: c.source,
      }),
    );

    const overallAccuracy =
      parsed.overallAccuracy ??
      (claims.length > 0
        ? Math.round(
            (claims.filter((c) => c.isVerified).length / claims.length) * 100,
          )
        : 100);

    // 상태 결정
    let status: FactCheckResult["status"] = "valid";
    if (overallAccuracy < 50) {
      status = "error";
    } else if (overallAccuracy < 80) {
      status = "warning";
    }

    return {
      status,
      type: "fact-check",
      message: parsed.summary || getStatusMessage(status, overallAccuracy),
      confidence: overallAccuracy,
      details: {
        claims,
        overallAccuracy,
        sources: claims.filter((c) => c.source).map((c) => c.source as string),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("팩트 체크 실패:", error);
    return {
      status: "unknown",
      type: "fact-check",
      message: "팩트 체크를 수행할 수 없습니다.",
      confidence: 0,
      details: {
        claims: [],
        overallAccuracy: 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

function getStatusMessage(status: string, accuracy: number): string {
  switch (status) {
    case "valid":
      return `내용이 정확합니다 (정확도: ${accuracy}%)`;
    case "warning":
      return `일부 내용 검증 필요 (정확도: ${accuracy}%)`;
    case "error":
      return `부정확한 내용 발견 (정확도: ${accuracy}%)`;
    default:
      return "검증 불가";
  }
}
