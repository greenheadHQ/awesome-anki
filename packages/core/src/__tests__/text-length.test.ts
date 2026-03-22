import { describe, expect, test } from "bun:test";
import { computeTextLength } from "../parser/text-length.js";

describe("computeTextLength", () => {
	test("returns length of plain text", () => {
		expect(computeTextLength("hello world")).toBe(11);
	});

	test("strips HTML tags", () => {
		expect(
			computeTextLength('<span style="color:red">빨간 텍스트</span>'),
		).toBe(6);
	});

	test("strips nested HTML", () => {
		expect(computeTextLength("<b><u>중첩</u></b> 태그")).toBe(5);
	});

	test("normalizes cloze markers to answer only", () => {
		expect(
			computeTextLength("DNS는 {{c1::Domain Name System::약자}} 이다"),
		).toBe("DNS는 Domain Name System 이다".length);
	});

	test("handles cloze without hint", () => {
		expect(computeTextLength("값은 {{c1::42}}이다")).toBe("값은 42이다".length);
	});

	test("strips callout markers", () => {
		expect(computeTextLength("::: tip\n중요한 내용\n:::")).toBe(6);
	});

	test("strips toggle markers", () => {
		expect(computeTextLength("::: toggle todo 할일\n내용\n:::")).toBe(5);
	});

	test("normalizes whitespace", () => {
		expect(computeTextLength("a   b\n\n\nc")).toBe(5);
	});

	test("handles table HTML", () => {
		const html = "<table><tr><td>셀1</td><td>셀2</td></tr></table>";
		expect(computeTextLength(html)).toBe(4);
	});

	test("returns 0 for empty string", () => {
		expect(computeTextLength("")).toBe(0);
	});

	test("handles complex real-world card", () => {
		const card =
			'[DNS > Record] A 레코드는 도메인을 {{c1::IPv4::IPv4 | IPv6}} 주소로 매핑한다. <span style="color:blue">중요</span>';
		const result = computeTextLength(card);
		expect(result).toBe(
			"[DNS > Record] A 레코드는 도메인을 IPv4 주소로 매핑한다. 중요".length,
		);
	});
});
