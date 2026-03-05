"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MessageBus_1 = require("./flow/MessageBus");
const agents_1 = require("./agents");
const logger_1 = require("./utils/logger");
async function main() {
    logger_1.logger.divider();
    logger_1.logger.info("system", "🚀 Multi-Agent System starting…");
    logger_1.logger.divider();
    const bus = new MessageBus_1.MessageBus();
    const architect = new agents_1.ArchitectAgent(bus, "architect");
    const developer = new agents_1.DeveloperAgent(bus, "developer");
    const qaTester = new agents_1.QATesterAgent(bus, "qa-tester");
    const orchestrator = new agents_1.OrchestratorAgent(bus);
    orchestrator.registerAgent({
        id: architect.id,
        role: architect.role,
        capabilities: architect.profile.capabilities,
    });
    orchestrator.registerAgent({
        id: developer.id,
        role: developer.role,
        capabilities: developer.profile.capabilities,
    });
    orchestrator.registerAgent({
        id: qaTester.id,
        role: qaTester.role,
        capabilities: qaTester.profile.capabilities,
    });
    logger_1.logger.divider();
    logger_1.logger.info("system", "All agents registered. Launching demo scenario…");
    logger_1.logger.divider();
    const goal = "Build a multi-tenant SaaS project-management platform with real-time " +
        "collaboration, role-based access control, and a mobile-responsive UI.";
    const report = await orchestrator.run(goal);
    logger_1.logger.divider();
    console.log("\n" + report + "\n");
    logger_1.logger.divider();
    printBusStats(bus);
    printAgentStats([orchestrator, architect, developer, qaTester]);
    [orchestrator, architect, developer, qaTester].forEach((a) => a.shutdown());
    logger_1.logger.info("system", "✅ Demo complete. All agents shut down.");
}
function printBusStats(bus) {
    const log = bus.getLog();
    const byType = log.reduce((acc, m) => {
        acc[m.type] = (acc[m.type] ?? 0) + 1;
        return acc;
    }, {});
    logger_1.logger.info("system", `📊 MessageBus statistics (total: ${bus.totalMessages} messages)`);
    for (const [type, count] of Object.entries(byType)) {
        console.log(`      ${type.padEnd(28)} × ${count}`);
    }
    logger_1.logger.divider();
}
function printAgentStats(agents) {
    logger_1.logger.info("system", "📝 Agent conversation history lengths:");
    for (const agent of agents) {
        console.log(`      ${agent.name.padEnd(30)} ${agent.getHistory().length} turns`);
    }
    logger_1.logger.divider();
}
main().catch((err) => {
    logger_1.logger.error("system", `Fatal error: ${String(err)}`);
    process.exit(1);
});
