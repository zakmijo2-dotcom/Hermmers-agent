# MIJ Agent Harness Build Plan

**Goal:** Build custom agent harness from OpenCode base targeting Hermès-level architecture

**Source Analysis:** OpenCode uses Pi agent core with event-driven async generator loop, cache-epoch context management, declarative tool system. Critical gaps: no persistent learning, no cross-session memory, no lineage tracking, no adaptive routing.

---

## PHASE 2 — PERSISTENT MEMORY SYSTEM

**Scope:** Implement SQLite-backed session storage with cross-run memory persistence

**Affected:**
- `packages/agent/src/memory-store.ts` (new) - SQLite storage layer
- `packages/agent/src/memory-interface.ts` (new) - Memory query API
- `packages/agent/src/runtime.ts` (modify) - Hook memory load/save into agent loop

**Done-Check:** Memory persists across two separate agent runs, queryable via FTS

**Rationale:** Foundational for learning loop, scheduled tasks, lineage tracking

---

## PHASE 3 — LEARNING LOOP FOUNDATION

**Scope:** Pattern detection that creates/refines skill files during execution

**Affected:**
- `packages/agent/src/learning-engine.ts` (new) - Pattern detection, skill generation
- `packages/agent/src/skill-manager.ts` (new) - Skill CRUD operations
- `packages/agent/src/runtime.ts` (modify) - Trigger learning on tool outcomes

**Done-Check:** Agent detects repeated pattern, generates skill file, applies it in subsequent run

**Rationale:** Core Hermès differentiator; requires Phase 2 persistence

---

## PHASE 4 — PROMPT STABILITY SYSTEM

**Scope:** Replace cache-epoch context with stable prompt + incremental updates

**Affected:**
- `packages/agent/src/context-stable.ts` (new) - Stable prompt assembly
- `packages/agent/src/context-ir.ts` (modify) - Remove epoch logic
- `packages/agent/src/compaction.ts` (modify) - Summarization without cache breaks

**Done-Check:** Context updates don't force cache invalidation, measured via cache hit rate

**Rationale:** Addresses OpenCode user pain point (constant re-explanation)

---

## PHASE 5 — LINEAGE TRACKING

**Scope:** Track tool execution provenance and cross-run genealogy

**Affected:**
- `packages/agent/src/lineage.ts` (new) - Lineage data structures
- `packages/agent/src/tool-worker.ts` (modify) - Capture tool provenance
- `packages/agent/src/runtime.ts` (modify) - Session genealogy tracking

**Done-Check:** Tool results include parent context, sessions link to ancestor sessions

**Rationale:** Enables debugging, outcome learning, session continuity

---

## PHASE 6 — ADAPTIVE PROVIDER ROUTING

**Scope:** Dynamic provider selection with fallback chains

**Affected:**
- `packages/agent/src/provider-router.ts` (new) - Routing logic with fallback
- `packages/agent/src/adapters.ts` (modify) - Support runtime provider switching
- `packages/agent/src/execution-kernel.ts` (modify) - Handle provider failures

**Done-Check:** Simulated provider failure triggers fallback, completes task successfully

**Rationale:** Hermès fallback pattern for resilience

---

## PHASE 7 — OBSERVABLE EXECUTION ENHANCEMENT

**Scope:** Callback-driven progress updates for tool execution state

**Affected:**
- `packages/agent/src/callbacks.ts` (new) - Progress callback system
- `packages/agent/src/tool-worker.ts` (modify) - Emit progress events
- `packages/cli/src/index.ts` (modify) - Surface progress in CLI

**Done-Check:** CLI displays real-time tool execution progress with state transitions

**Rationale:** UX improvement over OpenCode's current event stream

---

## PHASE 8 — CORE AGENT LOOP INTEGRATION

**Scope:** Wire all new systems into unified agent runtime

**Affected:**
- `packages/agent/src/runtime.ts` (major refactor) - Integrate memory, learning, lineage, routing
- `packages/agent/src/index.ts` (modify) - Update public API

**Done-Check:** Full agent loop runs with all systems active, no regressions

**Rationale:** Integration milestone

---

## PHASE 9 — TESTING SUITE

**Scope:** Comprehensive unit + integration tests for new systems

**Affected:**
- `tests/memory.test.ts` (new) - Memory persistence tests
- `tests/learning.test.ts` (new) - Learning loop tests
- `tests/lineage.test.ts` (new) - Lineage tracking tests
- `tests/integration.test.ts` (modify) - End-to-end scenarios

**Done-Check:** Test suite passes with >80% coverage on new code

**Rationale:** Validate correctness

---

## PHASE 10 — DOCUMENTATION & VALIDATION

**Scope:** Update docs, final Hermès parity comparison

**Affected:**
- `README.md` (new) - Architecture overview
- `docs/ARCHITECTURE.md` (new) - System design
- `docs/HERMES_COMPARISON.md` (new) - Feature parity matrix

**Done-Check:** Subagent validates all claimed features work, docs accurate

**Rationale:** Deliverable completion

---

## Architectural Decisions

**Memory Backend:** SQLite with FTS5 for full-text search (matches Hermès)

**Learning Strategy:** Frequency-based pattern detection → template-based skill generation

**Prompt Stability:** Stable baseline + diff-based updates (hybrid of OpenCode IR + Hermès tiers)

**Lineage Model:** UUID-based session ancestry + tool result parent pointers

**Routing Logic:** Weighted fallback with exponential backoff (provider health scoring)

---

**Total Phases:** 10 (2-10 as specified, Phase 1 is this plan)

**Estimated Completion:** All phases executable sequentially with automated validation
