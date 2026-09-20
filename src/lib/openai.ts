import OpenAI from "openai";
import type { AppConfig } from "../config.js";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createClient(config: AppConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    defaultHeaders: {
      ...(config.httpReferer ? { "HTTP-Referer": config.httpReferer } : {}),
      ...(config.xTitle ? { "X-Title": config.xTitle } : {}),
    },
  });
}

export async function chat(
  client: OpenAI,
  config: AppConfig,
  opts: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model: opts.model,
        temperature: opts.temperature ?? config.temperature,
        max_tokens: opts.maxTokens ?? config.maxTokens,
        messages: opts.messages,
      });
      const text = response.choices[0]?.message?.content ?? "";
      return text.trim();
    } catch (error) {
      lastError = error;
      const status = (error as { status?: number }).status;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt === config.maxRetries) break;
      const delay = Math.min(30_000, 1000 * 2 ** attempt);
      console.warn(
        `Retrying ${opts.model} after ${status ?? "error"} (attempt ${attempt + 1}/${config.maxRetries})`,
      );
      await sleep(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
