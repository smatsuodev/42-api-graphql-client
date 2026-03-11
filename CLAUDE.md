# 42 Learning Navigator — CLAUDE.md

@README.md
@package.json

## Project Goal

This repository is a **learning navigator for 42 students**.

Users enter what they want to learn in natural language, and the system recommends matching 42 projects.

The project has two layers:
- **Gateway layer** (existing, stable): wraps the 42 REST API as a GraphQL API
- **Navigator layer** (in development): domain logic and UI for project recommendation

## Architecture Boundaries

```
Gateway layer (DO NOT BREAK):
  openapi.yml           ← generated OpenAPI schema for 42 API
  mesh.config.ts        ← OpenAPI → GraphQL subgraph
  gateway.config.ts     ← Hive Gateway + OAuth token management
  src/collect/          ← 42 API prober / schema generator

Navigator layer (being added):
  src/navigator/        ← domain logic (recommendation, ranking, etc.)
  apps/web/             ← UI (future)
  packages/domain/      ← shared domain types (future)
  packages/ai/          ← embedding / AI integration (future)
  packages/db/          ← persistence layer (future)
```

**Rule**: Changes to the navigator layer must not break `bun start`, `bun build`, or any existing tests.

**Generated files**: `openapi.yml` is a **generated artifact** produced by `bun collect`. Do not hand-edit it. If the schema needs updating, run the collector. The same applies to `supergraph.graphql` produced by `bun build`.

## Build / Test / Lint Commands

```bash
bun start          # build supergraph and start gateway
bun dev            # watch mode
bun collect        # run OpenAPI schema collector
bun typecheck      # TypeScript type check (must pass before commit)
bun lint:fix       # lint with auto-fix
bun fmt            # format
bun test           # run all tests
```

After any series of changes, always run:
```bash
bun typecheck && bun lint:fix && bun test
```

## Coding Rules

- **No TypeScript errors** — `bun typecheck` must pass clean
- **No guessing schema fields** — always read actual schema / existing code before writing field names
- **Verify library APIs** — knowledge cutoff may be stale; always check the actual official docs or existing code in the repo before using a library API
- **TDD** — follow t-wada's recommended TDD approach: write tests first to clarify specs
- **No over-engineering** — only implement what is needed for the current task
- **No large rewrites** — make small, incremental changes; do not refactor surrounding code

## Change Rules

- **Do not touch the gateway layer** unless the task explicitly requires it
- **Do not implement** DB, UI, embedding, or AI integration until explicitly planned
- **Do not do monorepo restructuring** without explicit agreement
- **Handle real failures minimally** — external API calls, OAuth, env vars, and file I/O can and do fail; handle them. Do not add error handling for purely imaginary scenarios or internal invariants that the framework already guarantees.
- **Do not create helpers or abstractions** for one-time operations
- When in doubt about scope, do less and ask

## Development Workflow

1. Read the relevant files before proposing changes
2. Write tests first (TDD) when adding new logic
3. Make the smallest change that satisfies the requirement
4. Run `bun typecheck && bun lint:fix && bun test` before finishing

## Environment Variables

```
FT_API_CLIENT_ID      # 42 API OAuth client ID
FT_API_CLIENT_SECRET  # 42 API OAuth client secret
```
