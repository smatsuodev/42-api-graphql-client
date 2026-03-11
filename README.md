# 42 Learning Navigator

<div align="center"><a href="./README.md">English</a> | <a href="./README.ja.md">日本語</a></div>

A learning navigator for 42 students — enter what you want to learn in natural language, and get recommended 42 projects that match your goal.

Built on top of a GraphQL gateway that wraps the 42 REST API.

> This repository is forked from [smatsuodev/42-api-graphql-client](https://github.com/smatsuodev/42-api-graphql-client). The gateway layer originates from that project.

## Architecture

```
42 REST API
    │
    ▼
src/collect/          # Auto-generates OpenAPI schema by probing the 42 API
    │
    ▼
openapi.yml           # Generated OpenAPI schema
    │
    ▼
mesh.config.ts        # Converts OpenAPI → GraphQL subgraph (GraphQL Mesh)
gateway.config.ts     # Hive Gateway: OAuth token injection, serves /graphql
    │
    ▼
src/navigator/        # (planned) Learning navigator domain logic
apps/web/             # (planned) UI layer
```

The gateway layer (`openapi.yml`, `mesh.config.ts`, `gateway.config.ts`) is a stable base and must not be broken by navigator work.

## Requirements

- Bun v1.3.6+

## Setup

```bash
# 1. Clone this repository
git clone git@github.com:42-hirosuzu/42-learning-navigator.git

# 2. Install dependencies
bun install

# 3. Set up environment variables
cp .env.example .env
# Fill in FT_API_CLIENT_ID and FT_API_CLIENT_SECRET

# 4. Start the GraphQL gateway
bun start
# Access https://localhost:4000/graphql
```

## Development Commands

| Command | Description |
|---|---|
| `bun start` | Build supergraph and start the gateway |
| `bun dev` | Watch mode: rebuild and restart on config changes |
| `bun collect` | Run the OpenAPI schema collector (`src/collect/`) |
| `bun typecheck` | Run TypeScript type checking |
| `bun lint` | Run linter (oxlint) |
| `bun lint:fix` | Run linter with auto-fix |
| `bun fmt` | Format code (oxfmt) |
| `bun fmt:check` | Check formatting |
| `bun test` | Run all tests |

## Project Goals

1. **Document the 42 API** — Auto-generate an accurate OpenAPI schema via API probing (`src/collect/`)
2. **GraphQL gateway** — Expose the 42 API as a GraphQL API (GraphQL Mesh + Hive Gateway)
3. **Learning Navigator** — Recommend 42 projects based on natural language input *(MVP in progress)*

See [docs/PROJECT_OVERVIEW.md](./docs/PROJECT_OVERVIEW.md) for full scope and [docs/IMPLEMENTATION_PLAN.md](./docs/IMPLEMENTATION_PLAN.md) for roadmap.
