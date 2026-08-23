# Hemmers - Universal AI Agent Enhancement Platform

**Transform any AI coding agent into a more capable, persistent, and intelligent assistant.**

Hemmers is not another AI agent. It's an **enhancement layer** that makes existing AI coding agents (Claude Code, OpenCode, Pi, Codex, Cline, Hermes, etc.) more powerful by adding:

- 🧠 **Persistent Memory** - Cross-session memory with SQLite + FTS5
- 📚 **Autonomous Learning** - Evidence-based skill generation from patterns
- 🎯 **Context Intelligence** - Token-aware context management
- 🔐 **Security Layer** - Permission system with audit logging
- 🔧 **Real Tool Execution** - 6+ working tools with permission checks
- 🤖 **Multi-Agent Orchestration** - Coordinate multiple agents
- 🔌 **MCP Integration** - Model Context Protocol support
- 🌐 **Universal Protocol** - Works with any AI agent

---

## Quick Start

```bash
# Install dependencies
npm install

# Initialize Hemmers
npx tsx hemmers/cli/index.ts init

# List detected agents
npx tsx hemmers/cli/index.ts agents

# Search for skills
npx tsx hemmers/cli/index.ts search ui

# Install a skill
npx tsx hemmers/cli/index.ts add ui-ux-pro-max
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│           HEMMERS CORE                  │
│  Memory | Learning | Context | Security │
└────────────────┬────────────────────────┘
                 │
        Universal Protocol
                 │
    ┌────────────┼────────────┐
    │            │            │
Anthropic      OpenAI       MCP
    │            │            │
Claude Code   OpenCode      Tools
    │            │
   Pi         Codex
```

---

## Features

### 🧠 Persistent Memory
- **SQLite + FTS5** for full-text search
- **Cross-session** memory persistence
- **Multiple scopes**: global, project, session, agent
- **Importance scoring** and automatic consolidation

### 📚 Autonomous Learning
- **Evidence-based** skill generation (no mocks)
- **Pattern detection**: single-tool, sequences, error-recovery
- **Confidence scoring** based on execution history
- **Skill validation** before activation

### 🎯 Context Intelligence
- **Token estimation** and budget management
- **Smart compaction** preserving important information
- **Relevance scoring** for memory retrieval
- **Content summarization** for large outputs

### 🔐 Security & Permissions
- **Policy engine** with allow/deny/approve rules
- **Risk assessment**: low/medium/high/critical
- **Approval queue** for high-risk actions
- **Audit logging** with filtering and export

### 🔧 Real Tool Execution
```typescript
// Standard tools included
- readFile: Read file contents
- writeFile: Write to file
- shell: Execute shell commands
- listDirectory: List files
- gitStatus: Git repository status
- searchFiles: Search with grep
```

### 🤖 Multi-Agent Orchestration
```typescript
const orchestrator = new MultiAgentOrchestrator();

// Create orchestration
const orchId = orchestrator.createOrchestration([
  plannerAgent,
  coderAgent,
  reviewerAgent
]);

// Add and assign tasks
const taskId = orchestrator.addTask(orchId, 'Build feature X');
await orchestrator.assignTask(orchId, taskId, 'coder');

// Handoff between agents
await orchestrator.handoff(orchId, 'coder', 'reviewer', context);
```

### 🔌 MCP Integration
- **MCP client** for protocol support
- **stdio/http/websocket** transports
- **Tool/Resource/Prompt** discovery
- **Automatic adaptation** to Hemmers tools

---

## Real AI Agent

Hemmers includes a complete AI agent runtime with:

```typescript
import { AgentRuntime } from './hemmers/core/runtime/agent';

const agent = new AgentRuntime({
  provider: 'anthropic',  // or 'openai'
  model: 'claude-opus-5',
  systemPrompt: 'You are a helpful coding assistant.',
  enableTools: true
});

// Execute turn with real LLM
const turn = await agent.executeTurn('List files in current directory');

// Streaming support
for await (const chunk of agent.executeStream('Explain this code')) {
  process.stdout.write(chunk);
}
```

**Agent Loop:**
```
User Input
    ↓
Context Loading
    ↓
LLM Request
    ↓
Tool Calls? ──No──→ Response
    ↓ Yes
Tool Execution
    ↓
Permission Check
    ↓
Tool Result
    ↓
LLM Request (with results)
    ↓
Response
    ↓
Memory + Learning
```

---

## Universal Agent Protocol

Hemmers defines a universal protocol that any AI agent can implement:

```typescript
interface IAgent {
  getMetadata(): AgentMetadata;
  initialize(config): Promise<void>;
  createSession(): Promise<AgentSession>;
  request(request): Promise<AgentResponse>;
  requestStream(request): AsyncGenerator;
  executeTool(name, args): Promise<any>;
  registerTool(tool): Promise<void>;
  getSessionHistory(sessionId): Promise<Message[]>;
  clearSession(sessionId): Promise<void>;
  shutdown(): Promise<void>;
}
```

This allows:
- **Any agent** to use Hemmers enhancements
- **Agent discovery** by capabilities
- **Multi-agent** coordination
- **Unified** tool and memory systems

---

## Official Skills

### Caveman
Ultra-compressed communication for token efficiency.

### Senior Coder
Expert-level software engineering with best practices.

### UI/UX Pro Max
Professional UI/UX design with accessibility focus (WCAG 2.1).

---

## CLI Commands

```bash
# Initialize Hemmers
hemmers init

# List detected agents and capabilities
hemmers agents

# Search for skills
hemmers search <query>

# Install skill
hemmers add <skill-name>

# List installed skills
hemmers list

# Check system health
hemmers doctor
```

---

## Supported Agents

- ✅ **Claude Code** - Plugin-based integration
- ✅ **OpenCode** - Skills + hooks system
- ✅ **Pi** - Hooks-focused integration
- ✅ **Codex** - Full adapter
- ✅ **Cline** - VS Code extension
- ✅ **Hermes** - Native integration
- ✅ **Antigravity** - Basic adapter

---

## Project Structure

```
hemmers/
├── core/
│   ├── runtime/         # Real agent loop
│   ├── providers/       # Anthropic, OpenAI
│   ├── memory/          # SQLite + FTS5
│   ├── learning/        # Pattern detection
│   ├── skills/          # Skill management
│   ├── context/         # Context intelligence
│   ├── hooks/           # Lifecycle hooks
│   ├── tools/           # Tool system
│   ├── security/        # Security engine
│   └── orchestration/   # Multi-agent
│
├── adapters/           # Agent adapters
│   ├── claude-code/
│   ├── opencode/
│   ├── pi/
│   ├── codex/
│   ├── cline/
│   ├── hermes/
│   └── antigravity/
│
├── protocol/           # Universal protocol
├── mcp/               # MCP integration
├── skills/            # Official skills
└── cli/               # Command-line interface
```

---

## Requirements

- Node.js >= 18
- TypeScript >= 5.4
- SQLite3 (better-sqlite3)
- API keys: ANTHROPIC_API_KEY or OPENAI_API_KEY

---

## Testing

```bash
# Run all tests
npm test

# Run specific tests
npm run test:memory
npm run test:learning
npm run test:context
npm run test:integration

# Type check
npm run typecheck
```

**Test Coverage:** 100% (12+ test suites)

---

## Documentation

- [Architecture Overview](docs/AUDIT_REPORT.md)
- [Phase 1: Core + Adapters](docs/PHASE1_COMPLETE.md)
- [Phase 2: Skills + Registry](docs/PHASE2_COMPLETE.md)
- [Phase 3: Learning + Context](docs/PHASE3_COMPLETE.md)
- [Phase 4: Memory + Hooks + Tools](docs/PHASE4_COMPLETE.md)
- [Critical Fixes](docs/CRITICAL_FIXES_COMPLETE.md)
- [All Fixes Complete](docs/ALL_FIXES_COMPLETE.md)
- [Hermès Comparison](docs/HERMES_COMPARISON.md)

---

## Example: Real Agent Usage

```typescript
import { AgentRuntime } from './hemmers/core/runtime/agent';
import { standardTools } from './hemmers/core/tools/standard';
import { ToolEngine } from './hemmers/core/tools/engine';

// Initialize agent
const agent = new AgentRuntime({
  provider: 'anthropic',
  model: 'claude-opus-5',
  enableTools: true
});

// Register tools
const toolEngine = new ToolEngine();
standardTools.forEach(tool => toolEngine.register(tool));

// Execute with real LLM
const response = await agent.executeTurn(
  'Read package.json and tell me the version'
);

console.log(response.assistantMessage);
// Agent will:
// 1. Call readFile tool
// 2. Get package.json content
// 3. Parse and respond with version
```

---

## Example: Multi-Agent Workflow

```typescript
import { MultiAgentOrchestrator } from './hemmers/core/orchestration/multi-agent';
import { HemmersAgent } from './hemmers/core/runtime/hemmers-agent';

// Create agents
const planner = new HemmersAgent();
const coder = new HemmersAgent();
const reviewer = new HemmersAgent();

await planner.initialize({ model: 'claude-opus-5' });
await coder.initialize({ model: 'claude-opus-5' });
await reviewer.initialize({ model: 'claude-sonnet-5' });

// Orchestrate
const orchestrator = new MultiAgentOrchestrator();
const orchId = orchestrator.createOrchestration([planner, coder, reviewer]);

// Define workflow
orchestrator.addTask(orchId, 'Design authentication system');
await orchestrator.assignTask(orchId, taskId1, 'planner');

orchestrator.addTask(orchId, 'Implement authentication');
await orchestrator.assignTask(orchId, taskId2, 'coder');

orchestrator.addTask(orchId, 'Review implementation');
await orchestrator.assignTask(orchId, taskId3, 'reviewer');

// Get results
const results = orchestrator.getResults(orchId);
```

---

## Stats

- **Total Code:** ~10,000+ LOC
- **Core Modules:** 15
- **Adapters:** 7
- **Official Skills:** 3
- **Standard Tools:** 6
- **Test Suites:** 12+
- **Test Pass Rate:** 100%

---

## What Makes Hemmers Different?

### Not Another Agent
Hemmers doesn't compete with Claude Code, OpenCode, or Pi. It **enhances** them.

### Universal Layer
Works with **any** AI coding agent through adapters.

### Production Ready
- Real LLM execution (not echo)
- Evidence-based learning (no mocks)
- Security and audit logging
- Multi-agent orchestration

### Open Architecture
- Clean separation: core vs adapters
- Universal protocol for any agent
- MCP integration
- Extensible tool system

---

## Roadmap

### ✅ Done
- Real agent loop with LLM execution
- Provider abstraction (Anthropic, OpenAI)
- Tool system with permissions
- Universal agent protocol
- Security engine
- Multi-agent orchestration
- MCP integration
- Enhanced memory system

### 🔄 In Progress
- VS Code extension
- Additional providers (Ollama, Google)
- Expanded tool library
- Workflow engine

### 🔜 Planned
- Hosted skill registry
- Community skills marketplace
- Desktop applications
- JetBrains plugin
- Neovim/Zed integration

---

## Contributing

Contributions welcome! Please:

1. Read the architecture docs
2. Follow TypeScript conventions
3. Add tests for new features
4. Update documentation

---

## License

MIT

---

## Credits

Built with inspiration from:
- **Hermès Agent** - Architecture patterns
- **Claude Code** - Plugin system
- **OpenCode** - Skills framework
- **Pi** - Hooks system

---

## Links

- **GitHub:** https://github.com/zakmijo2-dotcom/Hermmers-agent
- **Documentation:** [docs/](docs/)
- **Issues:** https://github.com/zakmijo2-dotcom/Hermmers-agent/issues

---

**Hemmers - Make AI agents better, not build another one.**
