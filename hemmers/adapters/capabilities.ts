/**
 * Capability Detection System
 * Determines what an agent can do natively
 */

import { AgentCapabilities } from '../core/types/index.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Detect agent capabilities by inspecting its installation
 */
export class CapabilityDetector {
  /**
   * Detect capabilities for Claude Code
   */
  static async detectClaudeCode(agentPath: string): Promise<AgentCapabilities> {
    // Claude Code has plugin system
    const pluginDir = join(agentPath, '.claude', 'plugins');
    const hasPlugins = existsSync(pluginDir);

    return {
      skills: hasPlugins, // Via plugins
      hooks: hasPlugins,  // Via plugin hooks
      tools: true,        // Native tool system
      mcp: true,          // Supports MCP
      commands: true,     // Has slash commands
      agents: true,       // Has agent/subagent system
      config: true,       // Has settings.json
      plugins: hasPlugins
    };
  }

  /**
   * Detect capabilities for OpenCode
   */
  static async detectOpenCode(agentPath: string): Promise<AgentCapabilities> {
    const opencodeDir = join(agentPath, '.opencode');
    const hasOpencode = existsSync(opencodeDir);

    return {
      skills: hasOpencode,   // Has skills system
      hooks: hasOpencode,    // Has hooks
      tools: true,           // Has tools
      mcp: true,             // Supports MCP
      commands: hasOpencode, // Has commands
      agents: hasOpencode,   // Has agents
      config: hasOpencode,   // Has config
      plugins: false         // No plugin system (uses skills/agents)
    };
  }

  /**
   * Detect capabilities for Pi
   */
  static async detectPi(agentPath: string): Promise<AgentCapabilities> {
    const piConfig = join(agentPath, '.pi', 'config.json');
    const hasPi = existsSync(piConfig);

    return {
      skills: false,    // No skills system
      hooks: hasPi,     // Has hooks system
      tools: true,      // Has tools
      mcp: true,        // Supports MCP
      commands: false,  // No commands
      agents: false,    // No agents
      config: hasPi,    // Has config
      plugins: false    // No plugins
    };
  }

  /**
   * Detect capabilities for Codex
   */
  static async detectCodex(agentPath: string): Promise<AgentCapabilities> {
    const codexDir = join(agentPath, '.codex');
    const hasCodex = existsSync(codexDir);

    return {
      skills: hasCodex,
      hooks: hasCodex,
      tools: true,
      mcp: true,
      commands: hasCodex,
      agents: hasCodex,
      config: hasCodex,
      plugins: hasCodex
    };
  }

  /**
   * Detect capabilities for Cline
   */
  static async detectCline(agentPath: string): Promise<AgentCapabilities> {
    // Cline is VS Code extension
    const vscodeDir = join(agentPath, '.vscode');
    const hasCline = existsSync(join(vscodeDir, 'settings.json'));

    return {
      skills: false,
      hooks: false,
      tools: true,
      mcp: true,
      commands: false,
      agents: false,
      config: hasCline,
      plugins: false
    };
  }

  /**
   * Detect capabilities for Hermes
   */
  static async detectHermes(agentPath: string): Promise<AgentCapabilities> {
    const hermesHome = process.env.HERMES_HOME || join(agentPath, '.hermes');
    const hasHermes = existsSync(hermesHome);

    return {
      skills: hasHermes,  // Native skills
      hooks: hasHermes,   // Plugin hooks
      tools: true,        // 70+ tools
      mcp: true,          // Supports MCP
      commands: hasHermes,
      agents: false,
      config: hasHermes,
      plugins: hasHermes
    };
  }

  /**
   * Detect capabilities for Antigravity
   */
  static async detectAntigravity(agentPath: string): Promise<AgentCapabilities> {
    // Antigravity detection logic
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

  /**
   * Generic capability detection
   * Tries to infer capabilities from common patterns
   */
  static async detectGeneric(agentPath: string): Promise<AgentCapabilities> {
    // Check for common patterns
    const hasSkills = existsSync(join(agentPath, 'skills')) ||
                     existsSync(join(agentPath, '.skills'));

    const hasHooks = existsSync(join(agentPath, 'hooks')) ||
                    existsSync(join(agentPath, '.hooks'));

    const hasConfig = existsSync(join(agentPath, 'config.json')) ||
                     existsSync(join(agentPath, 'settings.json'));

    return {
      skills: hasSkills,
      hooks: hasHooks,
      tools: false,  // Unknown
      mcp: false,    // Unknown
      commands: false,
      agents: false,
      config: hasConfig,
      plugins: false
    };
  }
}

/**
 * Capability scorer - ranks agents by capability support
 */
export class CapabilityScorer {
  /**
   * Calculate capability score (0-1)
   */
  static score(capabilities: AgentCapabilities): number {
    const weights = {
      skills: 0.20,
      hooks: 0.20,
      tools: 0.15,
      mcp: 0.15,
      commands: 0.10,
      agents: 0.10,
      config: 0.05,
      plugins: 0.05
    };

    let score = 0;
    for (const [key, weight] of Object.entries(weights)) {
      if (capabilities[key as keyof AgentCapabilities]) {
        score += weight;
      }
    }

    return score;
  }

  /**
   * Rank multiple agents by capability score
   */
  static rank(agents: Array<{ name: string; capabilities: AgentCapabilities }>): Array<{ name: string; score: number }> {
    return agents
      .map(agent => ({
        name: agent.name,
        score: this.score(agent.capabilities)
      }))
      .sort((a, b) => b.score - a.score);
  }
}
