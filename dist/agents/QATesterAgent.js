"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QATesterAgent = void 0;
const AgentBase_1 = require("./AgentBase");
const ids_1 = require("../utils/ids");
const logger_1 = require("../utils/logger");
class QATesterAgent extends AgentBase_1.AgentBase {
    constructor(bus, idOverride) {
        const profile = {
            id: idOverride ?? (0, ids_1.generateAgentId)("qa-tester"),
            name: "Fred (QA Engineer)",
            role: "qa-tester",
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
        this.clarifications = new Map();
    }
    async handleMessage(message) {
        switch (message.type) {
            case "task-assignment": {
                const task = message.payload?.task;
                if (!task)
                    return;
                const result = await this.executeTask(task);
                await this.send("orchestrator", "task-result", result, { taskId: task.id });
                break;
            }
            case "clarification-response": {
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
    async executeTask(task) {
        logger_1.logger.info(this.role, `Executing task: "${task.title}"`);
        await this.send("orchestrator", "status-update", `QA starting: ${task.title}`, { taskId: task.id });
        const clarification = await this.requestClarification("What are the minimum acceptable code-coverage thresholds for this project?");
        logger_1.logger.info(this.role, `Clarification received: "${clarification}"`);
        await sleep(300);
        const result = this.produceTestSuite(task);
        logger_1.logger.success(this.role, `Task "${task.title}" complete.`);
        return result;
    }
    async requestClarification(question) {
        const msgId = (0, ids_1.generateMessageId)();
        const answer = new Promise((resolve) => {
            this.clarifications.set(msgId, resolve);
            setTimeout(() => {
                if (this.clarifications.has(msgId)) {
                    this.clarifications.delete(msgId);
                    resolve("Use industry-standard defaults: 80% line coverage.");
                }
            }, 2000);
        });
        await this.bus.publish({
            id: msgId,
            type: "clarification-request",
            sender: this.id,
            recipient: "orchestrator",
            content: question,
        });
        this.recordTurn("assistant", `→ [orchestrator] ${question}`);
        return answer;
    }
    produceTestSuite(_task) {
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
exports.QATesterAgent = QATesterAgent;
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
