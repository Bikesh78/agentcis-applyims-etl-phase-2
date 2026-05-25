# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Commands

```bash
# Development
npm run dev               # Run with tsx watch (hot reload)
npm run build             # Compile TypeScript to dist/
npm run start             # Run compiled output

# Linting & formatting
npm run lint              # ESLint
npm run lint:fix          # ESLint with auto-fix
npm run format            # Prettier

# ETL DB migrations (targets the PostgreSQL ETL tracking DB only)
npm run migration:run     # Apply pending migrations
npm run migration:revert  # Revert last migration
npm run migration:show    # List applied/pending migrations
npm run migration:generate -- src/migrations/etlDb/<MigrationName>  # Generate from entity diff
```

No test suite exists in this project.

## Architecture Overview

This is an **ETL pipeline** that migrates data from an AgentCIS MySQL database to an ApplyIMS system via a REST API, with a PostgreSQL database used solely for tracking migration state.

### Three databases

| DB | Type | Purpose |
|---|---|---|
| `agentcisDb` | MySQL (`agentcis_v2`) | Source — read-only extraction |
| `etlDb` | PostgreSQL (`etl_tracking`) | ETL tracking: jobs, checkpoints, errors, temp ID mappings |
| ApplyIMS API | REST | Destination — write-only via bulk endpoints |

### Data flow per entity

```
AgentCIS MySQL → Extractor → Transformer → BatchProcessor → ApplyIMS API
                                  ↑                ↓
                             IdResolver      MappingRepository
                          (JSON + ETL DB)      (ETL DB upsert)
```

### Layers

- **`src/extractors/`** — Pull batches from AgentCIS MySQL. All extend `BaseExtractor<T>` which drives the `extractAll()` async generator loop with cursor-based pagination on `id`. Notes use raw SQL (polymorphic join); others use TypeORM query builder.
- **`src/transformers/`** — Map source → target types. All extend `BaseTransformer<S,T>` which generates a UUID and calls `transformImpl()` + `validate()`. Return `null` to skip a record.
- **`src/loaders/api-client.ts`** — Axios client with rate limiting, exponential retry, and automatic re-auth on 401. One `bulkCreate*()` method per entity type.
- **`src/loaders/batch-processor.ts`** — Calls the API, stores successful ID mappings via `MappingRepository`, logs failures to `migration_errors`.
- **`src/orchestrators/migration.orchestrator.ts`** — Drives the full migration: orders entities by dependency, creates checkpoints, loops batches, handles post-entity hooks (deal staging after contacts, S3 copy after attachments). Entry point is `runMigration(MigrationConfig)`.

### ID resolution strategy (`src/transformers/utils/id-resolver.ts`)

AgentCIS integer IDs are resolved to ApplyIMS UUIDs using a two-tier fallback:
1. **JSON mapper files** in `src/mapper/` — pre-computed mappings loaded lazily into memory (e.g. `users.json`, `contacts.json`, `applications.json`)
2. **ETL DB `temp_mapped_*` tables** — populated during the current migration run for IDs not in the JSON files

`IdResolver.createPhaseResolver(etlDataSource, logger)` wires up the correct fallback chain per entity type.

### Entity dependency order

```
USERS → AGENTS → CONTACTS → DEALS → APPLICATIONS → NOTES → CONTACT_ACTIVITIES → OFFICE_VISITS → ATTACHMENTS
```

Each entity must be migrated before the entities that depend on it (e.g. applications need contacts).

### ETL tracking tables (PostgreSQL)

- `migration_jobs` — one row per migration run
- `migration_checkpoints` — one row per (migration, entity), stores `lastProcessedId` for resumability
- `migration_errors` — all transformation and API failures with full context JSON
- `temp_mapped_*` — transient ID maps: `agentcis_*_id (int) → applyims_*_id (uuid)`

### Configuration

Uses the `config` npm package. Values come from `config/<NODE_ENV>.json` with overrides from env vars defined in `config/custom-environment-variables.json`. The `.env` file provides the env vars. Key env vars: `AGENTCIS_DB_*`, `ETL_DB_*`, `APPLYIMS_API_URL`, `APPLYIMS_EMAIL`, `APPLYIMS_PASSWORD`, `TENANT_COMPANY_ID`, `TENANT_DOMAIN`.

### Adding a new entity

1. `src/entities/agentcis/<entity>.entity.ts` — TypeORM source entity
2. `src/entities/applyims/<entity>.entity.ts` — Target interface
3. `src/entities/etlDb/temp-mapped-<entity>.entity.ts` — ETL tracking entity
4. `src/migrations/etlDb/<timestamp>-Create<Entity>.ts` — Migration for tracking table
5. `src/extractors/<entity>.extractor.ts` — Extend `BaseExtractor`
6. `src/transformers/<entity>.transformer.ts` — Extend `BaseTransformer`
7. `src/loaders/api-client.ts` — Add `bulkCreate<Entity>()` method
8. `src/constants/entity-types.ts` — Add to `EntityType` enum, `ENTITY_API_METHOD_MAP`, and `ENTITY_DEPENDENCY_ORDER`
9. `src/repositories/mapping.repository.ts` — Add mapping data type, `store<Entity>Mapping()`, and switch case
10. `src/configs/database.config.ts` — Register both new entities in their respective connection options
11. `src/orchestrators/migration.orchestrator.ts` — Add `case EntityType.<ENTITY>` in `getEntityHandlers()` and add to `TargetEntity` union type

### Test routes

`GET /api/test/note-transform`, `/api/test/contact-transform`, `/api/test/contact-activities-transform` — extract and transform a small batch without writing to the API, useful for verifying a new transformer works end-to-end.
