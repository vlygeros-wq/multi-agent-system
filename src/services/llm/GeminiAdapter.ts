// gemini-adapter.ts
import { GoogleGenAI  } from "@google/genai";
import { LLM, LLMGenerateOptions, LLMMessage } from "./llm";

export class GeminiAdapter implements LLM {
  private genAI;
  private modelName: string;

  constructor(apiKey = process.env.GEMINI_API_KEY, modelName = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview") {
    this.genAI = new GoogleGenAI ({ apiKey });
    this.modelName = modelName;
  }

  async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<string> {
    const { messages, ...rest } = options;

    const history: LLMMessage[] =
      messages && messages.length > 0
        ? messages
        : [{ role: "user", content: prompt }];

    const systemInstruction = history
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");

    const contents = history
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const result = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: contents.length > 0 ? contents : [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          ...(rest.config as Record<string, unknown> | undefined),
          systemInstruction: systemInstruction || undefined,
        },
        ...rest,
    });

    return result.text ?? "";
  }
}