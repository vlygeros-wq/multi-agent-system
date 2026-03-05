import { AgentBase } from "./AgentBase";
import { MessageBus } from "../flow/MessageBus";
import { AgentId, Message, Task } from "../types";
export interface AgentDescriptor {
    id: AgentId;
    role: string;
    capabilities: string[];
}
export declare class OrchestratorAgent extends AgentBase {
    private readonly planner;
    private readonly registry;
    private readonly pendingTasks;
    constructor(bus: MessageBus);
    registerAgent(descriptor: AgentDescriptor): void;
    run(goal: string): Promise<string>;
    private decompose;
    private dispatchLoop;
    private dispatch;
    private buildContextForTask;
    private awaitTaskResult;
    private waitForAnyResult;
    protected handleMessage(message: Message): Promise<void>;
    executeTask(_task: Task): Promise<string>;
    private aggregate;
    private findAgent;
}
