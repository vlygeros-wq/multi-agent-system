import { AgentBase } from "./AgentBase";
import { MessageBus } from "../flow/MessageBus";
import { AgentId, Message, Task } from "../types";
export declare class QATesterAgent extends AgentBase {
    private readonly clarifications;
    constructor(bus: MessageBus, idOverride?: AgentId);
    protected handleMessage(message: Message): Promise<void>;
    executeTask(task: Task): Promise<string>;
    private requestClarification;
    private produceTestSuite;
}
