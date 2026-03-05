"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorAgent = void 0;
const AgentBase_1 = require("./AgentBase");
const TaskPlanner_1 = require("../tasks/TaskPlanner");
const logger_1 = require("../utils/logger");
class OrchestratorAgent extends AgentBase_1.AgentBase {
    constructor(bus) {
        const profile = {
            id: "orchestrator",
            name: "Charles (Orchestrator)",
            role: "orchestrator",
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
        this.planner = new TaskPlanner_1.TaskPlanner();
        this.registry = new Map();
        this.pendingTasks = new Map();
    }
    registerAgent(descriptor) {
        this.registry.set(descriptor.id, descriptor);
        logger_1.logger.info("orchestrator", `Registered agent: ${descriptor.id} (${descriptor.role})`);
    }
    async run(goal) {
        logger_1.logger.divider();
        logger_1.logger.info("orchestrator", `🎯 New goal received: "${goal}"`);
        logger_1.logger.divider();
        await this.send("broadcast", "broadcast", `New project goal: ${goal}`, { goal });
        const tasks = this.decompose(goal);
        this.planner.addTasks(tasks);
        await this.dispatchLoop();
        return this.aggregate(goal);
    }
    decompose(goal) {
        logger_1.logger.info("orchestrator", "Decomposing goal into tasks…");
        const architectId = this.findAgent("architect");
        const developerId = this.findAgent("developer");
        const qaId = this.findAgent("qa-tester");
        const t1 = (0, TaskPlanner_1.createTask)({
            title: "System Architecture Design",
            description: `Analyse the goal "${goal}" and produce a high-level SaaS architecture: services, data flows, tech-stack choices, and deployment model.`,
            assignedTo: architectId,
            priority: "critical",
            dependsOn: [],
        });
        const t2 = (0, TaskPlanner_1.createTask)({
            title: "Backend API Development",
            description: "Implement the REST/GraphQL API layer based on the architecture specification. Include auth, data models, and core business logic.",
            assignedTo: developerId,
            priority: "high",
            dependsOn: [t1.id],
        });
        const t3 = (0, TaskPlanner_1.createTask)({
            title: "Frontend UI Development",
            description: "Build the React/TypeScript frontend that consumes the API. Include routing, state management, and responsive layout.",
            assignedTo: developerId,
            priority: "high",
            dependsOn: [t1.id],
        });
        const t4 = (0, TaskPlanner_1.createTask)({
            title: "QA & Test Suite",
            description: "Write unit, integration, and E2E tests for both backend and frontend. Identify and report any bugs or coverage gaps.",
            assignedTo: qaId,
            priority: "high",
            dependsOn: [t2.id, t3.id],
        });
        const t5 = (0, TaskPlanner_1.createTask)({
            title: "Technical Documentation",
            description: "Produce API reference docs, architecture diagrams (text-based), and a README for the project.",
            assignedTo: architectId,
            priority: "medium",
            dependsOn: [t4.id],
        });
        return [t1, t2, t3, t4, t5];
    }
    async dispatchLoop() {
        while (!this.planner.isComplete()) {
            const runnable = this.planner.getRunnableTasks();
            if (runnable.length === 0) {
                await this.waitForAnyResult();
                continue;
            }
            await Promise.all(runnable.map((task) => this.dispatch(task)));
        }
        logger_1.logger.success("orchestrator", "All tasks completed!");
        logger_1.logger.info("orchestrator", "\n" + this.planner.summary());
    }
    async dispatch(task) {
        this.planner.updateStatus(task.id, "in-progress");
        logger_1.logger.info("orchestrator", `Dispatching task [${task.id}] "${task.title}" → ${task.assignedTo}`);
        const resultPromise = this.awaitTaskResult(task.id);
        const context = this.buildContextForTask(task);
        await this.send(task.assignedTo, "task-assignment", task.description, { task, context });
        const result = await resultPromise;
        this.planner.recordResult(task.id, result);
    }
    buildContextForTask(task) {
        const ctx = {};
        for (const depId of task.dependsOn) {
            const dep = this.planner.getTask(depId);
            if (dep?.result) {
                ctx[dep.title] = dep.result;
            }
        }
        return ctx;
    }
    awaitTaskResult(taskId) {
        return new Promise((resolve) => {
            this.pendingTasks.set(taskId, resolve);
        });
    }
    waitForAnyResult() {
        return new Promise((resolve) => {
            const check = () => {
                if (this.planner.getRunnableTasks().length > 0 || this.planner.isComplete()) {
                    resolve();
                }
                else {
                    setTimeout(check, 50);
                }
            };
            setTimeout(check, 50);
        });
    }
    async handleMessage(message) {
        switch (message.type) {
            case "task-result": {
                const taskId = message.payload?.taskId;
                if (!taskId) {
                    logger_1.logger.warn("orchestrator", `Received task-result without taskId from ${message.sender}`);
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
                logger_1.logger.info("orchestrator", `Clarification requested by ${message.sender}: "${message.content}"`);
                await this.send(message.sender, "clarification-response", `Proceed with best-practice defaults for: "${message.content}". Prioritise scalability and maintainability.`, undefined, message.id);
                break;
            }
            case "status-update": {
                logger_1.logger.info("orchestrator", `Status from ${message.sender}: ${message.content}`);
                break;
            }
            default:
                break;
        }
    }
    async executeTask(_task) {
        throw new Error("OrchestratorAgent does not execute tasks directly.");
    }
    aggregate(goal) {
        const tasks = this.planner.getAllTasks();
        const lines = [
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
                .forEach((l) => lines.push(`│    ${l}`));
            lines.push("│");
        }
        lines.push("└" + "─".repeat(68));
        lines.push(`\n  Total messages on bus: ${this.bus.totalMessages}`);
        return lines.join("\n");
    }
    findAgent(role) {
        for (const [id, desc] of this.registry) {
            if (desc.role === role)
                return id;
        }
        throw new Error(`OrchestratorAgent: no agent found for role "${role}"`);
    }
}
exports.OrchestratorAgent = OrchestratorAgent;
