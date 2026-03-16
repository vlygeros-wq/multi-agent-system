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

interface GoalAnalysis {
  requiresBackend: boolean;
  requiresFrontend: boolean;
  requiresRealtime: boolean;
  requiresSecurity: boolean;
  requiresDocumentation: boolean;
  requiresQa: boolean;
}

interface TaskBlueprint {
  key: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  dependsIn: string[];
  preferredRoles: string[];
  capabilityHints: string[];
}

export class OrchestratorAgent extends AgentBase {
  private readonly planner   = new TaskPlanner();
  private readonly registry  = new Map<AgentId, AgentDescriptor>();

  /** Resolvers keyed by taskId — resolved when the task result arrives */
  private readonly pendingTasks = new Map<TaskId, (result: string) => void>();

  constructor(bus: MessageBus) {
    const profile: AgentProfile = {
      id          : "orchestrator",
      name        : "Charles",
      role        : "orchestrator",
      capabilities: ["task-decomposition", "task-dispatch", "result-aggregation"],
      systemPrompt: `You are the central orchestrator of a multi-agent software development team.
Your responsibilities:
  - Understand high-level goals and break them into concrete, assignable tasks.
  - Identify the type of specialist agent required. If it is missing, add it to the registry with its capabilities.
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
    this.logDecomposedTasks(tasks);
    this.planner.addTasks(tasks);

    // 3. Dispatch-loop: keep dispatching runnable tasks until all are done
    await this.dispatchLoop();

    // 4. Aggregate results
    return this.aggregate(goal);
  }

  // ─── Task decomposition ────────────────────────────────────────────────────

  /**
   * Two-phase decomposition:
   *  1) analyzeGoal(goal)
   *  2) decomposeFromAnalysis(goal, analysis)
   */
  private decompose(goal: string): Task[] {
    logger.info("orchestrator", "Analysing goal before decomposition…");
    const analysis = this.analyzeGoal(goal);
    logger.info("orchestrator", "Decomposing analysed goal into assignable tasks…");
    return this.decomposeFromAnalysis(goal, analysis);
  }

  /** Phase 1: infer major workstreams from the goal text. */
  private analyzeGoal(goal: string): GoalAnalysis {
    const text = goal.toLowerCase();
    return {
      requiresBackend: /(api|backend|service|auth|database|rbac|tenant|saas)/.test(text),
      requiresFrontend: /(frontend|ui|ux|web|mobile|dashboard|responsive)/.test(text),
      requiresRealtime: /(real[-\s]?time|websocket|collaboration|stream|sync)/.test(text),
      requiresSecurity: /(security|rbac|oauth|auth|compliance|privacy)/.test(text),
      requiresDocumentation: /(doc|documentation|readme|architecture|adr)/.test(text) || true,
      requiresQa: /(test|quality|qa|reliability)/.test(text) || true,
    };
  }

  /** Phase 2: create a dependency graph of tasks and assign each to a registered agent. */
  private decomposeFromAnalysis(goal: string, analysis: GoalAnalysis): Task[] {
    if (this.registry.size === 0) {
      throw new Error("OrchestratorAgent: no registered agents available for decomposition.");
    }

    const blueprints: TaskBlueprint[] = [];

    blueprints.push({
      key: "architecture",
      title: "Goal Analysis & Architecture",
      description: `Analyse the goal \"${goal}\" and define architecture, scope boundaries, and integration contracts.`,
      priority: "critical",
      dependsIn: [],
      preferredRoles: ["architect"],
      capabilityHints: ["system-architecture", "cloud-design", "api-contract-design", "technical-documentation"],
    });

    if (analysis.requiresBackend) {
      blueprints.push({
        key: "backend",
        title: "Backend API Development",
        description: "Implement backend APIs, domain logic, persistence, authentication and authorization based on the architecture.",
        priority: "high",
        dependsIn: ["architecture"],
        preferredRoles: ["developer"],
        capabilityHints: ["backend-development", "api-integration", "database-schema-design"],
      });
    }

    if (analysis.requiresFrontend) {
      blueprints.push({
        key: "frontend",
        title: "Frontend UI Development",
        description: "Build the frontend application with responsive UX and integrate it with the backend APIs.",
        priority: "high",
        dependsIn: ["architecture"],
        preferredRoles: ["developer"],
        capabilityHints: ["frontend-development", "api-integration"],
      });
    }

    if (analysis.requiresRealtime) {
      blueprints.push({
        key: "realtime",
        title: "Realtime Collaboration Layer",
        description: "Implement real-time collaboration capabilities (events, synchronization, conflict handling) aligned with the architecture.",
        priority: "high",
        dependsIn: ["architecture", ...(analysis.requiresBackend ? ["backend"] : [])],
        preferredRoles: ["developer", "architect"],
        capabilityHints: ["backend-development", "api-integration", "system-architecture"],
      });
    }

    if (analysis.requiresSecurity) {
      blueprints.push({
        key: "security",
        title: "Security & Access Control",
        description: "Implement RBAC/authN/authZ rules, secure defaults, and hardening measures for exposed surfaces.",
        priority: "high",
        dependsIn: ["architecture", ...(analysis.requiresBackend ? ["backend"] : [])],
        preferredRoles: ["developer", "architect"],
        capabilityHints: ["backend-development", "api-integration", "system-architecture"],
      });
    }

    if (analysis.requiresQa) {
      blueprints.push({
        key: "qa",
        title: "QA & Test Suite",
        description: "Design and implement unit, integration and end-to-end test suites and report defects with reproduction steps.",
        priority: "medium",
        dependsIn: [
          ...(analysis.requiresBackend ? ["backend"] : []),
          ...(analysis.requiresFrontend ? ["frontend"] : []),
          ...(analysis.requiresRealtime ? ["realtime"] : []),
          ...(analysis.requiresSecurity ? ["security"] : []),
          analysis.requiresBackend || analysis.requiresFrontend || analysis.requiresRealtime || analysis.requiresSecurity
            ? ""
            : "architecture",
        ].filter(Boolean),
        preferredRoles: ["qa-tester"],
        capabilityHints: ["unit-testing", "integration-testing", "e2e-testing", "performance-testing"],
      });
    }

    if (analysis.requiresDocumentation) {
      blueprints.push({
        key: "docs",
        title: "Technical Documentation",
        description: "Produce architecture notes, API usage documentation, and implementation decisions for maintainability.",
        priority: "low",
        dependsIn: [analysis.requiresQa ? "qa" : "architecture"],
        preferredRoles: ["architect", "developer"],
        capabilityHints: ["technical-documentation", "adr-writing", "api-integration"],
      });
    }

    const byKey = new Map<string, Task>();
    for (const blueprint of blueprints) {
      const assignedTo = this.assignAgent(blueprint.preferredRoles, blueprint.capabilityHints);
      const dependsOn = blueprint.dependsIn
        .map((depKey) => byKey.get(depKey)?.id)
        .filter((id): id is string => Boolean(id));

      const task = createTask({
        title: blueprint.title,
        description: blueprint.description,
        assignedTo,
        priority: blueprint.priority,
        dependsOn,
      });

      byKey.set(blueprint.key, task);
    }

    return this.orderTasksByDependencyAndPriority([...byKey.values()]);
  }

  /** Select the best available registered agent for a task. */
  private assignAgent(preferredRoles: string[], capabilityHints: string[]): AgentId {
    const agents = [...this.registry.values()];

    const roleMatch = agents.find((agent) => preferredRoles.includes(agent.role));
    if (roleMatch) return roleMatch.id;

    let best: AgentDescriptor | undefined;
    let bestScore = -1;

    for (const agent of agents) {
      const capabilitySet = new Set(agent.capabilities.map((c) => c.toLowerCase()));
      const score = capabilityHints.reduce((acc, hint) => acc + (capabilitySet.has(hint.toLowerCase()) ? 1 : 0), 0);
      if (score > bestScore) {
        best = agent;
        bestScore = score;
      }
    }

    if (best) return best.id;
    return agents[0].id;
  }

  /** Return tasks ordered by dependency graph first, priority second. */
  private orderTasksByDependencyAndPriority(tasks: Task[]): Task[] {
    const priorityRank: Record<Task["priority"], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    const byId = new Map(tasks.map((task) => [task.id, task]));
    const inDegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const task of tasks) {
      inDegree.set(task.id, task.dependsOn.length);
      outgoing.set(task.id, []);
    }

    for (const task of tasks) {
      for (const dep of task.dependsOn) {
        const list = outgoing.get(dep);
        if (list) list.push(task.id);
      }
    }

    const ready: Task[] = tasks
      .filter((task) => (inDegree.get(task.id) ?? 0) === 0)
      .sort((a, b) => {
        const p = priorityRank[a.priority] - priorityRank[b.priority];
        return p !== 0 ? p : a.title.localeCompare(b.title);
      });

    const ordered: Task[] = [];
    while (ready.length > 0) {
      const current = ready.shift();
      if (!current) break;
      ordered.push(current);

      const nextIds = outgoing.get(current.id) ?? [];
      for (const nextId of nextIds) {
        const degree = (inDegree.get(nextId) ?? 0) - 1;
        inDegree.set(nextId, degree);
        if (degree === 0) {
          const nextTask = byId.get(nextId);
          if (nextTask) ready.push(nextTask);
        }
      }

      ready.sort((a, b) => {
        const p = priorityRank[a.priority] - priorityRank[b.priority];
        return p !== 0 ? p : a.title.localeCompare(b.title);
      });
    }

    if (ordered.length !== tasks.length) {
      throw new Error("OrchestratorAgent: invalid dependency graph detected (cycle or missing task dependency).");
    }

    return ordered;
  }

  /** Debug helper: print decomposed tasks in graph/priority order before dispatch. */
  private logDecomposedTasks(tasks: Task[]): void {
    logger.info("orchestrator", `Decomposition output: ${tasks.length} task(s) ready for dispatch`);
    for (const [index, task] of tasks.entries()) {
      const dependsOn = task.dependsOn.length > 0 ? task.dependsOn.join(", ") : "none";
      logger.info(
        "orchestrator",
        `  ${index + 1}. [${task.priority.toUpperCase()}] ${task.title} | assignedTo=${task.assignedTo} | dependsOn=${dependsOn}`
      );
    }
    logger.divider();
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

}
