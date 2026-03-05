"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskPlanner = void 0;
exports.createTask = createTask;
const ids_1 = require("../utils/ids");
const logger_1 = require("../utils/logger");
function createTask(partial) {
    return {
        id: partial.id ?? (0, ids_1.generateTaskId)(),
        status: partial.status ?? "pending",
        createdAt: partial.createdAt ?? new Date(),
        title: partial.title,
        description: partial.description,
        assignedTo: partial.assignedTo,
        priority: partial.priority,
        dependsOn: partial.dependsOn ?? [],
    };
}
class TaskPlanner {
    constructor() {
        this.tasks = new Map();
    }
    addTask(task) {
        this.tasks.set(task.id, task);
        logger_1.logger.info("orchestrator", `Task registered: [${task.id}] "${task.title}" → assigned to ${task.assignedTo}`);
    }
    addTasks(tasks) {
        tasks.forEach((t) => this.addTask(t));
    }
    updateStatus(taskId, status) {
        const task = this.getOrThrow(taskId);
        const prev = task.status;
        task.status = status;
        if (status === "in-progress")
            task.startedAt = new Date();
        if (status === "completed" || status === "failed")
            task.completedAt = new Date();
        logger_1.logger.info("orchestrator", `Task [${taskId}] status: ${prev} → ${status}`);
    }
    recordResult(taskId, result, payload) {
        const task = this.getOrThrow(taskId);
        task.result = result;
        task.resultPayload = payload;
        this.updateStatus(taskId, "completed");
    }
    getRunnableTasks() {
        return [...this.tasks.values()].filter((task) => {
            if (task.status !== "pending")
                return false;
            return task.dependsOn.every((depId) => {
                const dep = this.tasks.get(depId);
                return dep?.status === "completed";
            });
        });
    }
    getTask(taskId) {
        return this.tasks.get(taskId);
    }
    getAllTasks() {
        return [...this.tasks.values()];
    }
    getTasksByAgent(agentId) {
        return [...this.tasks.values()].filter((t) => t.assignedTo === agentId);
    }
    getTasksByStatus(status) {
        return [...this.tasks.values()].filter((t) => t.status === status);
    }
    isComplete() {
        return [...this.tasks.values()].every((t) => t.status === "completed" || t.status === "failed");
    }
    hasFailed() {
        return [...this.tasks.values()].some((t) => t.status === "failed");
    }
    summary() {
        const all = this.getAllTasks();
        const done = this.getTasksByStatus("completed").length;
        const fail = this.getTasksByStatus("failed").length;
        const prog = this.getTasksByStatus("in-progress").length;
        const pend = this.getTasksByStatus("pending").length;
        return [
            `Tasks summary (total: ${all.length})`,
            `  ✔ completed  : ${done}`,
            `  ✖ failed     : ${fail}`,
            `  ⏳ in-progress: ${prog}`,
            `  ⏸ pending    : ${pend}`,
        ].join("\n");
    }
    getOrThrow(taskId) {
        const task = this.tasks.get(taskId);
        if (!task)
            throw new Error(`TaskPlanner: unknown task id "${taskId}"`);
        return task;
    }
}
exports.TaskPlanner = TaskPlanner;
