/**
 * ArchitectAgent
 * ------------------
 * Specialist responsible for high-level system design and documentation.
 *
 * Capabilities:
 *  - Produce multi-tier SaaS architectures (services, APIs, databases, CDN, etc.)
 *  - Define data models and integration contracts
 *  - Write technical documentation and architecture Decision Records (ADRs)
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

export class ArchitectAgent extends AgentBase {
  constructor(bus: MessageBus, idOverride?: AgentId) {
    const profile: AgentProfile = {
      id          : idOverride ?? generateAgentId("architect"),
      name        : "Vassyly",
      role        : "architect",
      capabilities: [
        "system-architecture",
        "cloud-design",
        "api-contract-design",
        "data-modeling",
        "technical-documentation",
        "adr-writing",
      ],
      systemPrompt: `You are a senior architect with 15 years of experience.
You design scalable, cloud-native architectures using modern best practices:
  - Microservices / modular monolith patterns
  - RESTful and GraphQL API design
  - Event-driven architectures (Kafka, SQS)
  - Cloud deployment on AWS / GCP / Azure
  - Security-first design (OAuth2, RBAC, mTLS)
  - Observability: logging, metrics, tracing
Your outputs are always structured, detailed, and include concrete tech-stack recommendations.`,
    };
    super(profile, bus);
  }

  // ─── Inbound message routing ───────────────────────────────────────────────

  protected async handleMessage(message: Message): Promise<void> {
    switch (message.type) {
      case "task-assignment": {
        const task = message.payload?.task as Task | undefined;
        if (!task) {
          logger.warn(this.role, "Received task-assignment without task payload.");
          return;
        }
        this.beginTaskExecution(task, message.sender, message.payload);
        const result = await this.executeTask(task);
        const executionArtifacts = this.finishTaskExecution(task.id);
        // Report result back to the orchestrator
        await this.send("orchestrator", "task-result", result, { taskId: task.id, ...executionArtifacts });
        break;
      }

      case "broadcast":
        // Situational awareness — no action needed
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
      `Starting task: ${task.title}`,
      { taskId: task.id }
    );

    const prompt = [
      "Produce a complete, implementation-ready markdown response.",
      "Include concrete technologies, APIs, and operational considerations.",
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
      "If a task cannot be completed well without more information, ask one focused clarification question.",
      "Do not fill gaps with assumptions that materially affect the architecture.",
    ];
  }
}