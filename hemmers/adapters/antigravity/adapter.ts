/**
 * Antigravity Adapter (stub)
 */

import { BaseAdapter } from '../adapter-api';
import {
  AgentDetection,
  AgentCapabilities,
  Skill,
  Hook,
  Tool,
  HemmersConfig,
  HealthStatus
} from '../../core/types';

export class AntigravityAdapter extends BaseAdapter {
  readonly id = 'antigravity';
  readonly name = 'Antigravity';
  readonly supportedVersions = '>=1.0.0';

  async detect(): Promise<AgentDetection> {
    return { name: this.name, path: '', detected: false };
  }

  async capabilities(): Promise<AgentCapabilities> {
    return {
      skills: false,
      hooks: false,
      tools: true,
      mcp: false,
      commands: false,
      agents: false,
      config: true,
      plugins: false
    };
  }

  async install(): Promise<void> {}
  async uninstall(): Promise<void> {}
  async configure(config: HemmersConfig): Promise<void> {}
  async healthCheck(): Promise<HealthStatus> {
    return { healthy: false, issues: ['Not detected'] };
  }

  async registerSkill(skill: Skill): Promise<void> {}
  async unregisterSkill(skillName: string): Promise<void> {}
  async listSkills(): Promise<string[]> { return []; }
  translateSkill(skill: Skill): any { return skill; }
  async registerHook(hook: Hook): Promise<void> {}
  async unregisterHook(hookId: string): Promise<void> {}
  translateHook(hook: Hook): any { return hook; }
  async registerTool(tool: Tool): Promise<void> {}
  async unregisterTool(toolName: string): Promise<void> {}
  async injectMemory(memories: any[], maxTokens?: number): Promise<void> {}
  async hasNativeMemory(): Promise<boolean> { return false; }
}
