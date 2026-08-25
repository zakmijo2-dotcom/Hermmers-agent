/**
 * Hemmers Core
 * Universal AI Agent Enhancement Platform & Secure Runtime
 */

// Types
export * from './types/index.js';

// Runtime
export { AgentRuntime, AgentConfig as RuntimeAgentConfig, AgentTurn } from './runtime/agent.js';
export { HemmersAgent } from './runtime/hemmers-agent.js';

// Providers
export {
  ModelProvider,
  ModelCapabilities,
  ModelConfig,
  Message,
  ToolCall,
  ToolResult,
  GenerateRequest,
  ToolDefinition,
  GenerateResponse,
  StreamChunk
} from './providers/base.js';
export { ProviderFactory, ProviderType } from './providers/factory.js';
export { AnthropicProvider } from './providers/anthropic.js';
export { OpenAIProvider } from './providers/openai.js';
export { GoogleProvider } from './providers/google.js';
export { OllamaProvider } from './providers/ollama.js';

// Security & Permissions
export {
  SecurityEngine,
  SecurityPolicy,
  SecurityRule,
  SecurityCondition,
  SecurityAuditLog
} from './security/engine.js';
export {
  PermissionManager,
  PermissionRequest,
  PermissionDecision
} from './permissions/manager.js';

// Tools
export {
  ToolEngine,
  RegisteredTool,
  ToolExecutionResult
} from './tools/engine.js';
export { standardTools } from './tools/standard.js';
export { extendedTools } from './tools/extended.js';
export {
  readFileTool,
  writeFileTool,
  shellTool,
  listDirectoryTool,
  gitStatusTool,
  searchFilesTool
} from './tools/standard.js';
export {
  createDirectoryTool,
  deleteFileTool,
  moveFileTool,
  getFileInfoTool,
  gitCommitTool,
  gitDiffTool,
  gitBranchTool,
  httpRequestTool,
  getCurrentDirectoryTool,
  getEnvironmentVariableTool,
  npmInstallTool
} from './tools/extended.js';

// Memory
export {
  MemoryStore,
  MemoryEntry,
  Session
} from './memory/store.js';
export {
  EnhancedMemoryStore,
  EnhancedMemory,
  MemoryScope,
  MemoryType,
  MemoryConsolidation
} from './memory/enhanced-store.js';
export {
  MemoryInterface,
  MemoryContext
} from './memory/interface.js';
export {
  LineageTracker,
  LineageNode,
  ToolExecutionTrace,
  SessionLineage
} from './memory/lineage.js';

// Context & Hooks
export { ContextEngine, ContextSegment } from './context/engine.js';
export { HookEngine, RegisteredHook } from './hooks/engine.js';

// Skills & Learning
export { SkillManager } from './skills/manager.js';
export { SkillRegistry, SkillPackage } from './skills/registry.js';
export { LearningEngine, LearnedSkill, Pattern, ToolExecution } from './learning/engine.js';

// Profiles & Workflows & Orchestration
export { ProfileManager, Profile as AgentProfile, ProfileConfig } from './profiles/manager.js';
export { WorkflowEngine, Workflow, WorkflowStep, WorkflowExecution, WorkflowBuilder } from './workflows/engine.js';
export { MultiAgentOrchestrator, Orchestration, AgentTask } from './orchestration/multi-agent.js';
