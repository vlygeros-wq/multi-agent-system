import EventEmitter from "events";
import { Message, AgentId, MessageId } from "../types";
export type MessageHandler = (message: Message) => void | Promise<void>;
export declare class MessageBus extends EventEmitter {
    private readonly messageLog;
    private readonly subscribers;
    constructor();
    subscribe(agentId: AgentId, handler: MessageHandler): void;
    unsubscribe(agentId: AgentId): void;
    publish(partial: Omit<Message, "id" | "timestamp"> & Partial<Pick<Message, "id" | "timestamp">>): Promise<Message>;
    private deliver;
    getLog(): Readonly<Message[]>;
    getMessage(id: MessageId): Message | undefined;
    getConversation(agentA: AgentId, agentB: AgentId): Message[];
    get totalMessages(): number;
}
