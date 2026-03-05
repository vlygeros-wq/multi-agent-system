import { Task, TaskId, TaskStatus, AgentId } from "../types";
export declare function createTask(partial: Omit<Task, "id" | "createdAt" | "status"> & Partial<Pick<Task, "id" | "createdAt" | "status">>): Task;
export declare class TaskPlanner {
    private readonly tasks;
    addTask(task: Task): void;
    addTasks(tasks: Task[]): void;
    updateStatus(taskId: TaskId, status: TaskStatus): void;
    recordResult(taskId: TaskId, result: string, payload?: Record<string, unknown>): void;
    getRunnableTasks(): Task[];
    getTask(taskId: TaskId): Task | undefined;
    getAllTasks(): Task[];
    getTasksByAgent(agentId: AgentId): Task[];
    getTasksByStatus(status: TaskStatus): Task[];
    isComplete(): boolean;
    hasFailed(): boolean;
    summary(): string;
    private getOrThrow;
}
