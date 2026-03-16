// anthropic-adapter.ts
import Anthropic from "@anthropic-ai/sdk";
import { LLM, LLMGenerateOptions, LLMMessage } from "./llm";

export class AnthropicAdapter implements LLM {
  private client;
  private modelName: string;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY, modelName = process.env.ANTHROPIC_MODEL || "claude-3-opus-20240229") {
    this.client = new Anthropic({ apiKey });
    this.modelName = modelName;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<string> {
    const { messages, maxTokens, ...rest } = options;

    const history: LLMMessage[] =
      messages && messages.length > 0
        ? messages
        : [{ role: "user", content: prompt }];

    const systemPrompt = history
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const anthropicMessages = history
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    const finalMessages =
      anthropicMessages.length > 0
        ? anthropicMessages
        : [{ role: "user" as const, content: prompt }];

    const result = await this.client.messages.create({
      model: this.modelName,
      max_tokens: maxTokens ?? 2048,
      system: systemPrompt || undefined,
      messages: finalMessages,
      ...rest,
    });

    if (result.content[0]?.type === "text") {
      return result.content[0].text ?? "";
    }
    return "";
  }
}