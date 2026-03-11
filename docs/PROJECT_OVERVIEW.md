# Project Overview: 42 Learning Navigator

## Background

42 students often struggle to find the right next project. The 42 API exists but:
- It is a REST API that is verbose to query
- The official documentation is incomplete
- There is no way to search projects by learning goal

This project addresses all three problems in a layered way.

## Goals

### 1. Document the 42 API (existing)
Auto-generate an accurate OpenAPI schema by probing the live 42 API.
- Implemented in `src/collect/`
- Outputs `openapi.yml`

### 2. GraphQL Gateway (existing)
Expose the 42 API as a usable GraphQL API.
- `mesh.config.ts` converts OpenAPI → GraphQL subgraph
- `gateway.config.ts` runs Hive Gateway with OAuth token injection
- Accessible at `https://localhost:4000/graphql`

### 3. Learning Navigator (MVP in progress)
Users enter a natural language goal (e.g. "I want to learn C memory management") and receive a ranked list of relevant 42 projects.

MVP scope:
- Metadata-based search (project names, slugs, descriptions from 42 API)
- No PDF parsing, no embedding in the first iteration
- Config-driven ranking weights (skills, difficulty, etc.)

## Out of Scope (initial)

- Image / PDF collection
- Vector embedding / semantic search (planned for later)
- Full monorepo restructuring
- User authentication beyond 42 OAuth
- Real-time / streaming recommendations

## Proposed Future Structure

```
42-learning-navigator/
├── openapi.yml              # 42 API OpenAPI schema (generated)
├── mesh.config.ts           # GraphQL Mesh config
├── gateway.config.ts        # Hive Gateway config
├── src/
│   ├── collect/             # OpenAPI schema generator (existing)
│   └── navigator/           # Navigator domain logic (to be added)
│       ├── search.ts        # Project search / ranking
│       ├── recommend.ts     # Recommendation engine
│       └── ...
├── apps/
│   └── web/                 # UI (future)
├── packages/
│   ├── domain/              # Shared domain types (future)
│   ├── ai/                  # Embedding / LLM integration (future)
│   └── db/                  # Persistence (future)
└── docs/
    ├── PROJECT_OVERVIEW.md
    └── IMPLEMENTATION_PLAN.md
```

**Important**: No large directory moves in the initial phase. `src/collect/` and gateway files stay where they are.

## Design Principles

- **Staged pipeline** — collect → normalize → rank → serve, each stage independently testable
- **Config-driven** — weights, filters, and categories defined in config files, not hardcoded
- **Resumable jobs** — long-running collection jobs (e.g. schema probing) must be resumable and logged
- **Gateway stability** — the GraphQL gateway is a stable contract; navigator changes must not break it
