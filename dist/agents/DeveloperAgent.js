"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeveloperAgent = void 0;
const AgentBase_1 = require("./AgentBase");
const ids_1 = require("../utils/ids");
const logger_1 = require("../utils/logger");
class DeveloperAgent extends AgentBase_1.AgentBase {
    constructor(bus, idOverride) {
        const profile = {
            id: idOverride ?? (0, ids_1.generateAgentId)("developer"),
            name: "Olivier (Developer)",
            role: "developer",
            capabilities: [
                "backend-development",
                "frontend-development",
                "code-review",
                "api-integration",
                "database-schema-design",
            ],
            systemPrompt: `You are Jordan, a full-stack developer with deep expertise in:
  - TypeScript / Node.js (Express, Fastify, NestJS)
  - React 18 + TailwindCSS + Zustand / React Query
  - PostgreSQL, Prisma ORM
  - REST and GraphQL API implementation
  - Docker, GitHub Actions CI/CD
You write clean, tested, production-ready code and always consider edge cases,
error handling, and performance.`,
        };
        super(profile, bus);
        this.interAgentResponses = new Map();
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
            case "inter-agent": {
                if (message.correlationId) {
                    this.interAgentResponses.set(message.correlationId, message.content);
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
        await this.send("orchestrator", "status-update", `Starting development: ${task.title}`, { taskId: task.id });
        await sleep(250);
        const result = task.title.includes("Backend")
            ? this.buildBackend(task)
            : this.buildFrontend(task);
        logger_1.logger.success(this.role, `Task "${task.title}" complete.`);
        return result;
    }
    buildBackend(_task) {
        return `
## Backend API Development

### Project Structure
\`\`\`
src/
  app.ts               — Fastify app factory
  plugins/             — auth, cors, swagger, prisma
  modules/
    user/              — controller, service, repository, schema
    core/              — controller, service, repository, schema
  shared/
    errors/            — AppError, HttpError classes
    middleware/        — auth guard, rate-limiter
    utils/             — pagination, hashing, tokens
  prisma/
    schema.prisma      — User, Tenant, CoreEntity models
    migrations/        — timestamped SQL migrations
\`\`\`

### Key Implementation Details

#### User Model (Prisma)
\`\`\`prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  tenantId  String
  role      Role     @default(MEMBER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
}

enum Role { OWNER ADMIN MEMBER }
\`\`\`

#### Auth Service (JWT + Refresh Tokens)
\`\`\`typescript
// src/modules/auth/auth.service.ts
export class AuthService {
  async login(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !await bcrypt.compare(password, user.password)) {
      throw new AppError("INVALID_CREDENTIALS", 401);
    }
    return this.issueTokenPair(user);
  }

  private issueTokenPair(user: User) {
    const accessToken  = jwt.sign({ sub: user.id, role: user.role }, ACCESS_SECRET,  { expiresIn: "15m" });
    const refreshToken = jwt.sign({ sub: user.id },                 REFRESH_SECRET, { expiresIn: "7d"  });
    return { accessToken, refreshToken };
  }
}
\`\`\`

#### REST Endpoints Implemented
- POST   /api/v1/auth/login
- POST   /api/v1/auth/refresh
- POST   /api/v1/auth/logout
- GET    /api/v1/users/me
- PATCH  /api/v1/users/me
- GET    /api/v1/core/items        (paginated)
- POST   /api/v1/core/items
- GET    /api/v1/core/items/:id
- PATCH  /api/v1/core/items/:id
- DELETE /api/v1/core/items/:id

All endpoints validated with Zod schemas; errors serialised to RFC-7807 Problem JSON.
Swagger UI available at /docs.
    `.trim();
    }
    buildFrontend(_task) {
        return `
## Frontend UI Development

### Project Structure
\`\`\`
src/
  main.tsx             — React root, QueryClient, Router
  pages/
    LoginPage.tsx
    DashboardPage.tsx
    ItemsPage.tsx
    ProfilePage.tsx
  components/
    layout/            — AppShell, Sidebar, TopBar
    ui/                — Button, Input, Modal, Toast (shadcn/ui)
    items/             — ItemCard, ItemForm, ItemList
  hooks/
    useAuth.ts         — Zustand auth slice + mutations
    useItems.ts        — React Query CRUD hooks
  api/
    client.ts          — Axios instance with interceptors
    auth.ts
    items.ts
  store/
    auth.store.ts      — Zustand: user, tokens, hydrate
  router/
    index.tsx          — TanStack Router, protected routes
\`\`\`

### Key Implementation Details

#### API Client (Axios + auto-refresh)
\`\`\`typescript
// src/api/client.ts
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const { accessToken } = await refreshTokens();
      setAccessToken(accessToken);
      error.config.headers.Authorization = \`Bearer \${accessToken}\`;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);
\`\`\`

#### Dashboard Page (React Query)
\`\`\`tsx
export function DashboardPage() {
  const { data: items, isLoading } = useItems();
  if (isLoading) return <LoadingSpinner />;
  return (
    <AppShell>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <ItemList items={items ?? []} />
    </AppShell>
  );
}
\`\`\`

### Features Delivered
- Responsive layout (mobile-first, TailwindCSS)
- Dark / light theme toggle (CSS variables)
- Protected routes with role-based access
- Optimistic UI updates for mutations
- Toast notifications for async actions
- Form validation with React Hook Form + Zod
    `.trim();
    }
}
exports.DeveloperAgent = DeveloperAgent;
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
