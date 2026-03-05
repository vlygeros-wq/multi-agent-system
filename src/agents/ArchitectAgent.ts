/**
 * ArchitectAgent
 * ------------------
 * Specialist responsible for high-level system design and documentation.
 *
 * Capabilities:
 *  - Produce multi-tier SaaS architectures (services, APIs, databases, CDN, etc.)
 *  - Define data models and integration contracts
 *  - Write technical documentation and architecture Decision Records (ADRs)
 */

import { AgentBase } from "./AgentBase";
import { MessageBus } from "../flow/MessageBus";
import {
  AgentProfile,
  AgentId,
  Message,
  Task,
} from "../types";
import { generateAgentId } from "../utils/ids";
import { logger } from "../utils/logger";

export class ArchitectAgent extends AgentBase {
  constructor(bus: MessageBus, idOverride?: AgentId) {
    const profile: AgentProfile = {
      id          : idOverride ?? generateAgentId("architect"),
      name        : "Vassyly (Architect)",
      role        : "architect",
      capabilities: [
        "system-architecture",
        "cloud-design",
        "api-contract-design",
        "data-modeling",
        "technical-documentation",
        "adr-writing",
      ],
      systemPrompt: `You are Alex, a senior architect with 15 years of experience.
You design scalable, cloud-native architectures using modern best practices:
  - Microservices / modular monolith patterns
  - RESTful and GraphQL API design
  - Event-driven architectures (Kafka, SQS)
  - Cloud deployment on AWS / GCP / Azure
  - Security-first design (OAuth2, RBAC, mTLS)
  - Observability: logging, metrics, tracing
Your outputs are always structured, detailed, and include concrete tech-stack recommendations.`,
    };
    super(profile, bus);
  }

  // ─── Inbound message routing ───────────────────────────────────────────────

  protected async handleMessage(message: Message): Promise<void> {
    switch (message.type) {
      case "task-assignment": {
        const task = message.payload?.task as Task | undefined;
        if (!task) {
          logger.warn(this.role, "Received task-assignment without task payload.");
          return;
        }
        const result = await this.executeTask(task);
        // Report result back to the orchestrator
        await this.send("orchestrator", "task-result", result, { taskId: task.id });
        break;
      }

      case "inter-agent": {
        // Another agent is asking for architectural guidance
        logger.info(this.role, `Inter-agent query from ${message.sender}: "${message.content}"`);
        const response = this.answerArchitecturalQuery(message.content);
        await this.send(message.sender, "inter-agent", response, undefined, message.id);
        break;
      }

      case "broadcast":
        // Situational awareness — no action needed
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
      `Starting task: ${task.title}`,
      { taskId: task.id }
    );

    // Simulate deliberate processing time
    await sleep(300);

    // Route to the correct specialist method
    const result = task.title.includes("Architecture")
      ? this.produceArchitecture(task)
      : this.produceDocumentation(task);

    logger.success(this.role, `Task "${task.title}" complete.`);
    return result;
  }

  // ─── Work implementations ─────────────────────────────────────────────────

  private produceArchitecture(_task: Task): string {
    return `
## System Architecture Design

### Overview
A multi-tenant SaaS platform built on a modular microservices architecture
deployed on AWS using containerised workloads (ECS Fargate / EKS).

### Services
| Service          | Responsibility                        | Tech Stack              |
|------------------|---------------------------------------|-------------------------|
| api-gateway      | Auth, rate-limiting, routing          | Kong / AWS API Gateway  |
| user-service     | Registration, profiles, RBAC          | Node.js, PostgreSQL     |
| core-service     | Primary business domain logic         | Node.js, PostgreSQL     |
| notification-svc | Email / push / SMS delivery           | Node.js, SQS, SendGrid  |
| analytics-svc    | Event ingestion & reporting           | Python, Redshift        |
| cdn / static     | Frontend assets                       | CloudFront, S3          |

### Data Layer
- **Primary DB**: PostgreSQL 16 (RDS Multi-AZ) per service (schema-per-tenant)
- **Cache**: Redis 7 (ElastiCache) for sessions & hot data
- **Search**: OpenSearch for full-text queries
- **Object storage**: S3 for media/files

### API Design
- RESTful API (v1) + WebSocket for real-time features
- OpenAPI 3.1 spec as source of truth
- Auth: OAuth 2.0 / JWT, refresh-token rotation, MFA

### Infrastructure & DevOps
- IaC: Terraform modules (VPC, RDS, ECS, IAM)
- CI/CD: GitHub Actions → ECR → ECS rolling deployments
- Observability: CloudWatch + Datadog (APM, logs, traces)
- Secrets: AWS Secrets Manager

### Security
- Network: Private subnets, security groups, NACLs
- Application: Helmet, CSRF, input validation (Zod), CSP headers
- Compliance: SOC-2 Type II roadmap, GDPR data residency

### Scalability Targets
- 10,000 concurrent users at launch
- Horizontal pod autoscaling (HPA) on CPU/request-count metrics
- Database read replicas for analytics queries
    `.trim();
  }

  private produceDocumentation(_task: Task): string {
    return `
## Technical Documentation

### README
\`\`\`markdown
# SaaS Platform

## Quick Start
\`\`\`bash
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run dev
\`\`\`

## API Reference
Base URL: https://api.example.com/v1

### Authentication
POST /auth/login         — obtain access + refresh tokens
POST /auth/refresh       — rotate tokens
POST /auth/logout        — revoke session

### Users
GET    /users/me         — current user profile
PATCH  /users/me         — update profile
DELETE /users/me         — account deletion

Full OpenAPI spec: https://api.example.com/v1/docs
\`\`\`

### Architecture Decision Records (ADRs)
ADR-001: Use PostgreSQL over MongoDB — chosen for ACID compliance and complex relational queries.
ADR-002: Microservices over monolith — enables independent deployments and team autonomy.
ADR-003: JWT with short expiry (15 min) + refresh tokens — balances security and UX.
ADR-004: Terraform for IaC — reproducible, version-controlled infrastructure.
    `.trim();
  }

  private answerArchitecturalQuery(question: string): string {
    return `Architectural guidance re: "${question}": 
Follow the existing service-boundary contract. 
Prefer async messaging (SQS) for cross-service side-effects. 
Ensure all new endpoints are documented in the OpenAPI spec before merging.`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
