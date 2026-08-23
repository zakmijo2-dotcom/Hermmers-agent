/**
 * Hemmers Core Types
 * Universal type definitions for the enhancement platform
 */

// Agent Detection
export interface AgentDetection {
  name: string;
  version?: string;
  path: string;
  detected: boolean;
  configPath?: string;
}

// Agent Capabilities
export interface AgentCapabilities {
  skills: boolean;           // Can register skills
  hooks: boolean;            // Has lifecycle hooks
  tools: boolean;            // Has tool system
  mcp: boolean;              // Supports Model Context Protocol
  commands: boolean;         // Has command/slash commands
  agents: boolean;           // Has multi-agent support
  config: boolean;           // Has configuration system
  plugins: boolean;          // Has plugin architecture
}

// Skill Definition
export interface Skill {
  name: string;
  version: string;
  description: string;
  instructions: string;
  triggers?: string[];
  compatibility: string[];   // Agent names
  dependencies?: string[];
  permissions: Permission[];
  metadata: SkillMetadata;
}

export interface SkillMetadata {
  author?: string;
  license?: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

// Hook Definition
export interface Hook {
  type: HookType;
  handler: HookHandler;
  priority?: number;
}

export type HookType =
  | 'session_start'
  | 'session_end'
  | 'before_prompt'
  | 'after_prompt'
  | 'before_tool'
  | 'after_tool'
  | 'before_edit'
  | 'after_edit'
  | 'before_commit'
  | 'after_commit'
  | 'error'
  | 'compaction';

export type HookHandler = (context: HookContext) => Promise<void> | void;

export interface HookContext {
  type: HookType;
  data: Record<string, any>;
  agent: string;
}

// Tool Definition
export interface Tool {
  name: string;
  description: string;
  schema: ToolSchema;
  permissions: Permission[];
  execute: ToolExecutor;
  metadata?: Record<string, any>;
}

export interface ToolSchema {
  parameters: Record<string, any>;
  required?: string[];
}

export type ToolExecutor = (params: any, context: ToolContext) => Promise<any>;

export interface ToolContext {
  sessionId: string;
  agent: string;
}

// Permission Model
export interface Permission {
  resource: string;          // e.g., 'filesystem.read', 'shell.execute'
  scope?: string;            // e.g., '/project/*', 'git/*'
}

export type PermissionAction = 'allow' | 'deny' | 'ask';

export interface PermissionRule {
  permission: Permission;
  action: PermissionAction;
}

// Profile Definition
export interface Profile {
  name: string;
  description: string;
  skills: string[];
  hooks: string[];
  tools: string[];
  config: Record<string, any>;
}

// Workflow Definition
export interface Workflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  type: 'tool' | 'skill' | 'prompt';
  target: string;
  params?: any;
}

// Health Status
export interface HealthStatus {
  healthy: boolean;
  issues?: string[];
  warnings?: string[];
}

// Diagnostic Report
export interface DiagnosticReport {
  agent: string;
  capabilities: AgentCapabilities;
  health: HealthStatus;
  installedSkills: string[];
  installedHooks: string[];
  installedTools: string[];
}

// Configuration
export interface HemmersConfig {
  version: string;
  agents: Record<string, AgentConfig>;
  memory: MemoryConfig;
  learning: LearningConfig;
  permissions: PermissionRule[];
}

export interface AgentConfig {
  enabled: boolean;
  adapter: string;
  config?: Record<string, any>;
}

export interface MemoryConfig {
  path: string;
  maxEntries?: number;
  ttl?: number;
}

export interface LearningConfig {
  enabled: boolean;
  threshold: number;
  autoApply: boolean;
}

// Memory Types (from existing system)
export interface MemoryEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  type: 'user_input' | 'agent_response' | 'tool_call' | 'tool_result' | 'skill_learned' | 'context';
  content: string;
  metadata?: Record<string, any>;
  parentId?: string;
}

export interface Session {
  id: string;
  createdAt: number;
  lastAccessedAt: number;
  parentSessionId?: string;
  metadata?: Record<string, any>;
}

// Events (from existing system)
export type EventType =
  | 'turn_start'
  | 'turn_end'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'skill_applied'
  | 'learning_start'
  | 'learning_end'
  | 'hook_triggered'
  | 'error';

export interface Event {
  type: EventType;
  timestamp: number;
  data: Record<string, any>;
}

export type EventCallback = (event: Event) => void | Promise<void>;
