import { describe, expect, test } from "bun:test";
import { buildSplitPromptFromTemplate } from "../gemini/prompts.js";

describe("buildSplitPromptFromTemplate", () => {
  test("템플릿 변수 치환 후 응답 형식이 없으면 기본 형식을 자동 추가한다", () => {
    const prompt = buildSplitPromptFromTemplate(
      "노트 {{noteId}} / 본문 {{text}} / 태그 {{tags}}",
      101,
      "테스트 본문",
      ["tag-a", "tag-b"],
    );

    expect(prompt).toContain("노트 101 / 본문 테스트 본문 / 태그 tag-a, tag-b");
    expect(prompt).toContain("## 응답 형식 (JSON)");
  });

  test("응답 형식 문구가 이미 있으면 기본 형식을 중복 추가하지 않는다", () => {
    const template =
      "응답 형식: JSON 객체로만 반환하고 반드시 splitCards를 포함하세요.";

    const prompt = buildSplitPromptFromTemplate(template, 202, "본문");

    expect(prompt).toBe(template);
  });

  test("json 코드 펜스가 있으면 기본 형식을 중복 추가하지 않는다", () => {
    const template = '예시:\n```json\n{"shouldSplit": true}\n```';

    const prompt = buildSplitPromptFromTemplate(template, 303, "본문");

    expect(prompt).toBe(template);
  });

  test("JSON 단어가 일반 문맥으로만 등장하면 기본 형식을 자동 추가한다", () => {
    const template = "JSON 데이터를 비교 설명해 주세요. note=$" + "{noteId}";

    const prompt = buildSplitPromptFromTemplate(template, 404, "본문");
    const formatBlocks = prompt.match(/## 응답 형식 \(JSON\)/g) ?? [];

    expect(prompt).toContain("JSON 데이터를 비교 설명해 주세요. note=404");
    expect(formatBlocks).toHaveLength(1);
  });

  test("cardText 달러 별칭도 본문으로 치환된다", () => {
    const template =
      "note=$" + "{noteId} text=$" + "{cardText} tags=$" + "{tags}";

    const prompt = buildSplitPromptFromTemplate(template, 505, "본문", ["t1"]);
    const formatBlocks = prompt.match(/## 응답 형식 \(JSON\)/g) ?? [];

    expect(prompt).toContain("note=505 text=본문 tags=t1");
    expect(formatBlocks).toHaveLength(1);
  });
});
