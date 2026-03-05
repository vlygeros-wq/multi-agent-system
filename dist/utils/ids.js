"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMessageId = generateMessageId;
exports.generateTaskId = generateTaskId;
exports.generateAgentId = generateAgentId;
let msgCounter = 0;
let taskCounter = 0;
function generateMessageId() {
    return `msg-${Date.now()}-${++msgCounter}`;
}
function generateTaskId() {
    return `task-${Date.now()}-${++taskCounter}`;
}
function generateAgentId(role) {
    return `${role}-${Math.random().toString(36).slice(2, 8)}`;
}
