export interface LLM {
  generate: (input: string, options?: Record<string, any>) => Promise<string>;

}