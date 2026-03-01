/**
 * Anki 카드 렌더러 - templates/front.html의 파싱 로직 재사용
 *
 * markdown-it + 플러그인으로 Anki 템플릿과 동일한 렌더링
 */

import hljs from "highlight.js";
import MarkdownIt from "markdown-it";
import markdownItContainer from "markdown-it-container";
import markdownItMark from "markdown-it-mark";

// markdown-it 인스턴스 캐싱
let mdInstance: MarkdownIt | null = null;

/**
 * Callout 이모지 반환
 */
function getCalloutEmoji(type: string): string {
  switch (type) {
    case "tip":
      return "💡";
    case "warning":
      return "🚧";
    case "error":
      return "🚨";
    case "note":
      return "📝";
    case "link":
      return "🔗";
    default:
      return "";
  }
}

/**
 * markdown-it 렌더러 생성 (templates/front.html의 getMarkdownRenderer() 동일)
 */
export function getMarkdownRenderer(): MarkdownIt {
  if (mdInstance) {
    return mdInstance;
  }

  const md = new MarkdownIt({
    typographer: true,
    html: true,
    breaks: true, // <br> 태그를 줄바꿈으로 처리
    highlight: (str: string, lang: string) => {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch {
          // 무시
        }
      }
      return ""; // 기본 escaping 사용
    },
  }).use(markdownItMark);

  // Callout 컨테이너 (::: tip, warning, error, note, link)
  const calloutTypes = ["tip", "warning", "error", "note", "link"];

  calloutTypes.forEach((type) => {
    md.use(markdownItContainer, type, {
      validate: (params: string) => params.trim().match(new RegExp(`^${type}(\\s+(.*))?$`)),
      render: (tokens: { info: string; nesting: number }[], idx: number) => {
        const m = tokens[idx].info.trim().match(new RegExp(`^${type}(\\s+(.*))?$`));
        if (tokens[idx].nesting === 1) {
          const title = m?.[2]
            ? `<strong>${getCalloutEmoji(type)} ${md.utils.escapeHtml(m[2])}</strong>`
            : "";
          return `<div class="callout ${type}">${title}`;
        } else {
          return "</div>\n";
        }
      },
    });
  });

  // Toggle 컨테이너 (::: toggle [type] [title])
  md.use(markdownItContainer, "toggle", {
    validate: (params: string) => params.trim().match(/^toggle(\s+(.*))?$/),
    render: (tokens: { info: string; nesting: number }[], idx: number) => {
      const m = tokens[idx].info.trim().match(/^toggle(\s+(.*))?$/);
      if (tokens[idx].nesting === 1) {
        // 타입과 제목 분리
        const restText = m?.[2] ? m[2].trim() : "";
        const toggleTypes = ["tip", "warning", "error", "note", "todo"];
        let toggleType = "";
        let title = "정보";

        if (restText) {
          const firstWord = restText.split(/\s+/)[0];
          if (toggleTypes.includes(firstWord)) {
            toggleType = firstWord;
            title = restText.substring(firstWord.length).trim() || "정보";
          } else {
            title = restText;
          }
        }

        const typeClass = toggleType ? ` ${toggleType}` : "";
        const renderedTitle = md.renderInline(title);

        return `<details class="toggle${typeClass}">
          <summary class="toggle-header">
            <span class="toggle-arrow"></span>
            <span class="toggle-title">${renderedTitle}</span>
          </summary>
          <div class="toggle-content">`;
      } else {
        return "</div></details>\n";
      }
    },
  });

  mdInstance = md;
  return md;
}

/**
 * nid 링크 처리
 * [제목|nid1234567890123] -> 클릭 가능한 링크
 */
export function processNidLinks(html: string): string {
  return html.replace(/\[((?:[^[]|\\\[)*)\|nid(\d{13})\]/g, (_match, title, nid) => {
    const cleanTitle = title.replace(/\\\[/g, "[");
    return `<a href="#" class="nid-link" data-nid="${nid}" title="Note ID: ${nid}">${cleanTitle}</a>`;
  });
}

/**
 * Cloze 처리 (표시용)
 * {{c1::내용::힌트}} -> <span class="cloze">내용</span>
 */
export function processCloze(html: string, showContent: boolean = true): string {
  // {{c숫자::내용::힌트?}} 패턴
  const clozePattern = /\{\{c(\d+)::([^}]*?)(?:::([^}]*?))?\}\}/g;

  return html.replace(clozePattern, (_match, num, content, hint) => {
    if (showContent) {
      return `<span class="cloze" data-cloze="${num}">${content}</span>`;
    } else {
      return `<span class="cloze cloze-hidden" data-cloze="${num}">${hint || "[...]"}</span>`;
    }
  });
}

/**
 * 이미지 경로를 API 프록시로 변환
 * <img src="file.png"> -> <img src="/api/media/file.png">
 */
export function processImages(html: string): string {
  return html.replace(/<img\s+src="([^"]+)"/gi, (match, src) => {
    if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("/api/")) {
      return match;
    }
    return `<img src="/api/media/${encodeURIComponent(src)}"`;
  });
}

/**
 * HTML 전처리 (Anki 특수 형식 처리)
 */
export function preprocessAnkiHtml(text: string): string {
  let processed = text;

  // &nbsp;를 일반 공백으로 변환
  processed = processed.replace(/&nbsp;/gi, " ");

  // 이스케이프된 <br> 태그 처리 (&lt;br&gt;)
  processed = processed.replace(/&lt;br\s*\/?&gt;/gi, "\n");

  // <br> 태그를 줄바꿈으로 변환 (markdown-it가 처리하도록)
  // 다양한 형태의 <br> 처리: <br>, <br/>, <br />, <BR> 등
  processed = processed.replace(/<br\s*\/?>/gi, "\n");

  // 연속된 줄바꿈을 정리 (3개 이상은 2개로)
  processed = processed.replace(/\n{3,}/g, "\n\n");

  return processed;
}

/**
 * 마크다운 렌더링 후 후처리
 */
export function postprocessHtml(html: string): string {
  let processed = html;

  // 텍스트로 남은 <br> 문자열을 실제 <br> 태그로 변환
  // (이스케이프된 &lt;br&gt;는 건드리지 않음)
  processed = processed.replace(/(?<!&lt;)br(?!&gt;)/g, (match, offset, str) => {
    // 앞뒤로 < > 가 있는지 확인
    const before = str.charAt(offset - 1);
    const after = str.charAt(offset + 2);
    if (before === "<" && after === ">") {
      return "br"; // 이미 태그 형태이면 그대로
    }
    return match;
  });

  return processed;
}

/**
 * 전체 렌더링 파이프라인
 */
export function renderAnkiContent(content: string): string {
  const md = getMarkdownRenderer();

  // 1. HTML 전처리
  let processed = preprocessAnkiHtml(content);

  // 2. Cloze 처리 (마크다운 파싱 전에)
  processed = processCloze(processed, true);

  // 3. nid 링크 처리 (마크다운 파싱 전에)
  processed = processNidLinks(processed);

  // 4. 마크다운 렌더링
  processed = md.render(processed);

  // 5. 이미지 경로 변환
  processed = processImages(processed);

  return processed;
}
