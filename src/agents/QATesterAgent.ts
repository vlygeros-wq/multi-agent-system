/**
 * QATesterAgent
 * -------------
 * Specialist responsible for quality assurance, testing strategy,
 * and bug reporting.
 *
 * Capabilities:
 *  - Unit test authoring (Vitest / Jest)
 *  - Integration test authoring (Supertest)
 *  - E2E test authoring (Playwright)
 *  - Performance / load testing plan (k6)
 *  - Bug triage and regression reports
 *
 * The QA agent can request clarification from the orchestrator if
 * acceptance criteria are ambiguous, demonstrating the
 * `clarification-request` / `clarification-response` message flow.
 */

import { AgentBase } from "./AgentBase";
import { MessageBus } from "../flow/MessageBus";
import {
  AgentProfile,
  AgentId,
  Message,
  Task,
  MessageId,
} from "../types";
import { generateAgentId, generateMessageId } from "../utils/ids";
import { logger } from "../utils/logger";

export class QATesterAgent extends AgentBase {
  /** Stores pending clarification resolvers keyed by correlationId */
  private readonly clarifications = new Map<MessageId, (answer: string) => void>();

  constructor(bus: MessageBus, idOverride?: AgentId) {
    const profile: AgentProfile = {
      id          : idOverride ?? generateAgentId("qa-tester"),
      name        : "Fred (QA Engineer)",
      role        : "qa-tester",
      capabilities: [
        "unit-testing",
        "integration-testing",
        "e2e-testing",
        "performance-testing",
        "bug-reporting",
        "acceptance-criteria-validation",
      ],
      systemPrompt: `You are Sam, a principal QA engineer who ensures nothing ships unless it is solid.
You specialise in:
  - Test pyramid design (unit → integration → E2E)
  - Playwright for browser automation
  - Vitest / Jest for unit & integration tests
  - k6 for load and performance testing
  - Shift-left testing practices
  - Risk-based test prioritisation
You write thorough, well-structured test suites and produce clear bug reports.`,
    };
    super(profile, bus);
  }

  // ─── Inbound message routing ───────────────────────────────────────────────

  protected async handleMessage(message: Message): Promise<void> {
    switch (message.type) {
      case "task-assignment": {
        const task = message.payload?.task as Task | undefined;
        if (!task) return;
        const result = await this.executeTask(task);
        await this.send("orchestrator", "task-result", result, { taskId: task.id });
        break;
      }

      case "clarification-response": {
        // Orchestrator answered our clarification request
        if (message.correlationId) {
          const resolver = this.clarifications.get(message.correlationId);
          if (resolver) {
            this.clarifications.delete(message.correlationId);
            resolver(message.content);
          }
        }
        break;
      }

      case "broadcast":
        break;

      default:
        break;
    }
  }

  // ─── Task execution ────────────────────────────────────────────────────────

  async executeTask(task: Task): Promise<string> {
    logger.info(this.role, `Executing task: "${task.title}"`);

    await this.send(
      "orchestrator",
      "status-update",
      `QA starting: ${task.title}`,
      { taskId: task.id }
    );

    // Demonstrate clarification flow: ask orchestrator for clarification
    const clarification = await this.requestClarification(
      "What are the minimum acceptable code-coverage thresholds for this project?"
    );
    logger.info(this.role, `Clarification received: "${clarification}"`);

    await sleep(300);

    const result = this.produceTestSuite(task);
    logger.success(this.role, `Task "${task.title}" complete.`);
    return result;
  }

  // ─── Clarification helper ─────────────────────────────────────────────────

  /**
   * Send a clarification request to the orchestrator and await its response.
   * Pre-generates the message id so we can register the resolver BEFORE the
   * message is delivered (prevents the response arriving before we listen).
   * Falls back after 2 s if the orchestrator does not reply.
   */
  private async requestClarification(question: string): Promise<string> {
    const msgId = generateMessageId();

    // Register the resolver BEFORE publishing so we never miss the reply.
    const answer = new Promise<string>((resolve) => {
      this.clarifications.set(msgId, resolve);
      setTimeout(() => {
        if (this.clarifications.has(msgId)) {
          this.clarifications.delete(msgId);
          resolve("Use industry-standard defaults: 80% line coverage.");
        }
      }, 2_000);
    });

    // Publish with the pre-generated id; bus will deliver reply with correlationId = msgId
    await this.bus.publish({
      id        : msgId,
      type      : "clarification-request",
      sender    : this.id,
      recipient : "orchestrator",
      content   : question,
    });
    this.recordTurn("assistant", `→ [orchestrator] ${question}`);

    return answer;
  }

  // ─── Work implementations ──────────────────────────────────────────────────

  private produceTestSuite(_task: Task): string {
    return `
## QA Test Suite

### Coverage Summary
| Layer       | Tool        | Target  | Current |
|-------------|-------------|---------|---------|
| Unit        | Vitest      | 85%     | 87%     |
| Integration | Supertest   | 75%     | 78%     |
| E2E         | Playwright  | Key flows| 100%  |
| Performance | k6          | <200ms p95 | ✔   |

---

### Unit Tests (Backend — AuthService)
\`\`\`typescript
// src/modules/auth/auth.service.test.ts
describe("AuthService", () => {
  it("returns token pair on valid credentials", async () => {
    const svc = buildAuthService({ userExists: true, passwordMatch: true });
    const result = await svc.login("user@test.com", "password123");
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it("throws INVALID_CREDENTIALS on wrong password", async () => {
    const svc = buildAuthService({ userExists: true, passwordMatch: false });
    await expect(svc.login("user@test.com", "wrong")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      statusCode: 401,
    });
  });

  it("throws INVALID_CREDENTIALS when user not found", async () => {
    const svc = buildAuthService({ userExists: false });
    await expect(svc.login("ghost@test.com", "any")).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });
});
\`\`\`

### Integration Tests (API — Items endpoints)
\`\`\`typescript
// tests/integration/items.test.ts
describe("GET /api/v1/core/items", () => {
  it("returns paginated items for authenticated user", async () => {
    const token = await loginAsFixtureUser();
    const res = await request(app)
      .get("/api/v1/core/items?page=1&limit=10")
      .set("Authorization", \`Bearer \${token}\`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeArray();
    expect(res.body.meta.total).toBeGreaterThanOrEqual(0);
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/v1/core/items");
    expect(res.status).toBe(401);
  });
});
\`\`\`

### E2E Tests (Playwright — Login flow)
\`\`\`typescript
// tests/e2e/login.spec.ts
test("user can log in and see dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.fill('[data-testid="email"]',    "user@test.com");
  await page.fill('[data-testid="password"]', "Password1!");
  await page.click('[data-testid="submit"]');
  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator("h1")).toContainText("Dashboard");
});

test("shows error on invalid credentials", async ({ page }) => {
  await page.goto("/login");
  await page.fill('[data-testid="email"]',    "user@test.com");
  await page.fill('[data-testid="password"]', "wrong");
  await page.click('[data-testid="submit"]');
  await expect(page.locator('[role="alert"]')).toBeVisible();
});
\`\`\`

### Performance Test (k6)
\`\`\`javascript
// tests/perf/load.k6.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m",  target: 100  },
    { duration: "3m",  target: 1000 },
    { duration: "1m",  target: 0    },
  ],
  thresholds: {
    http_req_duration: ["p(95)<200"],
    http_req_failed:   ["rate<0.01"],
  },
};

export default function () {
  const res = http.get("https://api.example.com/api/v1/core/items", {
    headers: { Authorization: \`Bearer \${__ENV.TEST_TOKEN}\` },
  });
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(1);
}
\`\`\`

### Bugs Found
| ID     | Severity | Title                                   | Status |
|--------|----------|-----------------------------------------|--------|
| BUG-01 | Medium   | Refresh token not invalidated on logout | Open   |
| BUG-02 | Low      | Dashboard flickers on first mount       | Open   |
| BUG-03 | High     | Missing rate-limit on /auth/login       | Open   |

### Recommendations
1. Add rate-limiting middleware to auth endpoints immediately (BUG-03 is security-critical).
2. Implement token blocklist (Redis SET) on logout to fix BUG-01.
3. Wrap Dashboard initialisation in a Suspense boundary to fix BUG-02.
    `.trim();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
