/**
 * Lightweight, colour-coded logger for the multi-agent system.
 * Each agent role gets its own colour so log lines are easy to follow.
 */

const RESET = "\x1b[0m";
const BOLD  = "\x1b[1m";

const COLOURS: Record<string, string> = {
  orchestrator : "\x1b[35m", // magenta
  "architect"  : "\x1b[36m", // cyan
  developer    : "\x1b[32m", // green
  "qa-tester"  : "\x1b[33m", // yellow
  bus          : "\x1b[34m", // blue
  system       : "\x1b[37m", // white
};

function colour(role: string, text: string): string {
  const c = COLOURS[role] ?? COLOURS.system;
  return `${c}${text}${RESET}`;
}

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(source: string, message: string): void {
    console.log(`${BOLD}[${timestamp()}]${RESET} ${colour(source, `[${source.toUpperCase()}]`)} ${message}`);
  },
  warn(source: string, message: string): void {
    console.warn(`${BOLD}[${timestamp()}]${RESET} ${colour(source, `[${source.toUpperCase()}] ⚠`)} ${message}`);
  },
  error(source: string, message: string): void {
    console.error(`${BOLD}[${timestamp()}]${RESET} \x1b[31m[${source.toUpperCase()}] ✖${RESET} ${message}`);
  },
  success(source: string, message: string): void {
    console.log(`${BOLD}[${timestamp()}]${RESET} ${colour(source, `[${source.toUpperCase()}] ✔`)} ${message}`);
  },
  bus(message: string): void {
    console.log(`${BOLD}[${timestamp()}]${RESET} ${colour("bus", "[BUS]")} ${message}`);
  },
  divider(): void {
    console.log("\x1b[90m" + "─".repeat(80) + RESET);
  },
};
