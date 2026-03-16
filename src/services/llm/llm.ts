export type LLMMessageRole = "system" | "user" | "assistant";

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
}

export interface LLMGenerateOptions {
  messages?: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  [key: string]: unknown;
}

export interface LLM {
  generate: (input: string, options?: LLMGenerateOptions) => Promise<string>;
}