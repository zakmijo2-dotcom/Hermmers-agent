# MIJ Agent Harness - Test Coverage

## Test Suite Overview

The mij harness includes comprehensive validation tests for all major systems:

### Phase 2: Memory Persistence (`phase2-validate.ts`)
- **Coverage**: Memory store, session management, FTS search
- **Tests**:
  - Session creation with 3 turns
  - Memory persistence across runs (6 memories)
  - FTS search for "Eiffel Tower" (2 results)
  - Session genealogy tracking (parent→child)

### Phase 3: Learning Loop (`phase3-validate.ts`)
- **Coverage**: Pattern detection, skill generation, skill persistence
- **Tests**:
  - Pattern detection after 5 identical tool calls
  - Skill generation with 0.85 confidence
  - Skill persistence to disk and reload
  - Skill refinement (0.85 → 0.90 confidence)

### Phase 4: Stable Context (`phase4-validate.ts`)
- **Coverage**: Prompt stability, cache management
- **Tests**:
  - Baseline stable over 3 turns (0 cache breaks)
  - Baseline rebuild on skill change (1 break)
  - 10 turns with varying context (1 break max)
  - Cache metrics API

### Phase 5: Lineage Tracking (`phase5-validate.ts`)
- **Coverage**: Session genealogy, tool provenance
- **Tests**:
  - Session lineage depth 2 with 2 ancestors
  - Tool execution trace (150ms, success=true)
  - 4 tool executions queried
  - Ancestry path reconstruction
  - 2 descendants tracked
  - Lineage export/import

### Phase 6: Provider Routing (`phase6-validate.ts`)
- **Coverage**: Dynamic provider selection, health tracking, fallback
- **Tests**:
  - Provider selection with fallback chain
  - Model-based selection
  - Successful execution on first attempt
  - Fallback after failure (2 attempts)
  - Health degradation (0.10 after 3 failures)
  - Health-based reordering
  - Health recovery (0.10 → 0.60)
  - Exponential backoff (1003ms)

### Phase 7: Observable Execution (`phase7-validate.ts`)
- **Coverage**: Event subscription, progress tracking, console output
- **Tests**:
  - Event subscription and emission
  - Unsubscribe mechanism
  - All-event subscription (3 events)
  - Runtime event emission (3 events during turn)
  - Progress tracker (3 updates, 100%)
  - Console observer formatting
  - Event type filtering

### Phase 8: Integration (`phase8-validate.ts`)
- **Coverage**: Full system integration, end-to-end validation
- **Tests**:
  - Runtime creation with all systems
  - 6 turns executed across sessions
  - 5 tool executions with lineage
  - 21 memories persisted
  - 1 skill learned
  - 0 cache breaks
  - Child session with depth=1
  - 5 event types observed
  - No regressions

## Running Tests

```bash
# Run all tests
npm test

# Run specific phase
npm run test:memory
npm run test:learning
npm run test:context
npm run test:lineage
npm run test:routing
npm run test:observable
npm run test:integration

# Type check only
npm run typecheck
```

## Coverage Metrics

- **Unit tests**: Individual system validation (Phases 2-7)
- **Integration tests**: Full system validation (Phase 8)
- **Systems covered**: 7/7 (Memory, Learning, Context, Lineage, Routing, Observable, Integration)
- **Total test cases**: 50+ assertions across all phases

## Test Infrastructure

- **Framework**: Node.js native test runner via tsx
- **Assertions**: Custom validation with detailed error messages
- **Cleanup**: Automatic temp file cleanup on pass/fail
- **Observability**: Console output with progress indicators
