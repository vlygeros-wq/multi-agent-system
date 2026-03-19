/**
 * index.ts — Multi-Agent System Demo
 * ====================================
 *
 * This file bootstraps the entire system and runs a demonstration showing
 * how the OrchestratorAgent decomposes a goal, dispatches tasks to
 * specialist agents via the MessageBus, handles clarification flows,
 * and aggregates a final report.
 *
 * Usage:
 *   npx ts-node --esm src/index.ts
 *   -- or (after build) --
 *   node dist/index.js
 */

import { MessageBus } from "./flow/MessageBus";
import {
  OrchestratorAgent,
  ArchitectAgent,
  DeveloperAgent,
  QATesterAgent,
} from "./agents";
import { logger } from "./utils/logger";
import { createLLM } from "./services/llm/factory";
import { config } from "dotenv";

// ─── System bootstrap ─────────────────────────────────────────────────────────

config({ path: "./.env" });


async function main(): Promise<void> {
  
  if ( false ) {
    const llm = createLLM(process.env.LLM_PROVIDER || "gemini");
    const response = await llm.generate("Tell me about quantum computing.");
    logger.info("LLM Response", response);
    process.exit(0);
  }

  logger.divider();
  logger.info("system", "🚀 Multi-Agent System starting…");
  logger.divider();

  // 1. Create the shared MessageBus — the only communication channel
  const bus = new MessageBus();

  // 2. Instantiate specialist agents
  //    Each agent self-registers with the bus in its constructor.
  const architect = new ArchitectAgent(bus, "architect");
  const developer = new DeveloperAgent(bus, "developer");
  const qaTester  = new QATesterAgent(bus, "qa-tester");

  // 3. Instantiate the orchestrator and register the specialists
  const orchestrator = new OrchestratorAgent(bus);

  orchestrator.registerAgent({
    id          : architect.id,
    role        : architect.role,
    capabilities: architect.profile.capabilities,
  });

  orchestrator.registerAgent({
    id          : developer.id,
    role        : developer.role,
    capabilities: developer.profile.capabilities,
  });

  orchestrator.registerAgent({
    id          : qaTester.id,
    role        : qaTester.role,
    capabilities: qaTester.profile.capabilities,
  });

  logger.divider();
  logger.info("system", "All agents registered. Launching demo scenario…");
  logger.divider();

  // 4. Define the high-level goal
  const goal =
    `Build a web-based debt collection application that enables financial and insurance 
    teams to monitor unpaid invoices, assess client risk levels, and prioritize collection 
    actions.
    Define the structure of the project repository, including a clear README and documentation for future developers.
    Define the system architecture, implement the backend and frontend components, and ensure
    the application is robustly tested.
    The system must implement a secure authentication mechanism, role-based access control, and an intuitive UI.
    All displays should be mobile-responsive. The backend should expose a RESTful API for all core functionalities.
    All lists of clients and invoices must be filterable and sortable.
    The system must provide a KPI-driven dashboard and a detailed client list with 
    invoice and insurance-risk information.`;

  // 5. Run the full orchestration pipeline
  const report = await orchestrator.run(goal);

  // 6. Print the aggregated report
  logger.divider();
  console.log("\n" + report + "\n");
  logger.divider();

  // 7. Print message-bus statistics
  printBusStats(bus);

  // 8. Print each agent's conversation history length
  printAgentStats([orchestrator, architect, developer, qaTester]);

  // 9. Clean shutdown
  [orchestrator, architect, developer, qaTester].forEach((a) => a.shutdown());
  logger.info("system", "✅ Demo complete. All agents shut down.");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function printBusStats(bus: MessageBus): void {
  const log = bus.getLog();
  const byType = log.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] ?? 0) + 1;
    return acc;
  }, {});

  logger.info("system", `📊 MessageBus statistics (total: ${bus.totalMessages} messages)`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`      ${type.padEnd(28)} × ${count}`);
  }
  logger.divider();
}

function printAgentStats(agents: Array<{ name: string; getHistory: () => readonly unknown[] }>): void {
  logger.info("system", "📝 Agent conversation history lengths:");
  for (const agent of agents) {
    console.log(`      ${agent.name.padEnd(30)} ${agent.getHistory().length} turns`);
  }
  logger.divider();
}

// ─── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  logger.error("system", `Fatal error: ${String(err)}`);
  process.exit(1);
});
