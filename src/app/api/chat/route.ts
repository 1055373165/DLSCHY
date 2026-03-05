/**
 * AI Chat API — Streaming 对话端点
 * POST /api/chat
 */

import { NextRequest } from "next/server";
import { getAIServiceWithFallback } from "@/lib/ai/factory";
import { buildSystemMessage } from "@/lib/ai/prompt/context";
import type { AIProvider, ChatMessage } from "@/lib/ai/types";

interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  provider?: AIProvider;
  context?: {
    projectName: string;
    projectDescription?: string;
    currentModule?: string;
    currentFile?: string;
    fileContent?: string;
    exploredModules?: string[];
    learningGoal?: string;
    analysisResults?: string;
    viewMode?: 'guided' | 'expert';
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequestBody = await request.json();

    if (!body.messages || body.messages.length === 0) {
      return Response.json(
        { error: "messages is required and must not be empty" },
        { status: 400 }
      );
    }

    const { service: aiService } = getAIServiceWithFallback(body.provider);

    const systemMessage = buildSystemMessage(body.context);

    const fullMessages: ChatMessage[] = [
      systemMessage,
      ...body.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = aiService.chatStream({
      messages: fullMessages,
      temperature: 0.7,
      maxTokens: 8192,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            const data = JSON.stringify({ content: chunk.content });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.close();
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const data = JSON.stringify({ error: errorMessage });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
