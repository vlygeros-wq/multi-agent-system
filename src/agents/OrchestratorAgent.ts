/**
 * OrchestratorAgent
 * -----------------
 * The "manager" of the multi-agent system.
 *
 * Responsibilities:
 *  1. Accept a high-level goal prompt.
 *  2. Decompose it into an ordered set of Tasks via TaskPlanner.
 *  3. Dispatch tasks to the appropriate specialist agents.
 *  4. Listen for results, mark tasks complete, and unblock dependent tasks.
 *  5. Aggregate all results into a final consolidated report.
 *
 * The orchestrator communicates ONLY via the MessageBus — it never calls
 * agent methods directly.
 */

import { AgentBase } from "./AgentBase";
import { TaskPlanner, createTask } from "../tasks/TaskPlanner";
import { MessageBus } from "../flow/MessageBus";
import {
  AgentProfile,
  AgentId,
  Message,
  Task,
  TaskId,
} from "../types";
import { logger } from "../utils/logger";

/** Minimal descriptor the orchestrator needs to know about each specialist */
export interface AgentDescriptor {
  id: AgentId;
  role: string;
  capabilities: string[];
}

export class OrchestratorAgent extends AgentBase {
  private readonly planner   = new TaskPlanner();
  private readonly registry  = new Map<AgentId, AgentDescriptor>();

  /** Resolvers keyed by taskId — resolved when the task result arrives */
  private readonly pendingTasks = new Map<TaskId, (result: string) => void>();

  constructor(bus: MessageBus) {
    const profile: AgentProfile = {
      id          : "orchestrator",
      name        : "Charles (Orchestrator)",
      role        : "orchestrator",
      capabilities: ["task-decomposition", "task-dispatch", "result-aggregation"],
      systemPrompt: `You are the central orchestrator of a multi-agent software development team.
Your responsibilities:
  - Understand high-level goals and break them into concrete, assignable tasks.
  - Assign tasks to the specialist agents best suited for each job.
  - Monitor task progress and unblock dependent tasks as results arrive.
  - Aggregate all outputs into a coherent final deliverable.
Always be decisive, clear, and structured in your instructions.`,
    };
    super(profile, bus);
  }

  // ─── Agent registry ────────────────────────────────────────────────────────

  /** Register a specialist agent so the orchestrator can assign work to it */
  registerAgent(descriptor: AgentDescriptor): void {
    this.registry.set(descriptor.id, descriptor);
    logger.info("orchestrator", `Registered agent: ${descriptor.id} (${descriptor.role})`);
  }

  // ─── Main entry point ──────────────────────────────────────────────────────

  /**
   * Run the full orchestration pipeline for a given goal.
   * Returns the aggregated final report as a string.
   */
  async run(goal: string): Promise<string> {
    logger.divider();
    logger.info("orchestrator", `🎯 New goal received: "${goal}"`);
    logger.divider();

    // 1. Broadcast the goal to all agents for situational awareness
    await this.send(
      "broadcast",
      "broadcast",
      `New project goal: ${goal}`,
      { goal }
    );

    // 2. Decompose into tasks
    const tasks = this.decompose(goal);
    this.planner.addTasks(tasks);

    // 3. Dispatch-loop: keep dispatching runnable tasks until all are done
    await this.dispatchLoop();

    // 4. Aggregate results
    return this.aggregate(goal);
  }

  // ─── Task decomposition ────────────────────────────────────────────────────

  /**
   * Hard-coded decomposition for the demo.
   * In a real system this would call an LLM to produce the task graph.
   */
  private decompose(goal: string): Task[] {
    logger.info("orchestrator", "Decomposing goal into tasks…");

    const architectId  = this.findAgent("architect");
    const developerId  = this.findAgent("developer");
    const qaId         = this.findAgent("qa-tester");

    // Build a small dependency graph:
    //   [architecture] → [backend-dev, frontend-dev] → [qa-testing] → [docs]
    const t1 = createTask({
      title       : "System Architecture Design",
      description : `Analyse the goal "${goal}" and produce a high-level SaaS architecture: services, data flows, tech-stack choices, and deployment model.`,
      assignedTo  : architectId,
      priority    : "critical",
      dependsOn   : [],
    });

    const t2 = createTask({
      title       : "Backend API Development",
      description : "Implement the REST/GraphQL API layer based on the architecture specification. Include auth, data models, and core business logic.",
      assignedTo  : developerId,
      priority    : "high",
      dependsOn   : [t1.id],
    });

    const t3 = createTask({
      title       : "Frontend UI Development",
      description : "Build the React/TypeScript frontend that consumes the API. Include routing, state management, and responsive layout.",
      assignedTo  : developerId,
      priority    : "high",
      dependsOn   : [t1.id],
    });

    const t4 = createTask({
      title       : "QA & Test Suite",
      description : "Write unit, integration, and E2E tests for both backend and frontend. Identify and report any bugs or coverage gaps.",
      assignedTo  : qaId,
      priority    : "high",
      dependsOn   : [t2.id, t3.id],
    });

    const t5 = createTask({
      title       : "Technical Documentation",
      description : "Produce API reference docs, architecture diagrams (text-based), and a README for the project.",
      assignedTo  : architectId,
      priority    : "medium",
      dependsOn   : [t4.id],
    });

    return [t1, t2, t3, t4, t5];
  }

  // ─── Dispatch loop ─────────────────────────────────────────────────────────

  private async dispatchLoop(): Promise<void> {
    while (!this.planner.isComplete()) {
      const runnable = this.planner.getRunnableTasks();

      if (runnable.length === 0) {
        // All remaining tasks are blocked on in-progress dependencies
        // Wait for the next result before re-checking
        await this.waitForAnyResult();
        continue;
      }

      // Dispatch all currently runnable tasks in parallel
      await Promise.all(runnable.map((task: any) => this.dispatch(task)));
    }

    logger.success("orchestrator", "All tasks completed!");
    logger.info("orchestrator", "\n" + this.planner.summary());
  }

  /** Dispatch one task to its assigned agent */
  private async dispatch(task: Task): Promise<void> {
    this.planner.updateStatus(task.id, "in-progress");

    logger.info(
      "orchestrator",
      `Dispatching task [${task.id}] "${task.title}" → ${task.assignedTo}`
    );

    // Register the result-waiter BEFORE publishing the task-assignment so we
    // never miss a result that arrives synchronously inside the bus deliver loop.
    const resultPromise = this.awaitTaskResult(task.id);

    // Attach any relevant prior results as context
    const context = this.buildContextForTask(task);

    await this.send(
      task.assignedTo,
      "task-assignment",
      task.description,
      { task, context }
    );

    // Await the result (may already be resolved if the agent ran synchronously)
    const result = await resultPromise;
    this.planner.recordResult(task.id, result);
  }

  /** Build context by attaching results of dependency tasks */
  private buildContextForTask(task: Task): Record<string, string> {
    const ctx: Record<string, string> = {};
    for (const depId of task.dependsOn) {
      const dep = this.planner.getTask(depId);
      if (dep?.result) {
        ctx[dep.title] = dep.result;
      }
    }
    return ctx;
  }

  /** Promisify waiting for a task result message */
  private awaitTaskResult(taskId: TaskId): Promise<string> {
    return new Promise((resolve) => {
      this.pendingTasks.set(taskId, resolve);
    });
  }

  /** Resolves when any pending task has been resolved (used to break the dispatch loop deadlock) */
  private waitForAnyResult(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.planner.getRunnableTasks().length > 0 || this.planner.isComplete()) {
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      setTimeout(check, 50);
    });
  }

  // ─── Inbound message handling ──────────────────────────────────────────────

  protected async handleMessage(message: Message): Promise<void> {
    switch (message.type) {
      case "task-result": {
        const taskId = message.payload?.taskId as TaskId | undefined;
        if (!taskId) {
          logger.warn("orchestrator", `Received task-result without taskId from ${message.sender}`);
          return;
        }
        const resolver = this.pendingTasks.get(taskId);
        if (resolver) {
          this.pendingTasks.delete(taskId);
          resolver(message.content);
        }
        break;
      }

      case "clarification-request": {
        logger.info("orchestrator", `Clarification requested by ${message.sender}: "${message.content}"`);
        // Auto-respond with a generic clarification for the demo
        await this.send(
          message.sender,
          "clarification-response",
          `Proceed with best-practice defaults for: "${message.content}". Prioritise scalability and maintainability.`,
          undefined,
          message.id
        );
        break;
      }

      case "status-update": {
        logger.info("orchestrator", `Status from ${message.sender}: ${message.content}`);
        break;
      }

      default:
        // Ignore broadcasts we sent ourselves, etc.
        break;
    }
  }

  // Required by AgentBase but orchestrator doesn't self-execute tasks
  async executeTask(_task: Task): Promise<string> {
    throw new Error("OrchestratorAgent does not execute tasks directly.");
  }

  // ─── Aggregation ───────────────────────────────────────────────────────────

  private aggregate(goal: string): string {
    const tasks  = this.planner.getAllTasks();
    const lines: string[] = [
      "═".repeat(70),
      "  FINAL AGGREGATED REPORT",
      `  Goal: ${goal}`,
      "═".repeat(70),
      "",
    ];

    for (const task of tasks) {
      lines.push(`┌─ [${task.status.toUpperCase()}] ${task.title}`);
      lines.push(`│  Assigned to : ${task.assignedTo}`);
      lines.push(`│  Result      :`);
      (task.result ?? "(no result)")
        .split("\n")
        .forEach((l: any) => lines.push(`│    ${l}`));
      lines.push("│");
    }

    lines.push("└" + "─".repeat(68));
    lines.push(`\n  Total messages on bus: ${this.bus.totalMessages}`);

    return lines.join("\n");
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private findAgent(role: string): AgentId {
    for (const [id, desc] of this.registry) {
      if (desc.role === role) return id;
    }
    throw new Error(`OrchestratorAgent: no agent found for role "${role}"`);
  }
}
