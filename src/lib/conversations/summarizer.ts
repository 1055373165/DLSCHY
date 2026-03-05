/**
 * 对话自动摘要（Phase 5.4）
 * 
 * 每 10 条消息自动压缩旧消息为摘要，控制上下文窗口大小。
 * 策略：保留最近 6 条消息完整内容，将更早的消息压缩为摘要。
 */

const SUMMARY_THRESHOLD = 10;
const KEEP_RECENT = 6;

export interface ConversationSummary {
  id: string;
  content: string;
  coveredMessageIds: string[];
  createdAt: number;
}

interface SummarizableMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Check whether auto-summarization should trigger.
 */
export function shouldSummarize(
  messageCount: number,
  existingSummaryCount: number
): boolean {
  // Trigger every SUMMARY_THRESHOLD messages, accounting for already-summarized batches
  const unsummarizedCount = messageCount - existingSummaryCount * SUMMARY_THRESHOLD;
  return unsummarizedCount >= SUMMARY_THRESHOLD;
}

/**
 * Build a local summary from messages without calling AI.
 * Extracts key user questions and AI answer highlights.
 */
export function buildLocalSummary(messages: SummarizableMessage[]): string {
  if (messages.length === 0) return "";

  const parts: string[] = [];
  parts.push(`[对话摘要，覆盖 ${messages.length} 条消息]`);

  for (const m of messages) {
    if (m.role === "user") {
      const short = m.content.length > 120
        ? m.content.slice(0, 120) + "..."
        : m.content;
      parts.push(`- 用户问: ${short}`);
    } else if (m.content) {
      // Extract first meaningful line from assistant response
      const lines = m.content.split("\n").filter((l) => l.trim().length > 0);
      const firstLine = lines[0] || "";
      const short = firstLine.length > 150
        ? firstLine.slice(0, 150) + "..."
        : firstLine;
      parts.push(`- AI答: ${short}`);
    }
  }

  return parts.join("\n");
}

/**
 * Request AI-generated summary via /api/chat (non-streaming).
 * Falls back to local summary on failure.
 */
export async function requestAISummary(
  messages: SummarizableMessage[]
): Promise<string> {
  const localSummary = buildLocalSummary(messages);

  try {
    const compressed = messages.map((m) => ({
      role: m.role,
      content: m.content.slice(0, 300),
    }));

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          ...compressed,
          {
            role: "user",
            content:
              "请用3-5个要点总结以上对话的关键内容，包括讨论的主要文件、代码概念和结论。格式：每行一个要点，以「-」开头。控制在200字以内。",
          },
        ],
        context: {
          projectName: "summary-generation",
          viewMode: "expert",
        },
      }),
    });

    if (!response.ok) return localSummary;

    // Read SSE stream to get full response
    const reader = response.body?.getReader();
    if (!reader) return localSummary;

    const decoder = new TextDecoder();
    let buffer = "";
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) result += parsed.content;
        } catch {
          // ignore parse errors
        }
      }
    }

    return result || localSummary;
  } catch {
    return localSummary;
  }
}

/**
 * Prepare messages for sending to AI, replacing old messages with summary.
 * Returns the condensed message array.
 */
export function condenseMessages(
  messages: SummarizableMessage[],
  summaries: ConversationSummary[]
): SummarizableMessage[] {
  if (summaries.length === 0 || messages.length <= KEEP_RECENT) {
    return messages;
  }

  // Build a set of all message IDs covered by summaries
  const coveredIds = new Set<string>();
  for (const s of summaries) {
    for (const id of s.coveredMessageIds) {
      coveredIds.add(id);
    }
  }

  // Create summary message(s) to prepend
  const summaryMessages: SummarizableMessage[] = summaries.map((s) => ({
    id: `summary-${s.id}`,
    role: "assistant" as const,
    content: `[之前对话的摘要]\n${s.content}`,
  }));

  // Keep only uncovered messages (recent ones)
  const recentMessages = messages.filter((m) => !coveredIds.has(m.id));

  return [...summaryMessages, ...recentMessages];
}

/**
 * Get the messages that should be summarized (older ones, not in recent window).
 */
export function getMessagesToSummarize(
  messages: SummarizableMessage[],
  existingSummaries: ConversationSummary[]
): SummarizableMessage[] {
  // Get IDs already covered
  const coveredIds = new Set<string>();
  for (const s of existingSummaries) {
    for (const id of s.coveredMessageIds) {
      coveredIds.add(id);
    }
  }

  // Messages not covered and not in the recent window
  const uncovered = messages.filter((m) => !coveredIds.has(m.id));
  if (uncovered.length <= KEEP_RECENT) return [];

  // Everything except the last KEEP_RECENT
  return uncovered.slice(0, uncovered.length - KEEP_RECENT);
}
