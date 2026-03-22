import { describe, expect, test } from "bun:test";
import {
  SYSTEM_PROMPT,
  buildOptimizationPrompt,
  buildOptimizationPromptFromTemplate,
} from "../gemini/prompts.js";

describe("SYSTEM_PROMPT", () => {
  test("contains mobile-friendly guidance, not atomic", () => {
    expect(SYSTEM_PROMPT).toContain("모바일");
    expect(SYSTEM_PROMPT).not.toContain("원자적 단위");
    expect(SYSTEM_PROMPT).not.toContain("40~60자");
  });

  test("contains operation guide (split/compact/skip)", () => {
    expect(SYSTEM_PROMPT).toContain("split");
    expect(SYSTEM_PROMPT).toContain("compact");
    expect(SYSTEM_PROMPT).toContain("skip");
  });

  test("preserves binary pattern hints", () => {
    expect(SYSTEM_PROMPT).toContain("있다 | 없다");
  });

  test("does not contain old char length table", () => {
    expect(SYSTEM_PROMPT).not.toContain("40~80자");
    expect(SYSTEM_PROMPT).not.toContain("120자");
    expect(SYSTEM_PROMPT).not.toContain("카드 길이 기준");
  });

  test("does not contain old Self-Correction loop", () => {
    expect(SYSTEM_PROMPT).not.toContain("Self-Correction 루프");
    expect(SYSTEM_PROMPT).not.toContain("글자수 확인");
  });

  test("does not enforce single cloze per card", () => {
    expect(SYSTEM_PROMPT).not.toContain("카드당 1개 Cloze");
    expect(SYSTEM_PROMPT).not.toContain("카드당 **1개 Cloze**");
  });

  test("contains compact instructions (audit report)", () => {
    expect(SYSTEM_PROMPT).toContain("auditReport");
    expect(SYSTEM_PROMPT).toContain("preserved");
    expect(SYSTEM_PROMPT).toContain("removed");
    expect(SYSTEM_PROMPT).toContain("transformed");
  });

  test("preserves HTML/Callout/Toggle/Image preservation rules", () => {
    expect(SYSTEM_PROMPT).toContain("HTML 인라인 스타일");
    expect(SYSTEM_PROMPT).toContain("Callout");
    expect(SYSTEM_PROMPT).toContain("::: toggle");
    expect(SYSTEM_PROMPT).toContain("nid");
  });

  test("preserves No Yes/No, No Example Trap rules", () => {
    expect(SYSTEM_PROMPT).toContain("역방향 질문");
    expect(SYSTEM_PROMPT).toContain("긍정형");
  });

  test("preserves recommended principles", () => {
    expect(SYSTEM_PROMPT).toContain("Why > What");
    expect(SYSTEM_PROMPT).toContain("Two-way");
    expect(SYSTEM_PROMPT).toContain("Connections");
  });
});

describe("buildOptimizationPrompt", () => {
  test("includes noteId and card text", () => {
    const prompt = buildOptimizationPrompt(12345, "테스트 카드");
    expect(prompt).toContain("12345");
    expect(prompt).toContain("테스트 카드");
  });

  test("contains operation discriminated union schema", () => {
    const prompt = buildOptimizationPrompt(12345, "text");
    expect(prompt).toContain('"operation"');
    expect(prompt).toContain("compact");
    expect(prompt).toContain("auditReport");
  });

  test("does not contain old shouldSplit schema", () => {
    const prompt = buildOptimizationPrompt(12345, "text");
    expect(prompt).not.toContain("shouldSplit");
  });

  test("contains binary pattern hints", () => {
    const prompt = buildOptimizationPrompt(12345, "text");
    expect(prompt).toContain("있다 | 없다");
  });

  test("contains mobile-friendly language", () => {
    const prompt = buildOptimizationPrompt(12345, "text");
    expect(prompt).toContain("모바일");
  });
});

describe("buildOptimizationPromptFromTemplate", () => {
  test("substitutes template variables", () => {
    const result = buildOptimizationPromptFromTemplate(
      "noteId={{noteId}} text={{text}} tags={{tags}}",
      12345,
      "card text",
      ["tag1", "tag2"],
    );
    expect(result).toContain("noteId=12345");
    expect(result).toContain("text=card text");
    expect(result).toContain("tags=tag1, tag2");
  });

  test("appends OPTIMIZATION_RESPONSE_FORMAT when template lacks JSON schema", () => {
    const result = buildOptimizationPromptFromTemplate("plain template", 1, "t");
    expect(result).toContain('"operation"');
    expect(result).toContain("auditReport");
  });

  test("does not append format when template already has JSON schema", () => {
    const template = '예시:\n```json\n{"operation": "split"}\n```';
    const result = buildOptimizationPromptFromTemplate(template, 1, "t");
    expect(result).toBe(template);
  });

  test("does not append format when template contains 응답 형식", () => {
    const template = "응답 형식: JSON 객체로만 반환하세요.";
    const result = buildOptimizationPromptFromTemplate(template, 1, "t");
    expect(result).toBe(template);
  });
});
