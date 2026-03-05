/**
 * AI 服务抽象层 — 统一接口定义
 * 所有适配器（DeepSeek / 豆包 / 通义千问）都必须实现此接口
 */

export type AIProvider = "deepseek" | "doubao" | "tongyi";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  finishReason: "stop" | "length" | "error";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface AIServiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AIService {
  readonly provider: AIProvider;

  chat(request: ChatRequest): Promise<ChatResponse>;

  chatStream(
    request: ChatRequest
  ): AsyncIterable<StreamChunk>;
}
