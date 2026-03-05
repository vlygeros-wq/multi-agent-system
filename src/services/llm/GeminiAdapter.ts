// gemini-adapter.ts
import { GoogleGenAI  } from "@google/genai";
import { LLM } from "./llm";

export class GeminiAdapter implements LLM {
  private genAI;
  private modelName: string;

  constructor(apiKey = process.env.GEMINI_API_KEY, modelName = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview") {
    this.genAI = new GoogleGenAI ({ apiKey });
    this.modelName = modelName;
  }

  async generate(prompt: string, options?: Record<string, any>): Promise<string> {
    const result = await this.genAI.models.generateContent({
        model: this.modelName,
        contents: prompt,
        ...options
    });
    console.log("Gemini raw result:", result);
    return result.text ?? "";
  }
}