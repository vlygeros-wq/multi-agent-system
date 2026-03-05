// anthropic-adapter.ts
import Anthropic from "@anthropic-ai/sdk";
import { LLM } from "./llm";

export class AnthropicAdapter implements LLM {
  private client;
  private modelName: string;

  constructor(apiKey = process.env.ANTHROPIC_API_KEY, modelName = process.env.ANTHROPIC_MODEL || "claude-3-opus-20240229") {
    this.client = new Anthropic({ apiKey });
    this.modelName = modelName;
  }

  async generate(prompt: string, options?: Record<string, any>): Promise<string> {
    const result = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
      ...options
    });

    if ( result.content[0]?.type === "text" ) {
      return result.content[0].text ?? "";
    }
    return "";
  }
}