# Changelog

All notable changes to the Hemmers project will be documented in this file.

## [0.1.0] - 2026-08-25

### Packaging & Build
- Unified package naming from legacy `mij` / `@mij/agent` to canonical `hemmers`.
- Consolidated `package.json` and `tsconfig.json`, removing duplicate manifest files.
- Added ES module entrypoints: `hemmers/core/index.ts` and `hemmers/index.ts`.
- Configured binary entrypoint `./dist/cli/index.js` for CLI executable.
- Added dual-driver SQLite support for `better-sqlite3` and Node.js native `node:sqlite`.
- Verified `npm pack` and tarball installation into clean isolated directories.

### Security Hardening
- Replaced dangerous `child_process.execSync` and shell interpolation with secure `safeSpawn()` using argument arrays and `shell: false`.
- Implemented `resolveSafePath()` to enforce path canonicalization and workspace root isolation, preventing path traversal attacks.
- Added SSRF protection to `httpRequestTool`, rejecting requests to private IP ranges, loopback addresses, and cloud metadata services by default.
- Implemented sensitive header protection, blocking `Authorization`, `Cookie`, and API keys from outbound requests without explicit authorization.
- Added environment variable filtering and redaction for secrets (`*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`, `OPENAI_*`, `ANTHROPIC_*`).
- Introduced cryptographic `ApprovalToken` system linked to SHA-256 request hashes with TTL expiration.
- Added `SecurityAuditLog` with automatic secret redaction.
- Enforced `deny` rule precedence over `allow` across all security and permission evaluations.
- Integrated mandatory `SecurityEngine` checks into `ToolEngine.execute()`.

### Memory & Sessions
- Unified memory implementations into canonical `MemoryStore` and `EnhancedMemoryStore`.
- Added versioned SQLite schema migrations (`schema_migrations` table).
- Enforced `FOREIGN KEY` constraints and WAL journal mode.
- Implemented atomic turn transactions (`recordTurnTransaction`) capturing user inputs, assistant responses, and tool executions.
- Implemented session genealogy tracking with `parentSessionId` and ancestry inspection.
- Implemented real `EnhancedMemoryStore` features: memory scopes, importance decay/boost, TTL expiration, deduplication, contradiction detection, and consolidation.
- Removed legacy duplicate `packages/agent` directory.

### Model Providers & Agent Loop
- Standardized canonical `Message` and `ToolCall` contract across Anthropic, OpenAI, Google AI, and Ollama.
- Fixed message conversion: system instructions preserved at top-level and tool calls/results mapped to provider-native blocks.
- Added bounded retry with exponential backoff and `AbortSignal` timeout handling.
- Enhanced `AgentRuntime` with autonomous multi-turn execution, streaming support with token counting, safe tool argument parsing, and maximum turn/output size limits.

### CLI & Testing
- Implemented `hemmers doctor` with full system diagnostics and `--json` machine-readable output.
- Implemented `hemmers remove` and `hemmers profile` commands with exit code handling.
- Replaced custom test scripts with native Node test runner (`node:test`).
- Added 55+ comprehensive tests covering unit, integration, and security bypass prevention.
- Added GitHub Actions CI workflow for multiple Node versions and OS platforms.
