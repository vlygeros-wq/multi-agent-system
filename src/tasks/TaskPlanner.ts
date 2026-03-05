/**
 * Task & TaskPlanner
 * ------------------
 * `Task` is a plain value-object representing a unit of work.
 * `TaskPlanner` is a stateful service that the OrchestratorAgent uses to:
 *   - decompose a high-level goal into an ordered list of tasks,
 *   - track task lifecycle,
 *   - surface the next runnable tasks (all dependencies satisfied).
 */

import {
  Task,
  TaskId,
  TaskStatus,
  AgentId,
} from "../types";
import { generateTaskId } from "../utils/ids";
import { logger } from "../utils/logger";

// ─── Task factory ─────────────────────────────────────────────────────────────

export function createTask(
  partial: Omit<Task, "id" | "createdAt" | "status">  &
    Partial<Pick<Task, "id" | "createdAt" | "status">>
): Task {
  return {
    id        : partial.id ?? generateTaskId(),
    status    : partial.status ?? "pending",
    createdAt : partial.createdAt ?? new Date(),
    title     : partial.title,
    description: partial.description,
    assignedTo: partial.assignedTo,
    priority  : partial.priority,
    dependsOn : partial.dependsOn ?? [],
  } as Task;
}

// ─── TaskPlanner ──────────────────────────────────────────────────────────────

export class TaskPlanner {
  private readonly tasks = new Map<TaskId, Task>();

  // ─── Registration ──────────────────────────────────────────────────────────

  /** Add a task to the planner's registry */
  addTask(task: Task): void {
    this.tasks.set(task.id, task);
    logger.info("orchestrator", `Task registered: [${task.id}] "${task.title}" → assigned to ${task.assignedTo}`);
  }

  /** Add many tasks at once */
  addTasks(tasks: Task[]): void {
    tasks.forEach((t) => this.addTask(t));
  }

  // ─── Lifecycle transitions ─────────────────────────────────────────────────

  updateStatus(taskId: TaskId, status: TaskStatus): void {
    const task = this.getOrThrow(taskId);
    const prev = task.status;
    task.status = status;

    if (status === "in-progress") task.startedAt = new Date();
    if (status === "completed" || status === "failed") task.completedAt = new Date();

    logger.info("orchestrator", `Task [${taskId}] status: ${prev} → ${status}`);
  }

  recordResult(taskId: TaskId, result: string, payload?: Record<string, unknown>): void {
    const task = this.getOrThrow(taskId);
    task.result = result;
    task.resultPayload = payload;
    this.updateStatus(taskId, "completed");
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  /**
   * Return all tasks whose dependencies have been completed and which are
   * still in "pending" state — i.e. ready to be dispatched right now.
   */
  getRunnableTasks(): Task[] {
    return [...this.tasks.values()].filter((task) => {
      if (task.status !== "pending") return false;
      return task.dependsOn.every((depId) => {
        const dep = this.tasks.get(depId);
        return dep?.status === "completed";
      });
    });
  }

  getTask(taskId: TaskId): Task | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): Task[] {
    return [...this.tasks.values()];
  }

  getTasksByAgent(agentId: AgentId): Task[] {
    return [...this.tasks.values()].filter((t) => t.assignedTo === agentId);
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return [...this.tasks.values()].filter((t) => t.status === status);
  }

  isComplete(): boolean {
    return [...this.tasks.values()].every(
      (t) => t.status === "completed" || t.status === "failed"
    );
  }

  hasFailed(): boolean {
    return [...this.tasks.values()].some((t) => t.status === "failed");
  }

  // ─── Reporting ─────────────────────────────────────────────────────────────

  summary(): string {
    const all   = this.getAllTasks();
    const done  = this.getTasksByStatus("completed").length;
    const fail  = this.getTasksByStatus("failed").length;
    const prog  = this.getTasksByStatus("in-progress").length;
    const pend  = this.getTasksByStatus("pending").length;

    return [
      `Tasks summary (total: ${all.length})`,
      `  ✔ completed  : ${done}`,
      `  ✖ failed     : ${fail}`,
      `  ⏳ in-progress: ${prog}`,
      `  ⏸ pending    : ${pend}`,
    ].join("\n");
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private getOrThrow(taskId: TaskId): Task {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`TaskPlanner: unknown task id "${taskId}"`);
    return task;
  }
}
