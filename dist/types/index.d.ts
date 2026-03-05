export type AgentId = string;
export type MessageId = string;
export type TaskId = string;
export type AgentRole = "orchestrator" | "architect" | "developer" | "qa-tester";
export type TaskStatus = "pending" | "in-progress" | "completed" | "failed" | "blocked";
export type MessageType = "task-assignment" | "task-result" | "inter-agent" | "broadcast" | "status-update" | "clarification-request" | "clarification-response";
export interface Message {
    id: MessageId;
    type: MessageType;
    sender: AgentId;
    recipient: AgentId | "broadcast";
    timestamp: Date;
    content: string;
    payload?: Record<string, unknown>;
    correlationId?: MessageId;
}
export interface Task {
    id: TaskId;
    title: string;
    description: string;
    assignedTo: AgentId;
    status: TaskStatus;
    priority: "low" | "medium" | "high" | "critical";
    dependsOn: TaskId[];
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    result?: string;
    resultPayload?: Record<string, unknown>;
}
export interface ConversationTurn {
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
}
export interface AgentProfile {
    id: AgentId;
    name: string;
    role: AgentRole;
    systemPrompt: string;
    capabilities: string[];
}
