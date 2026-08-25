/**
 * Hemmers Agent Adapter Interface
 * Universal adapter contract for all AI coding agents
 */

import {
  AgentDetection,
  AgentCapabilities,
  Skill,
  Hook,
  Tool,
  HemmersConfig,
  HealthStatus,
  DiagnosticReport
} from '../core/types/index.js';

/**
 * AgentAdapter - Universal interface for agent integration
 *
 * Each AI coding agent (Claude Code, OpenCode, Pi, etc.) implements this interface
 * to enable Hemmers enhancement capabilities.
 */
export interface AgentAdapter {
  /**
   * Unique identifier for this adapter
   */
  readonly id: string;

  /**
   * Human-readable name
   */
  readonly name: string;

  /**
   * Supported agent version range (semver)
   */
  readonly supportedVersions: string;

  // ==================== DISCOVERY ====================

  /**
   * Detect if target agent is installed and accessible
   * Should check for executable, config files, or other indicators
   */
  detect(): Promise<AgentDetection>;

  /**
   * Query what capabilities this agent supports natively
   * Returns what the agent can do WITHOUT Hemmers compatibility layers
   */
  capabilities(): Promise<AgentCapabilities>;

  // ==================== LIFECYCLE ====================

  /**
   * Install Hemmers integration into the target agent
   * May involve:
   * - Installing plugin
   * - Adding config files
   * - Setting up hooks
   * - Creating directories
   */
  install(): Promise<void>;

  /**
   * Remove Hemmers integration from target agent
   * Should cleanly remove all Hemmers-related modifications
   */
  uninstall(): Promise<void>;

  /**
   * Configure Hemmers integration with agent-specific settings
   */
  configure(config: HemmersConfig): Promise<void>;

  /**
   * Verify integration health
   * Checks if Hemmers is properly integrated and functioning
   */
  healthCheck(): Promise<HealthStatus>;

  // ==================== SKILL INTEGRATION ====================

  /**
   * Register a Hemmers skill with the target agent
   *
   * Implementation strategy (in priority order):
   * 1. Use agent's native skill system if available
   * 2. Use plugin/extension API if available
   * 3. Use configuration injection
   * 4. Use compatibility layer as last resort
   */
  registerSkill(skill: Skill): Promise<void>;

  /**
   * Unregister a skill from the target agent
   */
  unregisterSkill(skillName: string): Promise<void>;

  /**
   * List skills currently registered with the agent
   */
  listSkills(): Promise<string[]>;

  /**
   * Translate Hemmers skill to agent-specific format
   * Returns agent-native representation
   */
  translateSkill(skill: Skill): any;

  // ==================== HOOK INTEGRATION ====================

  /**
   * Register a lifecycle hook with the target agent
   *
   * Implementation strategy:
   * 1. Use agent's native hook system
   * 2. Use plugin hooks
   * 3. Use event listeners
   * 4. Use compatibility layer (polling, file watching, etc.)
   */
  registerHook(hook: Hook): Promise<void>;

  /**
   * Unregister a hook
   */
  unregisterHook(hookId: string): Promise<void>;

  /**
   * Translate Hemmers hook to agent-specific format
   */
  translateHook(hook: Hook): any;

  // ==================== TOOL INTEGRATION ====================

  /**
   * Register a tool with the target agent
   *
   * Note: Only register if agent doesn't already provide equivalent functionality
   * Check capabilities first to avoid duplication
   */
  registerTool(tool: Tool): Promise<void>;

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): Promise<void>;

  // ==================== MEMORY INTEGRATION ====================

  /**
   * Inject memory context into agent's prompt
   * Should respect agent's context window and token limits
   *
   * @param memories - Relevant memory entries to inject
   * @param maxTokens - Maximum tokens to use for memory
   */
  injectMemory(memories: any[], maxTokens?: number): Promise<void>;

  /**
   * Check if agent has its own memory system that might conflict
   */
  hasNativeMemory(): Promise<boolean>;

  // ==================== DIAGNOSTICS ====================

  /**
   * Generate comprehensive diagnostic report
   * Useful for debugging integration issues
   */
  getDiagnostics(): Promise<DiagnosticReport>;

  /**
   * Get adapter-specific configuration
   * Returns current settings for this adapter
   */
  getConfig(): Promise<Record<string, any>>;
}

/**
 * AdapterFactory - Creates adapter instances
 */
export interface AdapterFactory {
  /**
   * Create an adapter for the specified agent
   * @param agentId - Agent identifier (e.g., 'claude-code', 'opencode')
   */
  createAdapter(agentId: string): AgentAdapter | null;

  /**
   * List all available adapters
   */
  listAdapters(): string[];

  /**
   * Register a custom adapter
   */
  registerAdapter(adapter: AgentAdapter): void;
}

/**
 * BaseAdapter - Abstract base class with common functionality
 * Concrete adapters should extend this
 */
export abstract class BaseAdapter implements AgentAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly supportedVersions: string;

  abstract detect(): Promise<AgentDetection>;
  abstract capabilities(): Promise<AgentCapabilities>;
  abstract install(): Promise<void>;
  abstract uninstall(): Promise<void>;
  abstract configure(config: HemmersConfig): Promise<void>;
  abstract healthCheck(): Promise<HealthStatus>;
  abstract registerSkill(skill: Skill): Promise<void>;
  abstract unregisterSkill(skillName: string): Promise<void>;
  abstract listSkills(): Promise<string[]>;
  abstract translateSkill(skill: Skill): any;
  abstract registerHook(hook: Hook): Promise<void>;
  abstract unregisterHook(hookId: string): Promise<void>;
  abstract translateHook(hook: Hook): any;
  abstract registerTool(tool: Tool): Promise<void>;
  abstract unregisterTool(toolName: string): Promise<void>;
  abstract injectMemory(memories: any[], maxTokens?: number): Promise<void>;
  abstract hasNativeMemory(): Promise<boolean>;

  async getDiagnostics(): Promise<DiagnosticReport> {
    const detection = await this.detect();
    const capabilities = await this.capabilities();
    const health = await this.healthCheck();
    const skills = await this.listSkills();

    return {
      agent: this.name,
      capabilities,
      health,
      installedSkills: skills,
      installedHooks: [],
      installedTools: []
    };
  }

  async getConfig(): Promise<Record<string, any>> {
    return {};
  }

  /**
   * Helper: Check if agent supports a capability
   */
  protected async supportsCapability(capability: keyof AgentCapabilities): Promise<boolean> {
    const caps = await this.capabilities();
    return caps[capability] === true;
  }

  /**
   * Helper: Throw if agent not detected
   */
  protected async ensureDetected(): Promise<void> {
    const detection = await this.detect();
    if (!detection.detected) {
      throw new Error(`${this.name} not detected. Please install it first.`);
    }
  }
}
