/**
 * AgentBase
 * ---------
 * Abstract base class for every agent in the system.
 *
 * Responsibilities:
 *  - Holds the agent's profile (id, role, system prompt, capabilities).
 *  - Maintains a per-agent conversation history.
 *  - Provides send/receive helpers that delegate to the MessageBus.
 *  - Declares the abstract `executeTask` method that specialised agents implement.
 *
 * Agents never hold references to each other.  All communication is
 * mediated exclusively through the injected MessageBus instance.
 */

import {
  AgentProfile,
  AgentId,
  ClarificationTurn,
  MessageId,
  Message,
  MessageType,
  Task,
  ConversationTurn,
} from "../types";
import { MessageBus } from "../flow/MessageBus";
import { logger } from "../utils/logger";
import { generateMessageId } from "../utils/ids";
import { createLLM } from "../services/llm/factory";
import { LLM, LLMGenerateOptions, LLMMessage } from "../services/llm/llm";

export abstract class AgentBase {
  protected static readonly MAX_TASK_CLARIFICATIONS = 1;

  // ─── Identity ───────────────────────────────────────────────────────────────
  readonly profile: AgentProfile;

  // ─── Communication infrastructure ──────────────────────────────────────────
  protected readonly bus: MessageBus;

  // ─── Per-agent conversation history ────────────────────────────────────────
  protected readonly history: ConversationTurn[] = [];
  protected readonly llm: LLM;
  private readonly taskExecutionContexts = new Map<string, {
    taskSender: AgentId;
    context: Record<string, unknown>;
    clarifications: ClarificationTurn[];
    clarificationCount: number;
  }>();
  private readonly clarificationResolvers = new Map<MessageId, (answer: string) => void>();

  constructor(profile: AgentProfile, bus: MessageBus) {
    this.profile = profile;
    this.bus     = bus;
    this.llm     = createLLM(process.env.LLM_PROVIDER ?? "gemini");

    // Seed history with the system prompt
    this.history.push({
      role      : "system",
      content   : profile.systemPrompt,
      timestamp : new Date(),
    });

    // Register with the bus so we receive messages addressed to us
    this.bus.subscribe(this.id, (msg) => this.onMessage(msg));

    logger.info(profile.role, `Agent "${profile.name}" (${profile.id}) initialised.`);
  }

  // ─── Convenience getters ───────────────────────────────────────────────────

  get id(): AgentId          { return this.profile.id; }
  get name(): string         { return this.profile.name; }
  get role(): string         { return this.profile.role; }

  // ─── Sending ───────────────────────────────────────────────────────────────

  /**
   * Send a message to another agent (or "broadcast").
   * Returns the fully-formed message for chaining / correlation tracking.
   */
  protected async send(
    recipient: AgentId | "broadcast",
    type: MessageType,
    content: string,
    payload?: Record<string, unknown>,
    correlationId?: string
  ): Promise<Message> {
    const msg = await this.bus.publish({
      type,
      sender    : this.id,
      recipient,
      content,
      payload,
      correlationId,
    });

    // Record outbound turn in local history
    this.recordTurn("assistant", `→ [${recipient}] ${content}`);
    return msg;
  }

  // ─── Receiving ─────────────────────────────────────────────────────────────

  /**
   * Called by the MessageBus for every inbound message.
   * Logs, records history, then delegates to the subclass hook.
   */
  private async onMessage(message: Message): Promise<void> {
    logger.info(
      this.role,
      `"${this.name}" received [${message.type}] from ${message.sender}: "${message.content.slice(0, 120)}"`
    );

    this.recordTurn("user", `← [${message.sender}] ${message.content}`);

    if (this.tryResolveClarificationResponse(message)) {
      return;
    }

    await this.handleMessage(message);
  }

  // ─── Abstract API (subclasses must implement) ──────────────────────────────

  /**
   * Handle an inbound message.  Subclasses decide what to do
   * (e.g. execute a task, forward a result, ask for clarification).
   */
  protected abstract handleMessage(message: Message): Promise<void>;

  /**
   * Execute a concrete task and return a human-readable result string.
   * The orchestrator calls this indirectly via a `task-assignment` message.
   */
  abstract executeTask(task: Task): Promise<string>;

  // ─── Conversation history ──────────────────────────────────────────────────

  protected recordTurn(role: "user" | "assistant" | "system", content: string): void {
    this.history.push({ role, content, timestamp: new Date() });
  }

  protected historyToMessages(): LLMMessage[] {
    const nonSystemHistory = this.history
      .filter((turn) => turn.role !== "system")
      .map((turn) => ({
        role: turn.role,
        content: turn.content,
      }));

    return [
      { role: "system", content: this.profile.systemPrompt },
      ...nonSystemHistory,
    ];
  }

  protected async generate(prompt: string, options: LLMGenerateOptions = {}): Promise<string> {
    this.recordTurn("user", prompt);
    const response = await this.llm.generate(prompt, {
      ...options,
      messages: this.historyToMessages(),
    });
    this.recordTurn("assistant", response);
    return response;
  }

  // ─── Shared task clarification flow ───────────────────────────────────────

  protected beginTaskExecution(task: Task, taskSender: AgentId, payload?: Record<string, unknown>): void {
    this.taskExecutionContexts.set(task.id, {
      taskSender,
      context: (payload?.context as Record<string, unknown> | undefined) ?? {},
      clarifications: [],
      clarificationCount: 0,
    });
  }

  protected finishTaskExecution(taskId: string): { clarifications: ClarificationTurn[] } {
    const context = this.taskExecutionContexts.get(taskId);
    this.taskExecutionContexts.delete(taskId);
    return {
      clarifications: context?.clarifications ?? [],
    };
  }

  protected async generateTaskResult(
    task: Task,
    promptSections: string[],
    options: LLMGenerateOptions = {}
  ): Promise<string> {
    let clarificationRound = 0;

    while (clarificationRound <= AgentBase.MAX_TASK_CLARIFICATIONS) {
      const prompt = this.buildTaskExecutionPrompt(task, promptSections);
      const response = await this.generate(prompt, options);
      const question = this.extractClarificationQuestion(response);

      if (!question) {
        return response;
      }

      if (clarificationRound >= AgentBase.MAX_TASK_CLARIFICATIONS) {
        return `Task \"${task.title}\" could not be completed because required information is missing: ${question}`;
      }

      const answer = await this.requestTaskClarification(task.id, question, 4_000);
      this.recordClarification(task.id, question, answer);
      clarificationRound += 1;
    }

    return `Task \"${task.title}\" could not be completed because required information is missing.`;
  }

  protected getTaskExecutionGuidance(_task: Task): string[] {
    return [];
  }

  private buildTaskExecutionPrompt(task: Task, promptSections: string[]): string {
    const context = this.taskExecutionContexts.get(task.id);
    const clarificationLines = (context?.clarifications ?? []).flatMap((turn, index) => [
      `Clarification ${index + 1} question: ${turn.question}`,
      `Clarification ${index + 1} answer: ${turn.answer}`,
    ]);

    const dependencyContext = Object.entries(context?.context ?? {}).flatMap(([key, value]) => [
      `${key}: ${String(value)}`,
    ]);

    return [
      `Task title: ${task.title}`,
      `Task description: ${task.description}`,
      ...dependencyContext,
      ...clarificationLines,
      ...this.getTaskExecutionGuidance(task),
      ...promptSections,
      "If critical information is missing and prevents a solid answer, respond exactly with: NEEDS_INFO: <one concise question>",
      "Otherwise, provide the final answer only.",
    ].join("\n");
  }

  private extractClarificationQuestion(response: string): string | null {
    const trimmed = response.trim();
    if (!trimmed.toUpperCase().startsWith("NEEDS_INFO:")) {
      return null;
    }

    const question = trimmed.slice("NEEDS_INFO:".length).trim();
    return question.length > 0 ? question : "What essential information is missing?";
  }

  private async requestTaskClarification(
    taskId: string,
    question: string,
    timeoutMs?: number
  ): Promise<string> {
    const context = this.taskExecutionContexts.get(taskId);
    if (!context) {
      return "No task sender available for clarification.";
    }

    const messageId = generateMessageId();
    const waitMs = timeoutMs ?? 4_000;

    const answer = new Promise<string>((resolve) => {
      this.clarificationResolvers.set(messageId, resolve);

      setTimeout(() => {
        if (this.clarificationResolvers.has(messageId)) {
          this.clarificationResolvers.delete(messageId);
          resolve("No clarification response received.");
        }
      }, waitMs);
    });

    await this.send(
      context.taskSender,
      "clarification-request",
      question,
      { taskId },
      messageId
    );

    return answer;
  }

  private recordClarification(taskId: string, question: string, answer: string): void {
    const context = this.taskExecutionContexts.get(taskId);
    if (!context) {
      return;
    }

    context.clarificationCount += 1;
    context.clarifications.push({
      senderId: this.id,
      responderId: context.taskSender,
      question,
      answer,
    });
  }

  private tryResolveClarificationResponse(message: Message): boolean {
    if (message.type !== "clarification-response" || !message.correlationId) {
      return false;
    }

    const resolver = this.clarificationResolvers.get(message.correlationId);
    if (!resolver) {
      return false;
    }

    this.clarificationResolvers.delete(message.correlationId);
    resolver(message.content);
    return true;
  }

  /** Read-only snapshot of this agent's conversation history */
  getHistory(): Readonly<ConversationTurn[]> {
    return [...this.history];
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  /** Cleanly detach from the bus */
  shutdown(): void {
    this.bus.unsubscribe(this.id);
    logger.warn(this.role, `Agent "${this.name}" shut down.`);
  }
}
