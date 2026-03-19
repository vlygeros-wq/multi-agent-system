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
      "Clarify the context and objectives before proceeding.",
      "Present a clear high-level architectural design addressing the task requirements.",
      "Describe the critical flow of data and interactions between components.",
      "Take into account scalability, security, and maintainability best practices.",
      "Treat security as a first-class concern and include specific measures in your design.",
      "Compliance and regulatory considerations should be explicitly addressed in the architecture.",
      "Observability and monitoring should be integrated into the architecture from the start.",
      "Error handling and failure modes should be clearly defined for each component.",
      "Provide trade-offs and alternatives if there are multiple viable approaches.",
      "Your output should be detailed and structured, suitable for guiding development and serving as technical documentation.",
      "Use concrete technology recommendations where appropriate.",
      "If you encounter ambiguities in the task requirements that materially affect the architecture, ask one focused clarification question.",
      "If the task is too large to execute in one step, break it down into smaller subtasks and execute them sequentially, reporting progress after each subtask.",
      "If the task depends on another task that has not yet completed, ask the orchestrator for an update on the prerequisite task before proceeding.",
      "If you identify a potential architectural risk or bottleneck, highlight it in your response and suggest mitigation strategies.",
      "If the task requires integration with external systems or APIs, ensure your design accounts for their constraints and limitations.",
      "If you need to make assumptions due to missing information, clearly state those assumptions in your response.",
      "If you need to collaborate with the developer for implementation considerations, proactively reach out to them via inter-agent messaging.",
      "After completing the task, provide a summary of your architectural design and the rationale behind your decisions.",
      "If you had to ask for clarification, include the question you asked and the answer you received in your task result for transparency.",
      "If you encountered any challenges during the design process, describe these challenges and how you overcame them in your task result.",
      "If your design includes any third-party services or tools, provide a brief justification for their inclusion and how they fit into the overall architecture.",
      "If your design includes any security considerations, such as authentication mechanisms or data encryption, explicitly describe these in your task result.",
      "If your design includes any scalability considerations, such as load balancing or auto-scaling strategies, describe these considerations and how they contribute to the system's ability to handle increased load in your task result.",
      "If your design includes any maintainability considerations, such as modularization or documentation practices, describe these considerations and how they facilitate future development efforts in your task result.",
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