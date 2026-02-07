import { describe, expect, test } from "bun:test";
import { preprocessTextForEmbedding } from "../embedding/client.js";

describe("preprocessTextForEmbedding", () => {
  test("Cloze 구문에서 내용만 추출", () => {
    const text =
      "{{c1::DNS}}는 도메인 이름을 {{c2::IP 주소::힌트}}로 변환합니다.";
    const result = preprocessTextForEmbedding(text);
    expect(result).toBe("DNS는 도메인 이름을 IP 주소로 변환합니다.");
  });

  test("HTML 태그 제거", () => {
    const text =
      '<b>중요:</b> 이것은 <span style="color:red">빨간</span> 텍스트입니다.';
    const result = preprocessTextForEmbedding(text);
    expect(result).toBe("중요: 이것은 빨간 텍스트입니다.");
  });

  test("컨테이너 구문 제거", () => {
    const text = `::: tip 팁
내용입니다.
:::`;
    const result = preprocessTextForEmbedding(text);
    expect(result).toBe("내용입니다.");
  });

  test("nid 링크에서 제목만 추출", () => {
    const text = "[DNS 레코드|nid1234567890123]를 참고하세요.";
    const result = preprocessTextForEmbedding(text);
    expect(result).toBe("DNS 레코드를 참고하세요.");
  });

  test("복합 텍스트 처리", () => {
    const text = `#### {{c1::DNS}} 개요
::: link 참고
[도메인 구조|nid1234567890123]
:::

<b>핵심</b>: DNS는 {{c2::도메인 이름::도메인?}}을 IP로 변환합니다.`;

    const result = preprocessTextForEmbedding(text);
    expect(result).toContain("DNS");
    expect(result).toContain("도메인 이름");
    expect(result).not.toContain("{{");
    expect(result).not.toContain("nid");
    expect(result).not.toContain("<b>");
    expect(result).not.toContain(":::");
  });

  test("빈 텍스트는 빈 문자열 반환", () => {
    expect(preprocessTextForEmbedding("")).toBe("");
    expect(preprocessTextForEmbedding("   ")).toBe("");
  });

  test("연속 공백 정리", () => {
    const text = "단어1     단어2\n\n\n단어3";
    const result = preprocessTextForEmbedding(text);
    expect(result).toBe("단어1 단어2 단어3");
  });
});
