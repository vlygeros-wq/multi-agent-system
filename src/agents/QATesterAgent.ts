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
} from "../types";
import { generateAgentId } from "../utils/ids";
import { logger } from "../utils/logger";

export class QATesterAgent extends AgentBase {
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
        this.beginTaskExecution(task, message.sender, message.payload);
        const result = await this.executeTask(task);
        const executionArtifacts = this.finishTaskExecution(task.id);
        await this.send("orchestrator", "task-result", result, { taskId: task.id, ...executionArtifacts });
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

    const prompt = [
      "Return a complete QA strategy and test artifacts in markdown.",
      "Include unit, integration, end-to-end, and performance test considerations.",
    ].join("\n");

    let result: string;
    try {
      result = await this.generateTaskResult(task, [prompt], {
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

  protected override getTaskExecutionGuidance(_task: Task): string[] {
    return [
      "If the test strategy depends on a missing acceptance criterion or environment detail, ask one concise clarification question.",
      "Do not fabricate quality gates, thresholds, or environments.",
    ];
  }
}