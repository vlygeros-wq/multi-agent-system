"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageBus = void 0;
const events_1 = __importDefault(require("events"));
const logger_1 = require("../utils/logger");
const ids_1 = require("../utils/ids");
class MessageBus extends events_1.default {
    constructor() {
        super();
        this.messageLog = [];
        this.subscribers = new Map();
        this.setMaxListeners(50);
    }
    subscribe(agentId, handler) {
        if (!this.subscribers.has(agentId)) {
            this.subscribers.set(agentId, []);
        }
        this.subscribers.get(agentId).push(handler);
        logger_1.logger.bus(`Agent "${agentId}" subscribed.`);
    }
    unsubscribe(agentId) {
        this.subscribers.delete(agentId);
        logger_1.logger.bus(`Agent "${agentId}" unsubscribed.`);
    }
    async publish(partial) {
        const message = {
            id: partial.id ?? (0, ids_1.generateMessageId)(),
            timestamp: partial.timestamp ?? new Date(),
            ...partial,
        };
        this.messageLog.push(message);
        logger_1.logger.bus(`📨 [${message.type}] ${message.sender} → ${message.recipient} | "${message.content.slice(0, 80)}${message.content.length > 80 ? "…" : ""}"`);
        if (message.recipient !== "broadcast") {
            await this.deliver(message.recipient, message);
        }
        if (message.recipient === "broadcast") {
            const deliveries = [...this.subscribers.keys()].map((id) => this.deliver(id, message));
            await Promise.all(deliveries);
        }
        this.emit("message", message);
        return message;
    }
    async deliver(agentId, message) {
        const handlers = this.subscribers.get(agentId);
        if (!handlers || handlers.length === 0) {
            logger_1.logger.warn("bus", `No subscriber found for agent "${agentId}" — message dropped.`);
            return;
        }
        await Promise.resolve();
        for (const handler of handlers) {
            try {
                await handler(message);
            }
            catch (err) {
                logger_1.logger.error("bus", `Handler error for agent "${agentId}": ${String(err)}`);
            }
        }
    }
    getLog() {
        return [...this.messageLog];
    }
    getMessage(id) {
        return this.messageLog.find((m) => m.id === id);
    }
    getConversation(agentA, agentB) {
        return this.messageLog.filter((m) => (m.sender === agentA && m.recipient === agentB) ||
            (m.sender === agentB && m.recipient === agentA));
    }
    get totalMessages() {
        return this.messageLog.length;
    }
}
exports.MessageBus = MessageBus;
