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
      "Before you start, ensure the task requirements are testable and ask for clarification if needed.",
      "Design a comprehensive test strategy that covers unit, integration, and E2E tests as appropriate.",
      "If the task involves performance-sensitive features, include a load testing plan.",
      "Produce clear, actionable bug reports if you identify any issues in the requirements or implementation.",
      "Prioritise tests based on risk and impact to ensure critical paths are well-covered.",
      "Remember, your role is to ensure quality and prevent defects from reaching production.",
      "Your output should be detailed and structured, suitable for guiding test implementation and serving as documentation for the development team.",
      "If you encounter ambiguities in the task requirements that materially affect testability, ask one focused clarification question.",
      "If the task is too large to execute in one step, break it down into smaller subtasks and execute them sequentially, reporting progress after each subtask.",
      "If you identify a potential quality risk or gap in the requirements, highlight it in your response and suggest mitigation strategies.",
      "If the task requires integration with external systems or APIs, ensure your test strategy accounts for their constraints and limitations.",
      "Consider edge cases, error handling, and performance implications in your test design.",
      "If acceptance criteria are missing or unclear, ask for specific details to ensure your tests can validate the intended functionality.",
      "Do not fabricate acceptance criteria or testing environments; always seek clarification if critical information is missing.",
      "Your role is to ensure the final product is robust, reliable, and meets the highest quality standards.",
      "If you identify a potential defect in the requirements or implementation, document it clearly and provide steps to reproduce, expected vs actual behavior, and any relevant context.",
      "If you need to collaborate with the developer agent for testing considerations, proactively reach out to them via inter-agent messaging to ensure alignment on testability and implementation details.",
      "After completing the task, provide a summary of your testing approach, any assumptions you made, and any potential quality risks you identified during your analysis.",
      "If you had to ask for clarification, include the question you asked and the answer you received in your task result for transparency.",
      "If you encountered any challenges during your analysis, describe these challenges and how you overcame them in your task result.",
      "If your test strategy includes any specific tools, frameworks, or libraries, provide a brief justification for their inclusion and how they fit into the overall testing approach.",
      "If your test strategy includes any specific quality gates or thresholds, clearly define these and the rationale behind them in your task result.",
      "If your test strategy includes any specific testing environments or configurations, describe these in detail and explain how they contribute to ensuring the quality of the final product.",
      "Remember, your ultimate goal is to ensure that the product is of the highest quality and meets the needs of the end users. Your thoroughness and attention to detail are critical in achieving this goal.",
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