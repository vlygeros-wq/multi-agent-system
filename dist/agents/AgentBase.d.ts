import { AgentProfile, AgentId, Message, MessageType, Task, ConversationTurn } from "../types";
import { MessageBus } from "../flow/MessageBus";
export declare abstract class AgentBase {
    readonly profile: AgentProfile;
    protected readonly bus: MessageBus;
    protected readonly history: ConversationTurn[];
    constructor(profile: AgentProfile, bus: MessageBus);
    get id(): AgentId;
    get name(): string;
    get role(): string;
    protected send(recipient: AgentId | "broadcast", type: MessageType, content: string, payload?: Record<string, unknown>, correlationId?: string): Promise<Message>;
    private onMessage;
    protected abstract handleMessage(message: Message): Promise<void>;
    abstract executeTask(task: Task): Promise<string>;
    protected recordTurn(role: "user" | "assistant" | "system", content: string): void;
    getHistory(): Readonly<ConversationTurn[]>;
    shutdown(): void;
}
