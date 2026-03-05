// llm-factory.ts
import { LLM } from "./llm";
import { GeminiAdapter } from "./GeminiAdapter";
import { OpenAIAdapter } from "./OpenAIAdapter";
import { AnthropicAdapter } from "./AnthropicAdapter";

export function createLLM(provider: string): LLM {
  switch (provider) {
    case "gemini":
      return new GeminiAdapter(process.env.GEMINI_API_KEY!);
    case "openai":
      return new OpenAIAdapter(process.env.OPENAI_API_KEY!);
    case "anthropic":
      return new AnthropicAdapter(process.env.ANTHROPIC_API_KEY!);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}