# Multi-Agent System

A production-grade TypeScript implementation of a multi-agent orchestration system where specialised AI agents collaborate to design, build, and test a SaaS platform.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     MessageBus                          │
│  (single communication backbone — no direct coupling)   │
└──────────┬────────────────┬────────────────┬────────────┘
           │                │                │
    ┌──────▼──────┐ ┌───────▼───────┐ ┌──────▼───────┐
    │Orchestrator │ │   Architect   │ │  Developer   │
    │  (Charles)  │ │   (Vassyly)   │ │  (Olivier)   │
    │ - decompose │ │ - architecture│ │ - backend    │
    │ - dispatch  │ │ - ADRs        │ │ - frontend   │
    │ - aggregate │ │ - docs        │ │ - APIs       │
    └─────────────┘ └───────────────┘ └──────────────┘
                                       ┌──────────────┐
                                       │  QA Tester   │
                                       │   (Fred)     │
                                       │ - unit tests │
                                       │ - e2e tests  │
                                       │ - bug reports│
                                       └──────────────┘
```

## Folder Structure

```
multi-agent-system/
├── src/
│   ├── index.ts                    ← Entry point / demo runner
│   ├── types/
│   │   └── index.ts                ← All shared type definitions
│   ├── utils/
│   │   ├── logger.ts               ← Colour-coded terminal logger
│   │   └── ids.ts                  ← ID generators
│   ├── bus/
│   │   └── MessageBus.ts           ← Central pub/sub communication hub
│   ├── tasks/
│   │   └── TaskPlanner.ts          ← Task factory, lifecycle, dependency graph
│   └── agents/
│       ├── index.ts                ← Barrel exports
│       ├── AgentBase.ts            ← Abstract base class for all agents
│       ├── OrchestratorAgent.ts    ← Manager / coordinator
│       ├── ArchitectAgent.ts       ← Architecture & documentation specialist
│       ├── DeveloperAgent.ts       ← Backend & frontend development specialist
│       └── QATesterAgent.ts        ← QA testing & bug reporting specialist
├── package.json
├── tsconfig.json
└── README.md
```

## Message Types

| Type                     | Direction                  | Purpose                                     |
|--------------------------|----------------------------|---------------------------------------------|
| `task-assignment`        | Orchestrator → Agent       | Dispatch a task with full context           |
| `task-result`            | Agent → Orchestrator       | Return completed task output                |
| `inter-agent`            | Agent ↔ Agent              | Peer collaboration / consultation           |
| `broadcast`              | Any → All                  | System-wide announcements                   |
| `status-update`          | Agent → Orchestrator       | Progress pings                              |
| `clarification-request`  | Agent → Orchestrator       | Request more information                    |
| `clarification-response` | Orchestrator → Agent       | Answer a clarification request              |

## Task Dependency Graph

```
[t1: Architecture]
     │
     ├──► [t2: Backend Dev]
     │         │
     └──► [t3: Frontend Dev]
               │
          (both complete)
               │
               ▼
          [t4: QA Testing]
               │
               ▼
          [t5: Documentation]
```

## Getting Started

```bash
# Install dependencies
npm install

# Run in development mode (ts-node)
npm run dev

# Build to JavaScript
npm run build

# Run compiled output
npm start
```

## Extending the System

### Add a new specialist agent

1. Create `src/agents/MySpecialistAgent.ts` extending `AgentBase`.
2. Implement `handleMessage()` and `executeTask()`.
3. Export it from `src/agents/index.ts`.
4. Register it with the orchestrator in `src/index.ts`.
5. Add relevant tasks in `OrchestratorAgent.decompose()`.

### Plug in a real LLM

Replace the mock string returns inside `executeTask()` with calls to the
Anthropic (or OpenAI) API. The `ConversationTurn[]` history is already
maintained per-agent and can be serialised directly into the messages array
expected by the Chat Completions API.

```typescript
// Example — replace mock return with real LLM call:
const response = await anthropic.messages.create({
  model: "claude-opus-4-6",
  system: this.profile.systemPrompt,
  messages: this.history
    .filter(t => t.role !== "system")
    .map(t => ({ role: t.role, content: t.content })),
  max_tokens: 4096,
});
return response.content[0].text;
```
