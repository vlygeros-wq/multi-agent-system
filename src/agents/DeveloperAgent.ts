/**
 * DeveloperAgent
 * --------------
 * Specialist responsible for writing and reviewing code.
 *
 * Capabilities:
 *  - Backend API development (Node.js / TypeScript)
 *  - Frontend UI development (React / TypeScript)
 *  - Code review
 *  - Dependency management
 *
 * The agent can consult the ArchitectAgent via inter-agent messages
 * when it needs architectural clarification before proceeding.
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

export class DeveloperAgent extends AgentBase {
  constructor(bus: MessageBus, idOverride?: AgentId) {
    const profile: AgentProfile = {
      id          : idOverride ?? generateAgentId("developer"),
      name        : "Olivier",
      role        : "developer",
      capabilities: [
        "backend-development",
        "frontend-development",
        "code-review",
        "api-integration",
        "database-schema-design",
      ],
      systemPrompt: `You are a full-stack developer with deep expertise in:
  - TypeScript / Node.js (Express, Fastify, NestJS)
  - React 18 + TailwindCSS + Zustand / React Query
  - PostgreSQL, Prisma ORM
  - REST OpenAPI and GraphQL API implementation
  - Docker, GitHub Actions CI/CD
You write clean, tested, production-ready code and always consider edge cases,
error handling, and performance.`,
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
      `Starting development: ${task.title}`,
      { taskId: task.id }
    );

    const prompt = [
      "Before you start coding, ensure you have a clear understanding of the task requirements and ask for clarification if needed.",
      "Write clean, modular, and well-documented code that is production-ready.",
      "Consider edge cases, error handling, and performance implications in your implementation.",
      "If backend: include API routes, data models, and integration points.",
      "If frontend: include component structure, state management, and API integration.",
      "Ensure your code adheres to best practices and coding standards.",
      "Produce a complete implementation in markdown format, including any necessary explanations or comments.",
      "If you encounter any architectural uncertainties, send a clarification request to the ArchitectAgent before proceeding.",
      "If the task requires integration with other components, ensure your implementation is compatible with the expected interfaces and data contracts.",
      "If you identify any potential blockers or dependencies that could impact your ability to complete the task, communicate these to the orchestrator immediately.",
      "If you need to collaborate with the QA tester for testing considerations, proactively reach out to them via inter-agent messaging.",
      "After completing the task, provide a summary of your implementation approach and any assumptions you made during development.",
      "If you had to make any decisions due to ambiguous requirements, document these decisions and the rationale behind them in your task result.",
      "If you had to ask for clarification, include the question you asked and the answer you received in your task result for transparency.",
      "If you encountered any challenges during implementation, describe these challenges and how you overcame them in your task result.",
      "If your implementation includes any third-party libraries or tools, provide a brief justification for their inclusion and how they fit into the overall architecture.",
      "If your implementation includes any security considerations, such as input validation or authentication, explicitly describe these in your task result.",
      "If your implementation includes any performance optimizations, describe these optimizations and the reasoning behind them in your task result.",
      "If your implementation includes any testing considerations, such as unit tests or integration tests, describe these considerations and how they contribute to the overall quality of the code in your task result.",
      "If your implementation includes any deployment considerations, such as Docker configuration or CI/CD pipelines, describe these considerations and how they facilitate the deployment process in your task result.",
      "If your implementation includes any monitoring or observability considerations, such as logging or metrics, describe these considerations and how they contribute to the maintainability of the system in your task result.",
      "If your implementation includes any documentation, such as API docs or code comments, describe the scope and purpose of this documentation in your task result.",
      "If your implementation includes any assumptions about the requirements or architecture, explicitly state these assumptions and their implications in your task result.",
      "If your implementation includes any known limitations or areas for future improvement, describe these in your task result to provide context for future development efforts.",
      "If your implementation includes any interactions with other agents, such as the ArchitectAgent or QATesterAgent, describe these interactions and their outcomes in your task result to provide context for the overall system behavior.",
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
      "If the task is underspecified, ask for the single most important missing detail only.",
      "Do not invent missing requirements.",
    ];
  }
}
