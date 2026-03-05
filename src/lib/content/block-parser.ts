/**
 * Block parser — detects structured content blocks in AI output.
 * Supports :::prediction, :::journey, :::dialogue, :::comparison blocks.
 *
 * AI outputs these using fenced directives:
 *
 * :::prediction
 * {"question":"...","context":"...","options":["A","B","C","D"],"answerIndex":2,"explanation":"..."}
 * :::
 *
 * :::journey
 * {"narrator":"Router","narrative":"我是Router...","technical":"Router模块负责..."}
 * :::
 *
 * :::dialogue
 * {"speakers":[{"name":"Router","lines":["你好..."]},{"name":"Handler","lines":["收到..."]}],"annotation":"技术注释..."}
 * :::
 *
 * :::comparison
 * {"title":"方案对比","schemes":[{"name":"A","pros":["..."],"cons":["..."]},{"name":"B","pros":["..."],"cons":["..."]}]}
 * :::
 */

export type BlockType = "prediction" | "journey" | "dialogue" | "comparison" | "counterfactual" | "archaeology";

export interface ParsedBlock {
  type: BlockType;
  data: unknown;
  raw: string;
}

export interface ContentSegment {
  type: "text" | "block";
  content?: string;
  block?: ParsedBlock;
}

const BLOCK_REGEX = /:::(prediction|journey|dialogue|comparison|counterfactual|archaeology)\s*\n([\s\S]*?)\n:::/g;

/**
 * Parse AI message content into segments of plain text and structured blocks.
 */
export function parseContentBlocks(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  const matches = content.matchAll(BLOCK_REGEX);

  for (const match of matches) {
    const matchIndex = match.index!;

    // Text before the block
    if (matchIndex > lastIndex) {
      const text = content.slice(lastIndex, matchIndex).trim();
      if (text) {
        segments.push({ type: "text", content: text });
      }
    }

    const blockType = match[1] as BlockType;
    const blockBody = match[2].trim();

    try {
      const data = JSON.parse(blockBody);
      segments.push({
        type: "block",
        block: { type: blockType, data, raw: blockBody },
      });
    } catch {
      // If JSON parse fails, treat as text
      segments.push({ type: "text", content: match[0] });
    }

    lastIndex = matchIndex + match[0].length;
  }

  // Remaining text after last block
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      segments.push({ type: "text", content: text });
    }
  }

  // If no blocks found, return single text segment
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: "text", content: content.trim() });
  }

  return segments;
}

/**
 * Quick check if content contains any structured blocks (for perf — avoid parsing if none).
 */
export function hasStructuredBlocks(content: string): boolean {
  return content.includes(":::prediction") ||
    content.includes(":::journey") ||
    content.includes(":::dialogue") ||
    content.includes(":::comparison") ||
    content.includes(":::counterfactual") ||
    content.includes(":::archaeology");
}
