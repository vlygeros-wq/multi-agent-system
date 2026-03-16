/**
 * QATesterAgent
 * -------------
 * Specialist responsible for quality assurance, testing strategy,
 * and bug reporting.
 *
 * Capabilities:
 *  - Unit test authoring (Vitest / Jest)
 *  - Integration test authoring (Supertest)
 *  - E2E test authoring (Playwright)
 *  - Performance / load testing plan (k6)
 *  - Bug triage and regression reports
 *
 * The QA agent can request clarification from the orchestrator if
 * acceptance criteria are ambiguous, demonstrating the
 * `clarification-request` / `clarification-response` message flow.
 */

import { AgentBase } from "./AgentBase";
import { MessageBus } from "../flow/MessageBus";
import {
  AgentProfile,
  AgentId,
  Message,
  Task,
  MessageId,
} from "../types";
import { generateAgentId } from "../utils/ids";
import { logger } from "../utils/logger";

export class QATesterAgent extends AgentBase {
  /** Stores pending clarification resolvers keyed by correlationId */
  private readonly clarifications = new Map<MessageId, (answer: string) => void>();

  constructor(bus: MessageBus, idOverride?: AgentId) {
    const profile: AgentProfile = {
      id          : idOverride ?? generateAgentId("qa-tester"),
      name        : "Fred",
      role        : "qa-tester",
      capabilities: [
        "unit-testing",
        "integration-testing",
        "e2e-testing",
        "performance-testing",
        "bug-reporting",
        "acceptance-criteria-validation",
      ],
      systemPrompt: `You are principal QA engineer who ensures nothing ships unless it is solid.
You specialise in:
  - Test pyramid design (unit → integration → E2E)
  - Playwright for browser automation
  - Vitest / Jest for unit & integration tests
  - k6 for load and performance testing
  - Shift-left testing practices
  - Risk-based test prioritisation
You write thorough, well-structured test suites and produce clear bug reports.`,
    };
    super(profile, bus);
  }

  // ─── Inbound message routing ───────────────────────────────────────────────

  protected async handleMessage(message: Message): Promise<void> {
    switch (message.type) {
      case "task-assignment": {
        const task = message.payload?.task as Task | undefined;
        if (!task) return;
        const result = await this.executeTask(task);
        await this.send("orchestrator", "task-result", result, { taskId: task.id });
        break;
      }

      case "clarification-response": {
        // Orchestrator answered our clarification request
        if (message.correlationId) {
          const resolver = this.clarifications.get(message.correlationId);
          if (resolver) {
            this.clarifications.delete(message.correlationId);
            resolver(message.content);
          }
        }
        break;
      }

      case "broadcast":
        break;

      default:
        break;
    }
  }

  // ─── Task execution ────────────────────────────────────────────────────────

  async executeTask(task: Task): Promise<string> {
    logger.info(this.role, `Executing task: "${task.title}"`);

    await this.send(
      "orchestrator",
      "status-update",
      `QA starting: ${task.title}`,
      { taskId: task.id }
    );

    // Demonstrate clarification flow: ask orchestrator for clarification
//    const clarification = await this.requestClarification(
//      "What are the minimum acceptable code-coverage thresholds for this project?"
//    );
//    logger.info(this.role, `Clarification received: "${clarification}"`);

    const prompt = [
      `Task title: ${task.title}`,
      `Task description: ${task.description}`,
      // `Clarification received: ${clarification}`,
      "Return a complete QA strategy and test artifacts in markdown.",
      "Include unit, integration, end-to-end, and performance test considerations.",
    ].join("\n");

    let result: string;
    try {
      result = await this.generate(prompt, {
        maxTokens: 4096,
        temperature: 0.2,
      });
    } catch (error) {
      logger.warn(this.role, `Task "${task.title}" failed: ${String(error)}`);
      result = `Task "${task.title}" failed: ${String(error)}`;
      this.recordTurn("assistant", result);
    }

    logger.success(this.role, `Task "${task.title}" complete.`);
    return result;
  }

  // ─── Clarification helper ─────────────────────────────────────────────────

  /**
   * Send a clarification request to the orchestrator and await its response.
   * Pre-generates the message id so we can register the resolver BEFORE the
   * message is delivered (prevents the response arriving before we listen).
   * Falls back after 2 s if the orchestrator does not reply.
   */
  /*private async requestClarification(question: string): Promise<string> {
    const msgId = generateMessageId();

    // Register the resolver BEFORE publishing so we never miss the reply.
    const answer = new Promise<string>((resolve) => {
      this.clarifications.set(msgId, resolve);
      setTimeout(() => {
        if (this.clarifications.has(msgId)) {
          this.clarifications.delete(msgId);
          resolve("Use industry-standard defaults: 80% line coverage.");
        }
      }, 2_000);
    });

    // Publish with the pre-generated id; bus will deliver reply with correlationId = msgId
    await this.bus.publish({
      id        : msgId,
      type      : "clarification-request",
      sender    : this.id,
      recipient : "orchestrator",
      content   : question,
    });
    this.recordTurn("assistant", `→ [orchestrator] ${question}`);

    return answer;
  }
  */
}