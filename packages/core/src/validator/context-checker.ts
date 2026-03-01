/**
 * 문맥 일관성 검사 - nid 링크로 연결된 카드 그룹의 논리적 일관성 검증
 *
 * 기능:
 * 1. nid 링크로 연결된 카드들 추출
 * 2. 관련 카드들의 내용을 Gemini에게 전달하여 논리적 일관성 검사
 * 3. 불일치 사항 보고
 */

import { findNotes, getNotesInfo, type NoteInfo } from "../anki/client.js";
import { createLLMClient, getDefaultModelId } from "../llm/factory.js";
import type { LLMModelId } from "../llm/types.js";
import { extractUniqueNids } from "../parser/nid-parser.js";
import type { ContextResult, Inconsistency } from "./types.js";

const CONTEXT_CHECK_PROMPT = `
당신은 지식 카드(Anki) 간의 논리적 일관성을 검증하는 전문가입니다.

## 역할
여러 학습 카드가 서로 링크로 연결되어 있을 때, 이들 간의 내용이 논리적으로 일관성 있는지 확인합니다.

## 검증 기준
1. **정의 일관성**: 같은 용어가 카드마다 다르게 정의되어 있지 않은가?
2. **수치 일관성**: 같은 값(버전, 숫자, 연도 등)이 일관되게 사용되었는가?
3. **계층 일관성**: 상위/하위 개념 관계가 올바르게 설정되었는가?
4. **논리적 연결**: 카드들이 서로 모순되는 내용을 담고 있지 않은가?
5. **참조 정확성**: 링크된 카드의 내용을 정확하게 참조하고 있는가?

## 주의사항
- 마크다운 문법(#, *, ::, {{c1::}})은 무시하고 내용만 검증
- nid 링크 형식: [제목|nid숫자] - 다른 카드로의 링크를 의미
- 각 카드는 [NOTE ID: 숫자] 형식으로 구분됨
- 경미한 문체/표현 차이는 불일치로 간주하지 않음

## 응답 형식 (JSON)
{
  "hasInconsistency": true/false,
  "inconsistencies": [
    {
      "description": "불일치 내용 설명",
      "conflictingNoteId": 해당 카드 ID (있는 경우),
      "severity": "low" | "medium" | "high"
    }
  ],
  "summary": "전체 분석 요약",
  "coherenceScore": 0-100
}
`;

export interface CardForContext {
  noteId: number;
  text: string;
  tags?: string[];
}

export interface ContextCheckOptions {
  includeReverseLinks?: boolean; // 역방향 링크도 검사할지 (다른 카드가 이 카드를 참조하는 경우)
  maxRelatedCards?: number; // 최대 관련 카드 수 (기본: 10)
  thorough?: boolean; // 심층 검증 (더 많은 토큰 사용)
  modelId?: LLMModelId;
}

/**
 * 카드에서 참조하는 nid들의 노트 정보 조회
 */
async function getLinkedNotes(noteIds: string[]): Promise<NoteInfo[]> {
  if (noteIds.length === 0) return [];

  const numericIds = noteIds
    .map((id) => parseInt(id, 10))
    .filter((id) => !Number.isNaN(id));
  if (numericIds.length === 0) return [];

  try {
    return await getNotesInfo(numericIds);
  } catch (error) {
    console.error("링크된 노트 조회 실패:", error);
    return [];
  }
}

/**
 * 역방향 링크 검색 (다른 카드들이 이 카드를 참조하는 경우)
 */
async function findReverseLinks(noteId: number): Promise<number[]> {
  try {
    // Anki 검색 쿼리로 nid 링크 검색
    const query = `"nid${noteId}"`;
    return await findNotes(query);
  } catch (error) {
    console.error("역방향 링크 검색 실패:", error);
    return [];
  }
}

/**
 * 카드 문맥 일관성 검사
 */
export async function checkContext(
  targetCard: CardForContext,
  options: ContextCheckOptions = {},
): Promise<ContextResult> {
  const maxRelatedCards = options.maxRelatedCards ?? 10;

  // 1. 카드에서 nid 링크 추출
  const linkedNids = extractUniqueNids(targetCard.text);

  // 2. 역방향 링크 검색 (옵션)
  let reverseNids: number[] = [];
  if (options.includeReverseLinks) {
    reverseNids = await findReverseLinks(targetCard.noteId);
    // 자기 자신 제외
    reverseNids = reverseNids.filter((id) => id !== targetCard.noteId);
  }

  // 3. 관련 카드가 없으면 일관성 검사 불필요
  const allRelatedNids = [
    ...linkedNids,
    ...reverseNids.map((id) => id.toString()),
  ];
  const uniqueRelatedNids = [...new Set(allRelatedNids)].slice(
    0,
    maxRelatedCards,
  );

  if (uniqueRelatedNids.length === 0) {
    return {
      status: "valid",
      type: "context",
      message: "연결된 카드가 없습니다.",
      confidence: 100,
      details: {
        inconsistencies: [],
        relatedCards: [],
      },
      timestamp: new Date().toISOString(),
    };
  }

  // 4. 관련 카드 정보 조회
  const linkedNotes = await getLinkedNotes(uniqueRelatedNids);

  if (linkedNotes.length === 0) {
    return {
      status: "warning",
      type: "context",
      message: "링크된 카드를 찾을 수 없습니다.",
      confidence: 50,
      details: {
        inconsistencies: [
          {
            description: `${uniqueRelatedNids.length}개의 링크된 카드를 찾을 수 없습니다. 삭제되었거나 잘못된 링크일 수 있습니다.`,
            severity: "medium",
          },
        ],
        relatedCards: uniqueRelatedNids.map((id) => parseInt(id, 10)),
      },
      timestamp: new Date().toISOString(),
    };
  }

  // 5. LLM에게 일관성 검사 요청
  const resolvedModelId: LLMModelId = options.modelId ?? getDefaultModelId();
  const client = createLLMClient(resolvedModelId.provider);

  // 카드 내용 정리
  const cardContents = [
    {
      noteId: targetCard.noteId,
      text: cleanContent(targetCard.text),
      isTarget: true,
    },
    ...linkedNotes.map((note) => ({
      noteId: note.noteId,
      text: cleanContent(note.fields.Text?.value || ""),
      isTarget: false,
    })),
  ];

  const cardsText = cardContents
    .map(
      (c) =>
        `[NOTE ID: ${c.noteId}${c.isTarget ? " (대상 카드)" : ""}]\n${c.text}`,
    )
    .join("\n\n---\n\n");

  const prompt = `
${CONTEXT_CHECK_PROMPT}

## 검증할 카드들:

${cardsText}

## 특별 주의사항:
- 대상 카드(NOTE ID: ${targetCard.noteId})를 중심으로 다른 카드들과의 일관성을 검사하세요.
- 불일치가 있다면 conflictingNoteId에 해당 카드의 ID를 명시하세요.
`;

  try {
    const llmResult = await client.generateContent(prompt, {
      responseMimeType: "application/json",
      maxOutputTokens: options.thorough ? 4096 : 2048,
      model: resolvedModelId.model,
    });

    const text = llmResult.text;
    const parsed = JSON.parse(text);

    // 결과 변환
    const inconsistencies: Inconsistency[] = (parsed.inconsistencies || []).map(
      (inc: {
        description?: string;
        conflictingNoteId?: number;
        severity?: string;
      }) => ({
        description: inc.description || "",
        conflictingNoteId: inc.conflictingNoteId,
        severity: inc.severity || "medium",
      }),
    );

    const hasInconsistency =
      parsed.hasInconsistency ?? inconsistencies.length > 0;
    const coherenceScore =
      parsed.coherenceScore ?? (hasInconsistency ? 70 : 100);

    // 상태 결정
    let status: ContextResult["status"] = "valid";
    if (inconsistencies.some((i) => i.severity === "high")) {
      status = "error";
    } else if (hasInconsistency) {
      status = "warning";
    }

    return {
      status,
      type: "context",
      message:
        parsed.summary || getStatusMessage(status, inconsistencies.length),
      confidence: coherenceScore,
      details: {
        inconsistencies,
        relatedCards: linkedNotes.map((n) => n.noteId),
      },
      timestamp: new Date().toISOString(),
      modelId: llmResult.modelId,
      tokenUsage: llmResult.tokenUsage,
      actualCost: llmResult.actualCost,
    };
  } catch (error) {
    console.error("문맥 일관성 검사 실패:", error);
    return {
      status: "unknown",
      type: "context",
      message: "문맥 일관성 검사를 수행할 수 없습니다.",
      confidence: 0,
      details: {
        inconsistencies: [],
        relatedCards: uniqueRelatedNids.map((id) => parseInt(id, 10)),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 텍스트 정규화 (Gemini 전달용)
 */
function cleanContent(text: string): string {
  return text
    .replace(/\{\{c\d+::([^}]+?)(?:::[^}]+)?\}\}/g, "$1") // Cloze 제거
    .replace(/<[^>]+>/g, " ") // HTML 태그 제거
    .replace(/:::\s*\w+[^\n]*\n?/g, "") // 컨테이너 시작 제거
    .replace(/^:::\s*$/gm, "") // 컨테이너 끝 제거
    .replace(/\s+/g, " ")
    .trim();
}

function getStatusMessage(status: string, count: number): string {
  switch (status) {
    case "valid":
      return "연결된 카드들과 일관성이 있습니다.";
    case "warning":
      return `${count}개의 잠재적 불일치가 발견되었습니다.`;
    case "error":
      return `${count}개의 심각한 불일치가 발견되었습니다.`;
    default:
      return "검증 불가";
  }
}

/**
 * 카드 그룹의 전체 일관성 분석
 * (여러 카드가 서로 연결된 그룹 전체를 분석)
 */
export async function analyzeCardGroup(
  cards: CardForContext[],
  options: ContextCheckOptions = {},
): Promise<{
  overallCoherence: number;
  inconsistencies: Array<Inconsistency & { sourceNoteId: number }>;
  groupStructure: Map<number, number[]>; // noteId -> linked noteIds
}> {
  const groupStructure = new Map<number, number[]>();
  const allInconsistencies: Array<Inconsistency & { sourceNoteId: number }> =
    [];

  // 각 카드의 링크 구조 분석
  for (const card of cards) {
    const linkedNids = extractUniqueNids(card.text);
    groupStructure.set(
      card.noteId,
      linkedNids.map((id) => parseInt(id, 10)),
    );
  }

  // 각 카드에 대해 일관성 검사
  for (const card of cards) {
    const result = await checkContext(card, options);
    if (result.details?.inconsistencies) {
      for (const inc of result.details.inconsistencies) {
        allInconsistencies.push({
          ...inc,
          sourceNoteId: card.noteId,
        });
      }
    }
  }

  // 전체 일관성 점수 계산
  const severityWeights = { low: 1, medium: 3, high: 5 };
  const totalWeight = allInconsistencies.reduce(
    (sum, inc) => sum + severityWeights[inc.severity],
    0,
  );
  const overallCoherence = Math.max(0, 100 - totalWeight * 5);

  return {
    overallCoherence,
    inconsistencies: allInconsistencies,
    groupStructure,
  };
}
