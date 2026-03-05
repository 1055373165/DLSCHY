/**
 * System Prompt 加载器
 * 从 Markdown 文件加载 System Prompt，提取最终文档部分（Part B）
 */

import { readFileSync } from "fs";
import { join } from "path";

let cachedPrompt: string | null = null;

export function loadSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt;

  const promptPath = join(
    process.cwd(),
    "..",
    "prompt",
    "SYSTEM_PROMPT_OPENSOURCE_LEARNING.md"
  );

  try {
    const raw = readFileSync(promptPath, "utf-8");

    // Extract Part B (final assembled document) — starts after "# Part B"
    const partBMarker = "# 最终组装文档";
    const partBIndex = raw.indexOf(partBMarker);

    if (partBIndex !== -1) {
      cachedPrompt = raw.slice(partBIndex);
    } else {
      // Fallback: use the entire file
      cachedPrompt = raw;
    }

    return cachedPrompt;
  } catch (error) {
    console.error("Failed to load system prompt:", error);
    throw new Error(
      "System prompt file not found. Expected at: " + promptPath
    );
  }
}

export function clearPromptCache(): void {
  cachedPrompt = null;
}
