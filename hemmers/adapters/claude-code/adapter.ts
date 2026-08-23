/**
 * Claude Code Adapter
 * Integrates Hemmers with Anthropic's Claude Code
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
import { CapabilityDetector } from '../capabilities';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class ClaudeCodeAdapter extends BaseAdapter {
  readonly id = 'claude-code';
  readonly name = 'Claude Code';
  readonly supportedVersions = '>=2.0.0';

  private claudeHome: string;
  private pluginsDir: string;

  constructor() {
    super();
    this.claudeHome = join(homedir(), '.claude');
    this.pluginsDir = join(this.claudeHome, 'plugins', 'hemmers');
  }

  async detect(): Promise<AgentDetection> {
    // Check if Claude Code is installed
    const claudeConfigExists = existsSync(join(this.claudeHome, 'settings.json'));

    if (!claudeConfigExists) {
      return {
        name: this.name,
        path: '',
        detected: false
      };
    }

    // Try to read version from settings
    let version: string | undefined;
    try {
      const settings = JSON.parse(readFileSync(join(this.claudeHome, 'settings.json'), 'utf-8'));
      version = settings.version;
    } catch {}

    return {
      name: this.name,
      version,
      path: this.claudeHome,
      detected: true,
      configPath: join(this.claudeHome, 'settings.json')
    };
  }

  async capabilities(): Promise<AgentCapabilities> {
    await this.ensureDetected();
    return CapabilityDetector.detectClaudeCode(this.claudeHome);
  }

  async install(): Promise<void> {
    await this.ensureDetected();

    // Create Hemmers plugin directory structure
    mkdirSync(this.pluginsDir, { recursive: true });
    mkdirSync(join(this.pluginsDir, 'skills'), { recursive: true });
    mkdirSync(join(this.pluginsDir, 'hooks'), { recursive: true });

    // Create plugin manifest
    const manifest = {
      name: 'hemmers',
      version: '0.1.0',
      description: 'Universal AI Agent Enhancement Platform',
      type: 'plugin',
      capabilities: ['skills', 'hooks', 'tools', 'memory'],
      entrypoint: 'index.js'
    };

    writeFileSync(
      join(this.pluginsDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // Create basic plugin index
    const pluginCode = `
// Hemmers plugin for Claude Code
module.exports = {
  name: 'hemmers',

  onLoad: async (context) => {
    console.log('[Hemmers] Plugin loaded');
  },

  onUnload: async () => {
    console.log('[Hemmers] Plugin unloaded');
  }
};
`;

    writeFileSync(
      join(this.pluginsDir, 'index.js'),
      pluginCode,
      'utf-8'
    );

    console.log(`✅ Hemmers installed for Claude Code at ${this.pluginsDir}`);
  }

  async uninstall(): Promise<void> {
    // Remove plugin directory
    if (existsSync(this.pluginsDir)) {
      const { rmSync } = await import('fs');
      rmSync(this.pluginsDir, { recursive: true, force: true });
      console.log('✅ Hemmers uninstalled from Claude Code');
    }
  }

  async configure(config: HemmersConfig): Promise<void> {
    await this.ensureDetected();

    const configPath = join(this.pluginsDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async healthCheck(): Promise<HealthStatus> {
    const detection = await this.detect();

    if (!detection.detected) {
      return {
        healthy: false,
        issues: ['Claude Code not detected']
      };
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check if plugin directory exists
    if (!existsSync(this.pluginsDir)) {
      issues.push('Hemmers plugin not installed');
    }

    // Check if manifest exists
    if (!existsSync(join(this.pluginsDir, 'manifest.json'))) {
      issues.push('Plugin manifest missing');
    }

    return {
      healthy: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  async registerSkill(skill: Skill): Promise<void> {
    await this.ensureDetected();

    // Convert Hemmers skill to Claude Code skill format
    const claudeSkill = this.translateSkill(skill);

    // Write skill file
    const skillPath = join(this.pluginsDir, 'skills', `${skill.name}.md`);
    writeFileSync(skillPath, claudeSkill, 'utf-8');

    console.log(`✅ Skill "${skill.name}" registered with Claude Code`);
  }

  async unregisterSkill(skillName: string): Promise<void> {
    const skillPath = join(this.pluginsDir, 'skills', `${skillName}.md`);

    if (existsSync(skillPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(skillPath);
      console.log(`✅ Skill "${skillName}" unregistered`);
    }
  }

  async listSkills(): Promise<string[]> {
    const skillsDir = join(this.pluginsDir, 'skills');

    if (!existsSync(skillsDir)) {
      return [];
    }

    const { readdirSync } = await import('fs');
    return readdirSync(skillsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
  }

  translateSkill(skill: Skill): string {
    // Convert to Claude Code skill format (markdown with frontmatter)
    return `---
name: ${skill.name}
version: ${skill.version}
description: ${skill.description}
compatibility: ${skill.compatibility.join(', ')}
permissions: ${skill.permissions.map(p => p.resource).join(', ')}
---

# ${skill.name}

${skill.description}

## Instructions

${skill.instructions}

## Metadata

- Author: ${skill.metadata.author || 'Hemmers'}
- Created: ${new Date(skill.metadata.createdAt).toISOString()}
- Tags: ${skill.metadata.tags?.join(', ') || 'none'}
`;
  }

  async registerHook(hook: Hook): Promise<void> {
    await this.ensureDetected();

    // Claude Code hooks are plugin-based
    const hookPath = join(this.pluginsDir, 'hooks', `${hook.type}.js`);

    const hookCode = `
// Hook: ${hook.type}
module.exports = async (context) => {
  // Hemmers hook handler
  console.log('[Hemmers] Hook triggered: ${hook.type}');

  // Call registered handler
  // Note: Handler needs to be serializable or referenced from registry
};
`;

    writeFileSync(hookPath, hookCode, 'utf-8');
    console.log(`✅ Hook "${hook.type}" registered with Claude Code`);
  }

  async unregisterHook(hookId: string): Promise<void> {
    const hookPath = join(this.pluginsDir, 'hooks', `${hookId}.js`);

    if (existsSync(hookPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(hookPath);
    }
  }

  translateHook(hook: Hook): any {
    // Claude Code hook format
    return {
      type: hook.type,
      priority: hook.priority || 0,
      handler: hook.handler.toString() // Note: Serialization limitations
    };
  }

  async registerTool(tool: Tool): Promise<void> {
    // Claude Code has native tool system
    // Hemmers should only add tools that don't conflict
    console.log(`⚠️  Tool registration for Claude Code not yet implemented`);
  }

  async unregisterTool(toolName: string): Promise<void> {
    // Not implemented yet
  }

  async injectMemory(memories: any[], maxTokens?: number): Promise<void> {
    // Memory injection for Claude Code
    // Would integrate with Claude's context system
    console.log(`⚠️  Memory injection for Claude Code not yet implemented`);
  }

  async hasNativeMemory(): Promise<boolean> {
    // Claude Code has session history but not persistent cross-session memory
    return false;
  }
}
