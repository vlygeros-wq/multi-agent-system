import { AgentBase } from "./AgentBase";
import { MessageBus } from "../flow/MessageBus";
import { AgentId, Message, Task } from "../types";
export declare class ArchitectAgent extends AgentBase {
    constructor(bus: MessageBus, idOverride?: AgentId);
    protected handleMessage(message: Message): Promise<void>;
    executeTask(task: Task): Promise<string>;
    private produceArchitecture;
    private produceDocumentation;
    private answerArchitecturalQuery;
}
