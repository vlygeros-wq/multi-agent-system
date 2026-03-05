/**
 * Simple deterministic ID generators.
 * In production you would swap these for uuid v4 or nanoid.
 */

let msgCounter  = 0;
let taskCounter = 0;

export function generateMessageId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

export function generateTaskId(): string {
  return `task-${Date.now()}-${++taskCounter}`;
}

export function generateAgentId(role: string): string {
  return `${role}-${Math.random().toString(36).slice(2, 8)}`;
}
