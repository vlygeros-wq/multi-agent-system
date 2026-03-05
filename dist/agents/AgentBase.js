"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentBase = void 0;
const logger_1 = require("../utils/logger");
class AgentBase {
    constructor(profile, bus) {
        this.history = [];
        this.profile = profile;
        this.bus = bus;
        this.history.push({
            role: "system",
            content: profile.systemPrompt,
            timestamp: new Date(),
        });
        this.bus.subscribe(this.id, (msg) => this.onMessage(msg));
        logger_1.logger.info(profile.role, `Agent "${profile.name}" (${profile.id}) initialised.`);
    }
    get id() { return this.profile.id; }
    get name() { return this.profile.name; }
    get role() { return this.profile.role; }
    async send(recipient, type, content, payload, correlationId) {
        const msg = await this.bus.publish({
            type,
            sender: this.id,
            recipient,
            content,
            payload,
            correlationId,
        });
        this.recordTurn("assistant", `→ [${recipient}] ${content}`);
        return msg;
    }
    async onMessage(message) {
        logger_1.logger.info(this.role, `"${this.name}" received [${message.type}] from ${message.sender}: "${message.content.slice(0, 120)}"`);
        this.recordTurn("user", `← [${message.sender}] ${message.content}`);
        await this.handleMessage(message);
    }
    recordTurn(role, content) {
        this.history.push({ role, content, timestamp: new Date() });
    }
    getHistory() {
        return [...this.history];
    }
    shutdown() {
        this.bus.unsubscribe(this.id);
        logger_1.logger.warn(this.role, `Agent "${this.name}" shut down.`);
    }
}
exports.AgentBase = AgentBase;
