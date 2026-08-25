# Hemmers - Universal AI Agent Enhancement Platform & Secure Runtime

**Transform any AI coding agent into a more capable, persistent, and secure assistant.**

Hemmers is an **enhancement layer and secure execution runtime** that integrates with AI coding agents (Claude Code, OpenCode, Pi, Codex, Cline, Hermes, etc.) to provide persistent memory, multi-provider LLM routing, safe tool execution, and fine-grained security policies.

---

## 📊 Feature Status & Implementation Matrix

| Component | Status | Details & Implementation Notes |
|---|---|---|
| **Packaging & Build** | `implemented` | Unified `hemmers` package, ES module architecture, `main`/`bin`/`exports`, tested with `npm pack` |
| **Security Engine** | `implemented` | Path traversal protection, SSRF guard, command spawn without shell concatenation, approval tokens, audit logging with secret redaction |
| **Permission System** | `implemented` | Scoped permission evaluation where `deny` strictly takes precedence over `allow` |
| **Persistent Memory** | `implemented` | SQLite-backed cross-session memory with versioned migrations, foreign key constraints, atomic turn transactions, and FTS5 search |
| **Enhanced Memory Store** | `implemented` | Memory scopes, importance scoring, TTL-based expiration, deduplication, contradiction detection, and consolidation |
| **Model Providers** | `implemented` | Canonical message model across Anthropic, OpenAI, Google, and Ollama; preserves system messages and formats tool calls |
| **Agent Runtime Loop** | `implemented` | Autonomous execution turn, streaming support with token counting, safe tool argument parsing, max turn/output limits |
| **CLI & Diagnostics** | `implemented` | `init`, `agents`, `doctor`, `add`, `remove`, `list`, `search`, `profile` with `--json` automation support and exit codes |
| **Agent Adapters** | `partial` | Detection and capability scoring for Claude Code, OpenCode, Pi, Codex, Cline, Hermes, Antigravity |
| **Autonomous Learning** | `partial` | Pattern frequency and confidence scoring in `LearningEngine` |
| **MCP Integration** | `partial` | Model Context Protocol client transport stubs |
| **Multi-Agent Orchestration** | `partial` | Task handoff and sub-agent execution coordination in `MultiAgentOrchestrator` |

---

## 🚀 Quick Start

### 1. Installation & Build

```bash
# Clone the repository
git clone https://github.com/zakmijo2-dotcom/Hermmers-agent.git
cd Hermmers-agent

# Install dependencies
npm install

# Typecheck and build
npm run typecheck
npm run build

# Run automated test suite
npm test
```

### 2. CLI Usage

```bash
# Check system health and environment
npx hemmers doctor

# Output diagnostics as JSON
npx hemmers doctor --json

# Initialize Hemmers and detect installed agents
npx hemmers init

# Inspect detected agents and capability rankings
npx hemmers agents

# Search and install skills
npx hemmers search coder
npx hemmers add senior-coder

# List installed skills
npx hemmers list

# List and activate profiles
npx hemmers profile --list
npx hemmers profile senior-developer
```

---

## 🔒 Security Architecture

Hemmers enforces a **fail-closed security model** for all tool execution and agent actions:

1. **Path Traversal Protection**: All filesystem access is normalized, canonicalized, and checked against the `workspaceRoot` using `resolveSafePath()`. Escaping via `../`, symlinks, or absolute paths outside the workspace is blocked.
2. **Command Injection Prevention**: Process execution uses `safeSpawn()` with discrete argument arrays without shell concatenation (`shell: false`). Commands are validated against an allowlist and checked for dangerous patterns.
3. **SSRF Guard**: `httpRequestTool` blocks requests to private IPv4/IPv6 ranges (e.g. `127.0.0.0/8`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`, `localhost`) by default.
4. **Credential & Secret Protection**: Outbound sensitive headers (`Authorization`, `Cookie`, `X-Api-Key`) and sensitive environment variables (`*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, `OPENAI_*`, `ANTHROPIC_*`) are redacted from logs and blocked unless explicitly authorized.
5. **Approval Tokens**: High-risk actions require cryptographic `ApprovalToken` instances linked to a SHA-256 hash of the request and an expiration timestamp.
6. **Rule Precedence**: In the policy engine, `deny` rules **always** override `allow` rules.

---

## 🧠 Memory & Sessions System

- **Storage Engine**: SQLite with versioned schema migrations (`schema_migrations`), WAL mode, and enforced foreign keys.
- **Atomic Transactions**: Turns, tool calls, and tool outputs are recorded in a single database transaction (`recordTurnTransaction`) ensuring consistency.
- **Genealogy Tracking**: Sessions record `parentSessionId` to enable cross-session lineage and ancestor history traversal.
- **Enhanced Scopes**: `GLOBAL`, `ORGANIZATION`, `PROJECT`, `SESSION`, `AGENT`.
- **Quality Controls**: TTL expiration (`expireOldMemories`), content deduplication (`deduplicate`), and semantic contradiction detection (`detectContradictions`).

---

## 🤖 Supported Model Providers

All providers adhere to the canonical `Message` and `ToolCall` contract:

- **Anthropic**: Supports Claude 3.5 / 3.7 Sonnet, Claude 3 Opus with native tool use blocks and system prompt extraction.
- **OpenAI**: Supports GPT-4o, GPT-4o-mini, o1, o3-mini with function tool calling.
- **Google AI**: Supports Gemini 2.0 Flash, Gemini 1.5 Pro with `systemInstruction` and `functionCall` formatting.
- **Ollama**: Supports local models (e.g. `llama3.2`, `qwen2.5-coder`, `deepseek-r1`) via the `/api/chat` endpoint.

---

## 📁 Repository Layout

```
Hemmers-agent/
├── hemmers/
│   ├── core/
│   │   ├── runtime/         # AgentRuntime and HemmersAgent loop
│   │   ├── providers/       # Anthropic, OpenAI, Google, Ollama, Factory
│   │   ├── memory/          # SQLite adapter, MemoryStore, EnhancedMemoryStore
│   │   ├── tools/           # Standard and extended tools, ToolEngine
│   │   ├── security/        # SecurityEngine, safety utilities, approval tokens
│   │   ├── permissions/     # PermissionManager with deny precedence
│   │   ├── skills/          # SkillManager and SkillRegistry
│   │   ├── context/         # ContextEngine and segmentation
│   │   ├── hooks/           # HookEngine lifecycle hooks
│   │   ├── learning/        # Pattern detection and skill generation
│   │   ├── profiles/        # ProfileManager
│   │   └── orchestration/   # Multi-agent orchestrator
│   ├── adapters/            # Agent integration adapters (Claude Code, Pi, etc.)
│   ├── cli/                 # CLI entrypoint and commands (init, doctor, agents, etc.)
│   ├── mcp/                 # Model Context Protocol client
│   └── protocol/            # Universal agent protocol
├── tests/
│   ├── unit/                # Unit tests for security, memory, tools, providers
│   ├── integration/         # Integration tests for agent loop and adapters
│   └── security/            # Security bypass prevention tests
├── .github/workflows/       # GitHub Actions CI workflow
├── package.json             # Unified package configuration
└── tsconfig.json            # Strict TypeScript configuration
```

---

## 🧪 Testing

```bash
# Run the entire test suite (55+ tests)
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run security bypass prevention tests
npm run test:security
```

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
