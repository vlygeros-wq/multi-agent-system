"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const COLOURS = {
    orchestrator: "\x1b[35m",
    "architect": "\x1b[36m",
    developer: "\x1b[32m",
    "qa-tester": "\x1b[33m",
    bus: "\x1b[34m",
    system: "\x1b[37m",
};
function colour(role, text) {
    const c = COLOURS[role] ?? COLOURS.system;
    return `${c}${text}${RESET}`;
}
function timestamp() {
    return new Date().toISOString();
}
exports.logger = {
    info(source, message) {
        console.log(`${BOLD}[${timestamp()}]${RESET} ${colour(source, `[${source.toUpperCase()}]`)} ${message}`);
    },
    warn(source, message) {
        console.warn(`${BOLD}[${timestamp()}]${RESET} ${colour(source, `[${source.toUpperCase()}] ⚠`)} ${message}`);
    },
    error(source, message) {
        console.error(`${BOLD}[${timestamp()}]${RESET} \x1b[31m[${source.toUpperCase()}] ✖${RESET} ${message}`);
    },
    success(source, message) {
        console.log(`${BOLD}[${timestamp()}]${RESET} ${colour(source, `[${source.toUpperCase()}] ✔`)} ${message}`);
    },
    bus(message) {
        console.log(`${BOLD}[${timestamp()}]${RESET} ${colour("bus", "[BUS]")} ${message}`);
    },
    divider() {
        console.log("\x1b[90m" + "─".repeat(80) + RESET);
    },
};
