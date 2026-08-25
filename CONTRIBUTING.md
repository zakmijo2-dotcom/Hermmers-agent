# Contributing to Hemmers

Thank you for your interest in contributing to Hemmers! We welcome contributions to help make AI coding agents more capable, persistent, and secure.

## Development Workflow

### 1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. Setup
```bash
git clone https://github.com/zakmijo2-dotcom/Hermmers-agent.git
cd Hermmers-agent
npm install
```

### 3. Verification & Quality Gates
Before submitting a pull request, ensure all checks pass:

```bash
# Typecheck
npm run typecheck

# Lint
npm run lint

# Run all tests
npm test

# Build
npm run build
```

## Security Guidelines
- Never use `child_process.execSync` or `shell: true` with dynamic user input.
- All file operations must use `resolveSafePath()` to prevent directory traversal.
- Never commit API keys, tokens, or credentials.
- All new sensitive tools must define appropriate permissions and be registered with `SecurityEngine`.

## Coding Standards
- TypeScript in strict mode.
- Avoid using `any`; use strict types, domain interfaces, or `unknown` with type narrowing.
- Write unit tests for new tools, memory operations, and security features.
