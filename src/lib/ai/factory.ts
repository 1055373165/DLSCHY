/**
 * AI 适配器工厂
 * 根据配置创建对应的 AI 服务实例
 */

import type { AIProvider, AIService, AIServiceConfig } from "./types";
import { DeepSeekAdapter } from "./adapters/deepseek";
import { DoubaoAdapter } from "./adapters/doubao";
import { TongyiAdapter } from "./adapters/tongyi";

const providerConfigs: Record<AIProvider, () => AIServiceConfig> = {
  deepseek: () => ({
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  }),
  doubao: () => ({
    apiKey: process.env.DOUBAO_API_KEY || "",
    baseUrl:
      process.env.DOUBAO_BASE_URL ||
      "https://ark.cn-beijing.volces.com/api/v3",
    model: process.env.DOUBAO_MODEL || "",
  }),
  tongyi: () => ({
    apiKey: process.env.TONGYI_API_KEY || "",
    baseUrl:
      process.env.TONGYI_BASE_URL ||
      "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: process.env.TONGYI_MODEL || "qwen-plus",
  }),
};

const adapterConstructors: Record<
  AIProvider,
  new (config: AIServiceConfig) => AIService
> = {
  deepseek: DeepSeekAdapter,
  doubao: DoubaoAdapter,
  tongyi: TongyiAdapter,
};

const serviceCache = new Map<AIProvider, AIService>();

export function getAIService(provider?: AIProvider): AIService {
  const targetProvider =
    provider ||
    (process.env.DEFAULT_AI_PROVIDER as AIProvider) ||
    "deepseek";

  const cached = serviceCache.get(targetProvider);
  if (cached) return cached;

  const configFn = providerConfigs[targetProvider];
  if (!configFn) {
    throw new Error(`Unknown AI provider: ${targetProvider}`);
  }

  const config = configFn();
  if (!config.apiKey) {
    throw new Error(
      `API key not configured for provider: ${targetProvider}. ` +
        `Set the ${targetProvider.toUpperCase()}_API_KEY environment variable.`
    );
  }

  const Constructor = adapterConstructors[targetProvider];
  const service = new Constructor(config);
  serviceCache.set(targetProvider, service);

  return service;
}

/**
 * Get AI service with automatic fallback to other available providers.
 * Tries the preferred provider first, then falls back in order.
 */
export function getAIServiceWithFallback(preferred?: AIProvider): {
  service: AIService;
  provider: AIProvider;
} {
  const available = getAvailableProviders();
  if (available.length === 0) {
    throw new Error(
      "No AI providers configured. Set at least one API key (DEEPSEEK_API_KEY, DOUBAO_API_KEY, or TONGYI_API_KEY)."
    );
  }

  // Try preferred first
  if (preferred && available.includes(preferred)) {
    return { service: getAIService(preferred), provider: preferred };
  }

  // Fallback order: try each available provider
  const fallbackOrder: AIProvider[] = ["deepseek", "doubao", "tongyi"];
  for (const p of fallbackOrder) {
    if (available.includes(p)) {
      return { service: getAIService(p), provider: p };
    }
  }

  // Should not reach here if available.length > 0
  return { service: getAIService(available[0]), provider: available[0] };
}

export function getAvailableProviders(): AIProvider[] {
  const providers: AIProvider[] = [];
  for (const [name, configFn] of Object.entries(providerConfigs)) {
    const config = configFn();
    if (config.apiKey) {
      providers.push(name as AIProvider);
    }
  }
  return providers;
}
