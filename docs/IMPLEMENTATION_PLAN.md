# Implementation Plan: 42 Learning Navigator

## Phase 0 — Initial Setup (current)

Goal: Establish project structure, documentation, and conventions without touching the gateway layer.

- [x] Update README.md and README.ja.md
- [x] Update CLAUDE.md with project goal, architecture boundary, and coding rules
- [x] Create docs/PROJECT_OVERVIEW.md
- [x] Create docs/IMPLEMENTATION_PLAN.md

## Phase 1 — MVP: Metadata-based Search

Goal: Given a natural language query, return a ranked list of 42 projects using only API metadata.

### 1-1. Data Collection
- Fetch project list from 42 API via the GraphQL gateway
  - Fields: `id`, `name`, `slug`, `description`, `difficulty`, `skills`, `cursus`
- Cache responses locally (JSON) to avoid repeated API calls during development
- No PDF parsing in this phase

### 1-2. Navigator Domain (`src/navigator/`)
- `search.ts` — keyword-based project search over cached metadata
- `rank.ts` — score projects by relevance to the query
  - Config-driven weights (e.g. name match: 3.0, description match: 1.0, skill match: 2.0)
- `recommend.ts` — top-N recommendation from ranked results
- Tests for each module (TDD)

### 1-3. CLI / API Entry Point
- Simple CLI: `bun src/navigator/index.ts "I want to learn memory management"`
- Optional: expose as a GraphQL query via the existing gateway (future)

## Phase 2 — Semantic Search (planned)

Goal: Improve recommendation quality with vector embeddings.

- Generate embeddings for project descriptions using a chosen embedding model
- Store embeddings in a vector DB (e.g. pgvector, sqlite-vec)
- Replace/augment keyword search with cosine similarity search
- Introduce `packages/ai/` for embedding logic

## Phase 3 — UI (planned)

Goal: Web interface for the navigator.

- `apps/web/` — Next.js or SvelteKit frontend
- Input: natural language goal
- Output: ranked project cards with descriptions and links
- Connects to the navigator API (Phase 1/2)

## Phase 4 — Monorepo (if needed)

Goal: Clean up into a proper monorepo if the codebase grows.

- Workspace setup (Bun workspaces)
- `packages/domain/` — shared types across navigator and web
- `packages/db/` — persistence layer
- Only do this when there is clear benefit; do not over-engineer

---

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| 2026-03-11 | Start with metadata-based MVP, no embedding | Simpler to validate usefulness first |
| 2026-03-11 | Keep gateway layer unchanged | Avoid breaking existing functionality |
| 2026-03-11 | No monorepo restructuring in Phase 0 | Reduce risk, focus on adding value |
