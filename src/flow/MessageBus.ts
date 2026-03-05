/**
 * MessageBus
 * ----------
 * The single communication backbone of the multi-agent system.
 *
 * All agents publish messages here and subscribe to receive messages
 * addressed to them (or to "broadcast").  No agent ever holds a direct
 * reference to another agent — they only know agent IDs.
 *
 * The bus is intentionally synchronous-first but wraps delivery in
 * microtasks (Promise.resolve) so that long subscriber chains don't
 * block the event loop and circular message chains can unwind naturally.
 */

import EventEmitter from "events";
import { Message, AgentId, MessageId } from "../types";
import { logger } from "../utils/logger";
import { generateMessageId } from "../utils/ids";

/** Subscriber callback signature */
export type MessageHandler = (message: Message) => void | Promise<void>;

export class MessageBus extends EventEmitter {
  /** Full audit log of every message ever published */
  private readonly messageLog: Message[] = [];

  /** Per-agent subscriber registry */
  private readonly subscribers = new Map<AgentId | "broadcast", MessageHandler[]>();

  constructor() {
    super();
    // Increase the default listener limit to accommodate many agents
    this.setMaxListeners(50);
  }

  // ─── Subscription ──────────────────────────────────────────────────────────

  /**
   * Register a handler that will be called whenever a message arrives
   * whose `recipient` matches `agentId` OR is "broadcast".
   */
  subscribe(agentId: AgentId, handler: MessageHandler): void {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, []);
    }
    this.subscribers.get(agentId)!.push(handler);
    logger.bus(`Agent "${agentId}" subscribed.`);
  }

  /**
   * Remove all handlers for the given agent (e.g. when an agent shuts down).
   */
  unsubscribe(agentId: AgentId): void {
    this.subscribers.delete(agentId);
    logger.bus(`Agent "${agentId}" unsubscribed.`);
  }

  // ─── Publishing ────────────────────────────────────────────────────────────

  /**
   * Publish a message onto the bus.
   *
   * The method:
   * 1. Stamps the message with an id and timestamp if not already present.
   * 2. Appends it to the audit log.
   * 3. Delivers it asynchronously to all matching subscribers.
   *
   * @returns The fully-formed message (with generated id/timestamp).
   */
  async publish(
    partial: Omit<Message, "id" | "timestamp"> & Partial<Pick<Message, "id" | "timestamp">>
  ): Promise<Message> {
    const message: Message = {
      id: partial.id ?? generateMessageId(),
      timestamp: partial.timestamp ?? new Date(),
      ...partial,
    } as Message;

    this.messageLog.push(message);

    logger.bus(
      `📨 [${message.type}] ${message.sender} → ${message.recipient} | "${message.content.slice(0, 80)}${message.content.length > 80 ? "…" : ""}"`
    );

    // Deliver to the specific recipient (if not broadcast)
    if (message.recipient !== "broadcast") {
      await this.deliver(message.recipient, message);
    }

    // Always deliver broadcasts to every known subscriber
    if (message.recipient === "broadcast") {
      const deliveries = [...this.subscribers.keys()].map((id) =>
        this.deliver(id, message)
      );
      await Promise.all(deliveries);
    }

    // Emit a generic event so external monitors can observe all traffic
    this.emit("message", message);

    return message;
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  private async deliver(agentId: AgentId, message: Message): Promise<void> {
    const handlers = this.subscribers.get(agentId);
    if (!handlers || handlers.length === 0) {
      logger.warn("bus", `No subscriber found for agent "${agentId}" — message dropped.`);
      return;
    }
    // Run handlers sequentially within a microtask so call-stacks stay clean
    await Promise.resolve();
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (err) {
        logger.error("bus", `Handler error for agent "${agentId}": ${String(err)}`);
      }
    }
  }

  // ─── Inspection ────────────────────────────────────────────────────────────

  /** Return a copy of the full audit log */
  getLog(): Readonly<Message[]> {
    return [...this.messageLog];
  }

  /** Retrieve a single message by id */
  getMessage(id: MessageId): Message | undefined {
    return this.messageLog.find((m) => m.id === id);
  }

  /** Return all messages exchanged between two agents */
  getConversation(agentA: AgentId, agentB: AgentId): Message[] {
    return this.messageLog.filter(
      (m) =>
        (m.sender === agentA && m.recipient === agentB) ||
        (m.sender === agentB && m.recipient === agentA)
    );
  }

  /** Total message count (useful for metrics) */
  get totalMessages(): number {
    return this.messageLog.length;
  }
}
