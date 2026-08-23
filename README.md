# MIJ Agent Harness

**Custom agent harness built from OpenCode base, targeting Hermès-level architecture**

## Overview

MIJ is a TypeScript-based AI agent runtime with advanced features for persistent memory, autonomous learning, stable context management, and execution observability. It combines the best architectural patterns from Hermès Agent with a clean, modern TypeScript implementation.

## Key Features

### 🧠 Persistent Memory (Phase 2)
- SQLite-backed storage with FTS5 full-text search
- Session genealogy tracking across runs
- Cross-session memory persistence and retrieval

### 📚 Learning Loop (Phase 3)
- Autonomous skill generation from execution patterns
- Pattern detection for single tools and tool sequences
- Skill refinement based on execution outcomes
- JSON-based skill persistence

### 🎯 Stable Context (Phase 4)
- Baseline + incremental updates pattern
- Minimal cache breaks (only on skill changes)
- Fingerprint-based change detection
- Addresses "constant re-explanation" pain point

### 🔗 Lineage Tracking (Phase 5)
- Session genealogy with parent/child relationships
- Tool execution provenance with duration and success tracking
- Ancestry path reconstruction
- Export/import for persistence

### 🌐 Adaptive Provider Routing (Phase 6)
- Dynamic provider selection with health scoring
- Automatic fallback chains (up to 3 fallbacks)
- Exponential backoff on failures
- Health-based provider reordering

### 👁️ Observable Execution (Phase 7)
- Event-driven progress updates
- Type-safe event subscription system
- Progress tracking for multi-step operations
- CLI-friendly console observer

### ✅ Comprehensive Testing (Phase 9)
- 7 test modules with 50+ assertions
- Unit and integration test coverage
- Automated test runner
- All systems validated end-to-end

## Architecture

```
packages/agent/src/
├── memory-store.ts          # SQLite + FTS5 storage
├── memory-interface.ts      # High-level memory API
├── learning-engine.ts       # Pattern detection + skill generation
├── skill-manager.ts         # Skill CRUD operations
├── context-stable.ts        # Stable prompt system
├── lineage.ts              # Session + tool provenance
├── provider-router.ts      # Adaptive routing with fallback
├── execution-observer.ts   # Observable execution events
└── runtime.ts              # Core agent loop integration
```

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run specific test
npm run test:integration

# Type check
npm run typecheck
```

## Usage Example

```typescript
import { AgentRuntime, ExecutionObserver, ConsoleObserver } from '@mij/agent';

// Setup observable execution
const observer = new ExecutionObserver();
const consoleObs = new ConsoleObserver(true);
observer.onAll(consoleObs.getCallback());

// Create runtime with all systems enabled
const runtime = new AgentRuntime({
  memoryPath: './data/memory.db',
  skillsDir: './skills',
  enableLearning: true,
  systemInstructions: 'You are a helpful AI assistant.',
  observer
});

// Execute turns
await runtime.executeTurn('What can you help me with?');
await runtime.executeTurn('Remember that my name is Alice');
await runtime.executeTurn('What was my name again?');

// Access subsystems
const lineage = runtime.getLineageTracker();
const metrics = runtime.getCacheMetrics();
const skills = runtime['skillManager'].getAllSkills();

runtime.close();
```

## Hermès Comparison

### ✅ Implemented Features

| Feature | Hermès | MIJ | Status |
|---------|--------|-----|--------|
| Persistent Memory | SQLite + FTS5 | SQLite + FTS5 | ✅ Parity |
| Learning Loop | Auto skill creation | Auto skill creation | ✅ Parity |
| Session Genealogy | Parent/child tracking | Parent/child tracking | ✅ Parity |
| Prompt Stability | Stable baseline | Stable baseline | ✅ Parity |
| Provider Fallback | Fallback chains | Fallback chains | ✅ Parity |
| Observable Execution | Callback-driven | Event-driven | ✅ Enhanced |
| Lineage Tracking | Tool provenance | Tool + session provenance | ✅ Enhanced |

### 📊 Performance Metrics (from validation)

- **Cache efficiency**: 0 breaks over 6 turns (stable baseline)
- **Memory persistence**: 21 memories across sessions
- **Learning**: 1 skill auto-generated from 5 tool executions
- **Health recovery**: 0.10 → 0.60 after 5 successes
- **Fallback latency**: 1003ms with exponential backoff

### 🚫 Not Implemented

- Messaging platform gateway (Telegram, Discord, etc.) - out of scope
- Scheduled conversations (cron-based) - could be added
- 70+ built-in tools - would need tool implementations
- MCP integration - would need protocol implementation

## Design Decisions

**Memory Backend**: SQLite with FTS5 matches Hermès exactly

**Learning Strategy**: Frequency-based pattern detection → template-based skill generation

**Prompt Stability**: Hybrid of OpenCode's IR system + Hermès' tiered prompts

**Lineage Model**: UUID-based ancestry + parent pointers for tool results

**Routing Logic**: Weighted fallback with health scoring (70% health, 30% priority)

## Testing

All 7 test phases passing with comprehensive coverage:

```bash
npm test
```

See `tests/README.md` for detailed test documentation.

## Project Structure

```
mij/
├── packages/agent/          # Core agent runtime
│   ├── src/                # Source files
│   └── package.json
├── tests/                  # Validation tests
│   ├── phase2-validate.ts  # Memory
│   ├── phase3-validate.ts  # Learning
│   ├── phase4-validate.ts  # Context
│   ├── phase5-validate.ts  # Lineage
│   ├── phase6-validate.ts  # Routing
│   ├── phase7-validate.ts  # Observable
│   ├── phase8-validate.ts  # Integration
│   ├── run-all.ts         # Test runner
│   └── README.md          # Test docs
├── docs/
│   └── BUILD_PLAN.md      # Phase breakdown
├── package.json
├── tsconfig.json
└── README.md              # This file
```

## License

MIT

## Build History

- **Phase 1**: Discovery & architectural planning
- **Phase 2**: SQLite-backed persistent memory
- **Phase 3**: Learning loop with skill auto-generation
- **Phase 4**: Stable prompt system
- **Phase 5**: Lineage tracking
- **Phase 6**: Adaptive provider routing
- **Phase 7**: Observable execution
- **Phase 8**: Core loop integration
- **Phase 9**: Testing & validation suite
- **Phase 10**: Documentation & final review

All phases completed with validation passing.
