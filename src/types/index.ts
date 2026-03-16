/**
 * Core type definitions for the multi-agent system.
 */

/** Unique identifier type alias for clarity */
export type AgentId = string;
export type MessageId = string;
export type TaskId = string;

/** All recognized agent roles in the system */
export type AgentRole =
  | "orchestrator"
  | "architect"
  | "developer"
  | "qa-tester";

/** Lifecycle states a task can be in */
export type TaskStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "failed"
  | "blocked";

/** Message types flowing through the bus */
export type MessageType =
  | "task-assignment"   // Orchestrator → Agent: here is your task
  | "task-result"       // Agent → Orchestrator: here is my output
  | "inter-agent"       // Agent → Agent: peer collaboration
  | "broadcast"         // One → All: system-wide notification
  | "status-update"     // Agent → Orchestrator: progress ping
  | "clarification-request"  // Agent → Orchestrator: need more info
  | "clarification-response"; // Orchestrator → Agent: answer to clarification

/** A single message travelling over the MessageBus */
export interface Message {
  id: MessageId;
  type: MessageType;
  sender: AgentId;
  recipient: AgentId | "broadcast";
  timestamp: Date;
  content: string;
  /** Arbitrary structured payload (task data, results, etc.) */
  payload?: Record<string, unknown>;
  /** Optional correlation id to chain request/response pairs */
  correlationId?: MessageId;
}

/** Represents a unit of work the orchestrator creates and assigns */
export interface Task {
  id: TaskId;
  title: string;
  description: string;
  assignedTo: AgentId;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "critical";
  /** IDs of tasks that must complete before this one can start */
  dependsOn: TaskId[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  /** The raw output returned by the executing agent */
  result?: string;
  /** Structured result payload */
  resultPayload?: Record<string, unknown>;
}

/** Transcript entry for task clarification during execution */
export interface ClarificationTurn {
  senderId: AgentId;
  responderId: AgentId;
  question: string;
  answer: string;
}

/** Snapshot of conversation turn stored per-agent */
export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

/** Profile that uniquely describes an agent */
export interface AgentProfile {
  id: AgentId;
  name: string;
  role: AgentRole;
  /** Detailed system prompt injected at construction time */
  systemPrompt: string;
  capabilities: string[];
}
