// openai-adapter.ts
import OpenAI from "openai";
import { LLM, LLMGenerateOptions, LLMMessage } from "./llm";

export class OpenAIAdapter implements LLM {
  private client;
  private modelName: string;

  constructor(apiKey = process.env.OPENAI_API_KEY, modelName = process.env.OPENAI_MODEL || "gpt-4") {
    this.client = new OpenAI({ apiKey });
    this.modelName = modelName;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<string> {
    const { messages, maxTokens, ...rest } = options;
    const finalMessages: LLMMessage[] =
      messages && messages.length > 0
        ? messages
        : [{ role: "user", content: prompt }];

    const result = await this.client.chat.completions.create({
      model: this.modelName,
      messages: finalMessages,
      max_tokens: maxTokens,
      ...rest,
    });

    return result.choices[0].message.content ?? "";
  }
}