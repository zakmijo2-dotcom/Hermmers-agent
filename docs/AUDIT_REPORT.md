# HEMMERS - Repository Audit Report

## Executive Summary

**Current State:** MIJ is a prototype agent runtime (~2000 LOC TypeScript) built to demonstrate Hermès-style features.

**Critical Finding:** This is NOT a universal agent enhancement platform. It's a single standalone runtime coupled to its own execution loop.

**Recommendation:** Complete architectural redesign required to transform into Hemmers Universal AI Agent Enhancement Platform.

---

## 1. CURRENT ARCHITECTURE

### What Exists

```
mij/
├── packages/agent/src/
│   ├── runtime.ts              # Monolithic agent loop (207 LOC)
│   ├── memory-store.ts         # SQLite + FTS5 (273 LOC)
│   ├── memory-interface.ts     # Memory API (112 LOC)
│   ├── learning-engine.ts      # Pattern detection (220 LOC)
│   ├── skill-manager.ts        # JSON skill CRUD (110 LOC)
│   ├── context-stable.ts       # Prompt management (174 LOC)
│   ├── lineage.ts             # Session genealogy (223 LOC)
│   ├── provider-router.ts     # Health-based routing (284 LOC)
│   └── execution-observer.ts  # Event system (222 LOC)
├── tests/                     # 7 validation tests (all passing)
└── docs/                      # Documentation
```

**Total Source:** ~2000 LOC  
**Dependencies:** better-sqlite3 only  
**Tests:** 7/7 passing  
**Type Errors:** 2 minor (null checks)

### Architecture Pattern

**Current:** Monolithic runtime with integrated subsystems

```
AgentRuntime
    ├── owns MemoryStore
    ├── owns LearningEngine
    ├── owns SkillManager
    ├── owns ContextManager
    ├── owns LineageTracker
    ├── owns ProviderRouter
    └── owns ExecutionObserver
```

**Problem:** This is a complete agent, not an enhancement layer.

---

## 2. CRITICAL PROBLEMS

### P1: Architectural Coupling

❌ **Runtime is the Agent**
- `runtime.ts` contains `executeTurn()` - the main agent loop
- Cannot enhance external agents - it IS the agent
- No adapter system whatsoever
- No agent detection
- No compatibility layer

❌ **No Agent Abstraction**
- Zero code for detecting Claude Code, OpenCode, Pi, etc.
- No plugin/hook registration for external agents
- No capability detection
- No agent-agnostic interfaces

❌ **Tight Coupling**
- Memory directly accessed via `this.memory['store']`
- Learning engine directly calls memory internals
- Context manager embedded in runtime
- No clean boundaries

### P2: Mock/Placeholder Implementations

❌ **Learning Engine (Line 63)**
```typescript
// Calculate success rate (placeholder - would check tool_result success)
const successRate = 0.85; // Mock for now
```
**Impact:** Learning is fake. Success rate is hardcoded, not calculated from actual outcomes.

❌ **Provider Router**
- Has health tracking infrastructure
- But no actual LLM provider connections
- Tests mock the execution function
- Never calls real OpenAI/Anthropic/etc APIs

❌ **Skill Application**
- Skills generated but never actually executed
- Trigger matching is string-based pattern only
- No progressive disclosure
- No compatibility checks

### P3: Missing Core Components

❌ **No Adapter System**
- Zero code for agent detection
- No Claude Code integration
- No OpenCode integration
- No plugin installation
- No capability negotiation

❌ **No Registry**
- Skills stored as raw JSON files
- No versioning
- No dependency resolution
- No compatibility metadata
- No package management

❌ **No Hooks**
- Event system exists (ExecutionObserver)
- But no lifecycle hooks for external agents
- No before/after interception
- No agent-native hook translation

❌ **No Tools**
- Provider router exists but no actual tools
- No filesystem operations
- No shell execution
- No git integration
- No web access

❌ **No Profiles**
- No composable configuration
- No preset combinations
- No profile management

❌ **No CLI**
- Tests run via npm scripts
- No `hemmers` command
- No init/add/remove/doctor
- No agent detection workflow

❌ **No Permissions**
- No permission model
- No allow/deny/ask logic
- No scoped access control
- Skills have no declared permissions

### P4: Context Intelligence Issues

⚠️ **Context Manager**
- `context-stable.ts` manages baseline + updates
- But no token estimation
- No compaction triggers
- No retrieval strategies
- Simple fingerprint-based caching only

### P5: Memory Limitations

⚠️ **Memory Store**
- SQLite + FTS5 ✅ Good foundation
- But no importance scoring
- No relevance-based retrieval
- No memory expiration
- No scoped memory (project vs session vs global)
- Always loads from single session

### P6: Skill System Issues

⚠️ **Skill Manager**
- Simple JSON files ✅ Works
- But no validation
- No version control
- No dependency tracking
- No compatibility checks
- No progressive disclosure
- Auto-generated names like `auto_readFile_1787516582965`

---

## 3. REUSABLE COMPONENTS

### ✅ Keep & Refactor

**Memory Store (memory-store.ts)**
- SQLite schema is solid
- FTS5 integration works
- Session genealogy implemented
- **Action:** Extract to `core/memory/` with clean interface

**Execution Observer (execution-observer.ts)**
- Event system is well-designed
- Type-safe callbacks
- Progress tracking structure
- **Action:** Extract to `core/events/` and expand for hooks

**Lineage Tracker (lineage.ts)**
- Session genealogy works
- Tool provenance tracked
- Export/import supported
- **Action:** Move to `core/memory/lineage.ts`

**Skill Manager Structure**
- JSON persistence works
- CRUD operations clean
- **Action:** Rebuild in `core/skills/` with versioning

### ⚠️ Refactor Heavily

**Learning Engine**
- Pattern detection logic ✅ Good concept
- Success rate calculation ❌ Mocked
- **Action:** Rebuild with real evaluation pipeline

**Provider Router**
- Health tracking ✅ Good design
- Fallback chains ✅ Solid logic
- **Action:** Separate health tracking from LLM calls

**Context Manager**
- Baseline + updates ✅ Good pattern
- **Action:** Add token estimation, compaction triggers

### ❌ Remove/Replace

**Runtime (runtime.ts)**
- This is a complete agent loop
- **Action:** Delete and rebuild as enhancement coordinator

---

## 4. DEPENDENCY ANALYSIS

**Current:**
- `better-sqlite3` (11.0.0) - ✅ Keep
- `typescript` (5.4.0) - ✅ Keep
- `tsx` (4.0.0) - ✅ Keep for dev

**Missing Critical:**
- No CLI framework (commander, yargs)
- No package manager logic
- No git operations
- No filesystem utilities (fs-extra)
- No YAML/config parsing
- No semver for versioning
- No MCP SDK

**Size:** 110MB (mostly node_modules)  
**Termux:** Should work, SQLite native module

---

## 5. TEST ANALYSIS

### Coverage

✅ **All 7 tests passing**
- Phase 2: Memory persistence
- Phase 3: Learning (but with mocked success rates)
- Phase 4: Context stability
- Phase 5: Lineage tracking
- Phase 6: Provider routing (mocked execution)
- Phase 7: Observable execution
- Phase 8: Integration

### Quality

⚠️ **Tests validate prototype behavior, not production requirements**
- Tests pass because they test the mocks
- No tests for agent adapters (none exist)
- No tests for registry (none exists)
- No tests for CLI (none exists)
- No tests for hooks (none exist)
- No tests for tools (none exist)
- No tests for permissions (none exist)

**Action:** Keep test structure, rewrite tests for new architecture

---

## 6. PROPOSED HEMMERS ARCHITECTURE

### Core Boundaries

```
hemmers/
├── core/
│   ├── runtime/           # Enhancement coordinator (NOT agent loop)
│   ├── memory/            # Refactored from memory-store
│   ├── learning/          # Rebuilt learning engine
│   ├── skills/            # Skill manager + registry
│   ├── context/           # Context intelligence engine
│   ├── hooks/             # Lifecycle hook system
│   ├── tools/             # Tool abstraction (not implementations)
│   ├── workflows/         # Workflow engine (new)
│   ├── profiles/          # Profile manager (new)
│   ├── registry/          # Package registry (new)
│   ├── permissions/       # Permission model (new)
│   └── events/            # Refactored execution-observer
│
├── adapters/              # Agent-specific integrations
│   ├── adapter-api.ts     # AgentAdapter interface
│   ├── claude-code/       # Claude Code adapter
│   ├── codex/             # Codex adapter
│   ├── opencode/          # OpenCode adapter
│   ├── pi/                # Pi adapter
│   ├── cline/             # Cline adapter
│   ├── hermes/            # Hermes adapter
│   └── antigravity/       # Antigravity adapter
│
├── cli/                   # hemmers command
│   ├── commands/
│   │   ├── init.ts
│   │   ├── add.ts
│   │   ├── remove.ts
│   │   ├── doctor.ts
│   │   ├── profile.ts
│   │   └── search.ts
│   └── index.ts
│
├── skills/                # Official skills
│   ├── ui-ux-pro-max/
│   ├── caveman/
│   ├── senior-coder/
│   └── ...
│
└── tests/
    ├── unit/
    ├── integration/
    └── adapters/
```

### Key Changes

**Before:**
```
User → MIJ Runtime → Memory/Learning/Skills
```

**After:**
```
User → hemmers CLI → Agent Adapter → Claude Code/OpenCode/Pi/etc.
                          ↓
                    Core Enhancement Layer
                    (Memory, Skills, Learning, Context, Hooks)
```

---

## 7. ADAPTER API DESIGN

```typescript
interface AgentAdapter {
  // Discovery
  detect(): Promise<AgentDetection>;
  capabilities(): AgentCapabilities;
  
  // Lifecycle
  install(): Promise<void>;
  uninstall(): Promise<void>;
  configure(config: HemmersConfig): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  
  // Integration
  registerSkill(skill: Skill): Promise<void>;
  registerHook(hook: Hook): Promise<void>;
  registerTool(tool: Tool): Promise<void>;
  
  // Translation
  translateSkill(skill: Skill): AgentSpecificSkill;
  translateHook(hook: Hook): AgentSpecificHook;
  
  // Diagnostics
  getDiagnostics(): Promise<DiagnosticReport>;
}

interface AgentCapabilities {
  skills: boolean;
  hooks: boolean;
  tools: boolean;
  mcp: boolean;
  commands: boolean;
  agents: boolean;
  config: boolean;
}
```

---

## 8. PROBLEMS TO SOLVE

### Critical Path

1. **Agent Independence**
   - How to enhance without replacing?
   - Where does agent reasoning end and Hemmers begin?
   - How to inject memory/skills without breaking agent?

2. **Capability Detection**
   - Different agents have different extension APIs
   - Claude Code: plugins
   - OpenCode: skills/agents/commands
   - Pi: hooks
   - Hermes: native skills
   - How to detect what's available?

3. **Memory Injection**
   - When to inject memory into prompt?
   - How to avoid token bloat?
   - How to ensure relevance?
   - How to preserve agent's own memory?

4. **Skill Activation**
   - When is a skill relevant?
   - How to avoid injecting all skills?
   - How to trigger at the right time?
   - How to handle agent-specific formats?

5. **Hook Translation**
   - Hemmers lifecycle events → Agent-native hooks
   - How to handle missing hook support?
   - Compatibility layer design?

6. **Tool Coordination**
   - Should Hemmers provide tools?
   - Or only enhance existing tools?
   - How to avoid duplication?
   - How to handle tool conflicts?

---

## 9. PHASE 1 IMPLEMENTATION PLAN

### Scope: Core Architecture + Adapter API

**Objectives:**
1. Establish clean core boundaries
2. Define AgentAdapter interface
3. Build capability detection system
4. Create stub adapters for 3 agents
5. Preserve working memory/lineage systems
6. Remove agent loop (runtime.ts)

### Files to Create

```
hemmers/
├── core/
│   ├── types.ts              # Core type definitions
│   ├── coordinator.ts        # Replaces runtime.ts
│   └── config.ts             # Configuration management
│
├── adapters/
│   ├── adapter-api.ts        # AgentAdapter interface
│   ├── capabilities.ts       # Capability detection
│   ├── registry.ts           # Adapter registry
│   │
│   ├── claude-code/
│   │   ├── adapter.ts
│   │   ├── detector.ts
│   │   └── capabilities.ts
│   │
│   ├── opencode/
│   │   ├── adapter.ts
│   │   ├── detector.ts
│   │   └── capabilities.ts
│   │
│   └── pi/
│       ├── adapter.ts
│       ├── detector.ts
│       └── capabilities.ts
│
└── cli/
    ├── index.ts              # Basic CLI entry
    └── commands/
        ├── init.ts           # Agent detection
        └── agents.ts         # List detected agents
```

### Files to Move

```
packages/agent/src/memory-store.ts     → core/memory/store.ts
packages/agent/src/memory-interface.ts → core/memory/interface.ts
packages/agent/src/lineage.ts          → core/memory/lineage.ts
packages/agent/src/execution-observer.ts → core/events/observer.ts
```

### Files to Refactor

```
packages/agent/src/skill-manager.ts    → core/skills/manager.ts (add versioning)
packages/agent/src/learning-engine.ts  → core/learning/engine.ts (fix mocks)
packages/agent/src/context-stable.ts   → core/context/manager.ts (add token estimation)
packages/agent/src/provider-router.ts  → Keep for health tracking only
```

### Files to Delete

```
packages/agent/src/runtime.ts          # This IS an agent, not an enhancer
```

### Tests to Update

```
tests/phase2-validate.ts → tests/unit/memory.test.ts
tests/phase5-validate.ts → tests/unit/lineage.test.ts
tests/phase7-validate.ts → tests/unit/events.test.ts
```

### New Tests to Create

```
tests/adapters/claude-code.test.ts
tests/adapters/opencode.test.ts
tests/adapters/pi.test.ts
tests/integration/adapter-lifecycle.test.ts
```

---

## 10. PHASE 1 ACCEPTANCE CRITERIA

✅ **Architecture**
- [ ] Core modules have zero dependencies on adapters
- [ ] AgentAdapter interface defined with full type safety
- [ ] Capability detection works for 3 agents
- [ ] Adapter registry can register/list adapters

✅ **Detection**
- [ ] Can detect if Claude Code is installed
- [ ] Can detect if OpenCode is installed
- [ ] Can detect if Pi is installed
- [ ] Reports capabilities accurately

✅ **CLI**
- [ ] `hemmers init` runs and detects agents
- [ ] `hemmers agents` lists detected agents with capabilities
- [ ] Clean error messages when no agents found

✅ **Testing**
- [ ] All existing memory tests still pass
- [ ] All existing lineage tests still pass
- [ ] New adapter detection tests pass
- [ ] No regressions in working components

✅ **Quality**
- [ ] Zero TypeScript errors
- [ ] All tests passing
- [ ] Architecture documented
- [ ] Clean module boundaries validated

---

## 11. RISK ASSESSMENT

### High Risk

🔴 **Paradigm Shift**
- Current code is a complete agent
- New architecture is an enhancement layer
- Almost complete rewrite required
- Cannot incrementally migrate

🔴 **Agent API Unknowns**
- Don't know exact plugin APIs for all agents
- Need to research each agent's extension system
- May discover incompatible architectures

### Medium Risk

🟡 **Scope Creep**
- Easy to rebuild another agent instead of enhancement layer
- Need discipline to avoid feature duplication
- Must respect agent boundaries

🟡 **Testing Complexity**
- Need to test with real agents installed
- May need mocked agents for CI
- Integration testing will be complex

### Low Risk

🟢 **Core Components**
- Memory store is solid
- Event system works well
- Can preserve these with minimal changes

---

## 12. RECOMMENDATION

### Proceed with Complete Redesign

**Rationale:**
- Current codebase is ~2000 LOC prototype
- Core concepts (memory, lineage, events) are salvageable
- But architecture is fundamentally wrong for Hemmers vision
- Cannot incrementally fix - needs clean slate with clear boundaries

**Approach:**
1. Start Phase 1 as defined above
2. Preserve working subsystems (memory, lineage, events)
3. Delete agent loop (runtime.ts)
4. Build adapter architecture from scratch
5. Validate with 3 real agent detectors before continuing

**Timeline Estimate:**
- Phase 1: Core + Adapters (3-5 days)
- Phase 2-8: As defined in task (10-15 days)
- Total: ~2-3 weeks for production-grade foundation

**Alternative (NOT RECOMMENDED):**
- Keep as MIJ prototype agent
- Document as learning exercise
- Start Hemmers from scratch in new repo
- **Why not:** Wastes the good components already built

---

## FINAL VERDICT

**Current State:** Well-executed prototype demonstrating concepts  
**Hemmers Readiness:** 20% (good components, wrong architecture)  
**Action Required:** Systematic transformation, not incremental fixes  
**Confidence:** High (clear path, salvageable components, good test coverage)

**Proceed with Phase 1 implementation?**
