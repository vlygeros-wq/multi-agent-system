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
  Message,
  MessageType,
  Task,
  ConversationTurn,
} from "../types";
import { MessageBus } from "../flow/MessageBus";
import { logger } from "../utils/logger";

export abstract class AgentBase {
  // ─── Identity ───────────────────────────────────────────────────────────────
  readonly profile: AgentProfile;

  // ─── Communication infrastructure ──────────────────────────────────────────
  protected readonly bus: MessageBus;

  // ─── Per-agent conversation history ────────────────────────────────────────
  protected readonly history: ConversationTurn[] = [];

  constructor(profile: AgentProfile, bus: MessageBus) {
    this.profile = profile;
    this.bus     = bus;

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
