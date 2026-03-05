// openai-adapter.ts
import OpenAI from "openai";
import { LLM } from "./llm";

export class OpenAIAdapter implements LLM {
  private client;
  private modelName: string;

  constructor(apiKey = process.env.OPENAI_API_KEY, modelName = process.env.OPENAI_MODEL || "gpt-4") {
    this.client = new OpenAI({ apiKey });
    this.modelName = modelName;
  }

  async generate(prompt: string, options?: Record<string, any>): Promise<string> {
    const result = await this.client.chat.completions.create({
      model: this.modelName,
      messages: [{ role: "user", content: prompt }],
      ...options
    });

    return result.choices[0].message.content ?? "";
  }
}