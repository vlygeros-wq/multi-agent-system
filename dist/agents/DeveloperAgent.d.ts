import { AgentBase } from "./AgentBase";
import { MessageBus } from "../flow/MessageBus";
import { AgentId, Message, Task } from "../types";
export declare class DeveloperAgent extends AgentBase {
    private readonly interAgentResponses;
    constructor(bus: MessageBus, idOverride?: AgentId);
    protected handleMessage(message: Message): Promise<void>;
    executeTask(task: Task): Promise<string>;
    private buildBackend;
    private buildFrontend;
}
