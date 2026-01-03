/**
 * ::: 컨테이너 구문 파서 (상태 머신 방식)
 *
 * 지원 컨테이너:
 * - Callout: ::: tip, ::: warning, ::: error, ::: note, ::: link
 * - Toggle: ::: toggle [type] [title]
 */

export type ContainerType = 'tip' | 'warning' | 'error' | 'note' | 'link' | 'toggle';

export interface ContainerBlock {
  type: ContainerType;
  toggleType?: string;  // toggle의 경우: tip, warning, error, note, todo
  title?: string;       // toggle의 제목
  content: string;
  startLine: number;
  endLine: number;
  raw: string;          // 원본 텍스트 (:::...:::)
}

interface ParserState {
  depth: number;
  stack: Partial<ContainerBlock>[];
  lineNumber: number;
}

// ::: 시작 패턴
const CONTAINER_START_REGEX = /^:::\s*(tip|warning|error|note|link|toggle)(?:\s+(.*))?$/;
// ::: 종료 패턴
const CONTAINER_END_REGEX = /^:::$/;

/**
 * 컨테이너 블록 파싱
 */
export function parseContainers(content: string): ContainerBlock[] {
  // HTML <br> 태그를 줄바꿈으로 변환하여 처리
  const normalizedContent = content.replace(/<br\s*\/?>/gi, '\n');
  const lines = normalizedContent.split('\n');

  const state: ParserState = {
    depth: 0,
    stack: [],
    lineNumber: 0,
  };

  const result: ContainerBlock[] = [];
  const contentLines: string[][] = []; // 각 블록의 내용 라인들

  for (const line of lines) {
    state.lineNumber++;
    const trimmedLine = line.trim();

    // ::: 시작 체크
    const startMatch = trimmedLine.match(CONTAINER_START_REGEX);
    if (startMatch) {
      const [, type, rest] = startMatch;

      const block: Partial<ContainerBlock> = {
        type: type as ContainerType,
        startLine: state.lineNumber,
      };

      // toggle인 경우 추가 파싱
      if (type === 'toggle' && rest) {
        const parts = rest.trim().split(/\s+/);
        if (parts.length > 0) {
          // 첫 번째 단어가 알려진 타입인지 확인
          const knownTypes = ['tip', 'warning', 'error', 'note', 'todo'];
          if (knownTypes.includes(parts[0])) {
            block.toggleType = parts[0];
            block.title = parts.slice(1).join(' ') || undefined;
          } else {
            // 타입이 아니면 전체를 제목으로
            block.title = rest.trim();
          }
        }
      }

      state.stack.push(block);
      contentLines.push([]);
      state.depth++;
      continue;
    }

    // ::: 종료 체크
    if (CONTAINER_END_REGEX.test(trimmedLine) && state.depth > 0) {
      const block = state.stack.pop();
      const blockContent = contentLines.pop();
      state.depth--;

      if (block && blockContent) {
        const endLine = state.lineNumber;
        const rawContent = blockContent.join('\n');

        result.push({
          type: block.type!,
          toggleType: block.toggleType,
          title: block.title,
          content: rawContent,
          startLine: block.startLine!,
          endLine,
          raw: `:::${block.type}${block.toggleType ? ' ' + block.toggleType : ''}${block.title ? ' ' + block.title : ''}\n${rawContent}\n:::`,
        });
      }
      continue;
    }

    // 현재 블록 내용에 추가
    if (state.depth > 0 && contentLines.length > 0) {
      contentLines[contentLines.length - 1].push(line);
    }
  }

  return result;
}

/**
 * 컨테이너 블록이 todo 상태인지 확인
 */
export function isTodoContainer(block: ContainerBlock): boolean {
  return block.type === 'toggle' && block.toggleType === 'todo';
}

/**
 * 컨테이너 블록이 link 타입인지 확인
 */
export function isLinkContainer(block: ContainerBlock): boolean {
  return block.type === 'link';
}

/**
 * HTML에서 컨테이너 블록 추출 (원본 HTML 유지)
 */
export function extractContainersFromHtml(html: string): {
  containers: ContainerBlock[];
  plainText: string;
} {
  const containers = parseContainers(html);

  // 컨테이너 외부 텍스트 추출
  let plainText = html;
  for (const container of containers) {
    plainText = plainText.replace(container.raw, '');
  }

  return { containers, plainText };
}
