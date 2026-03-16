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
      "Return production-grade implementation output in markdown.",
      "If backend: include APIs, validation, and persistence details.",
      "If frontend: include components, state management, and error handling.",
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
