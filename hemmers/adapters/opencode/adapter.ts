/**
 * OpenCode Adapter
 * Integrates Hemmers with OpenCode agent
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

export class OpenCodeAdapter extends BaseAdapter {
  readonly id = 'opencode';
  readonly name = 'OpenCode';
  readonly supportedVersions = '>=1.0.0';

  private opencodeHome: string;
  private skillsDir: string;

  constructor() {
    super();
    this.opencodeHome = join(homedir(), '.opencode');
    this.skillsDir = join(this.opencodeHome, 'skills', 'hemmers');
  }

  async detect(): Promise<AgentDetection> {
    // Check if OpenCode is installed
    const opencodeConfigExists = existsSync(join(this.opencodeHome, 'config.json'));

    if (!opencodeConfigExists) {
      return {
        name: this.name,
        path: '',
        detected: false
      };
    }

    let version: string | undefined;
    try {
      const config = JSON.parse(readFileSync(join(this.opencodeHome, 'config.json'), 'utf-8'));
      version = config.version;
    } catch {}

    return {
      name: this.name,
      version,
      path: this.opencodeHome,
      detected: true,
      configPath: join(this.opencodeHome, 'config.json')
    };
  }

  async capabilities(): Promise<AgentCapabilities> {
    await this.ensureDetected();
    return CapabilityDetector.detectOpenCode(this.opencodeHome);
  }

  async install(): Promise<void> {
    await this.ensureDetected();

    // Create Hemmers skill directory for OpenCode
    mkdirSync(this.skillsDir, { recursive: true });

    // Create SKILL.md manifest (OpenCode skill format)
    const skillManifest = `# Hemmers Enhancement Platform

Universal AI agent enhancement layer for OpenCode.

Provides:
- Persistent memory across sessions
- Autonomous learning from patterns
- Context intelligence
- Skill management
- Workflow orchestration

Version: 0.1.0
Compatibility: OpenCode >= 1.0.0
`;

    writeFileSync(
      join(this.skillsDir, 'SKILL.md'),
      skillManifest,
      'utf-8'
    );

    console.log(`✅ Hemmers installed for OpenCode at ${this.skillsDir}`);
  }

  async uninstall(): Promise<void> {
    if (existsSync(this.skillsDir)) {
      const { rmSync } = await import('fs');
      rmSync(this.skillsDir, { recursive: true, force: true });
      console.log('✅ Hemmers uninstalled from OpenCode');
    }
  }

  async configure(config: HemmersConfig): Promise<void> {
    await this.ensureDetected();

    const configPath = join(this.skillsDir, 'hemmers-config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async healthCheck(): Promise<HealthStatus> {
    const detection = await this.detect();

    if (!detection.detected) {
      return {
        healthy: false,
        issues: ['OpenCode not detected']
      };
    }

    const issues: string[] = [];

    if (!existsSync(this.skillsDir)) {
      issues.push('Hemmers skills directory not found');
    }

    if (!existsSync(join(this.skillsDir, 'SKILL.md'))) {
      issues.push('Hemmers skill manifest missing');
    }

    return {
      healthy: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  async registerSkill(skill: Skill): Promise<void> {
    await this.ensureDetected();

    // OpenCode uses SKILL.md format
    const skillContent = this.translateSkill(skill);
    const skillPath = join(this.skillsDir, `${skill.name}.md`);

    writeFileSync(skillPath, skillContent, 'utf-8');
    console.log(`✅ Skill "${skill.name}" registered with OpenCode`);
  }

  async unregisterSkill(skillName: string): Promise<void> {
    const skillPath = join(this.skillsDir, `${skillName}.md`);

    if (existsSync(skillPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(skillPath);
      console.log(`✅ Skill "${skillName}" unregistered`);
    }
  }

  async listSkills(): Promise<string[]> {
    if (!existsSync(this.skillsDir)) {
      return [];
    }

    const { readdirSync } = await import('fs');
    return readdirSync(this.skillsDir)
      .filter(f => f.endsWith('.md') && f !== 'SKILL.md')
      .map(f => f.replace('.md', ''));
  }

  translateSkill(skill: Skill): string {
    // OpenCode SKILL.md format
    return `# ${skill.name}

${skill.description}

**Version:** ${skill.version}
**Compatibility:** ${skill.compatibility.join(', ')}
**Permissions:** ${skill.permissions.map(p => p.resource).join(', ')}

## Instructions

${skill.instructions}

## Triggers

${skill.triggers?.map(t => `- ${t}`).join('\n') || 'Manual activation'}

## Metadata

- Author: ${skill.metadata.author || 'Hemmers'}
- License: ${skill.metadata.license || 'MIT'}
- Tags: ${skill.metadata.tags?.join(', ') || 'none'}
- Created: ${new Date(skill.metadata.createdAt).toISOString()}
`;
  }

  async registerHook(hook: Hook): Promise<void> {
    await this.ensureDetected();

    // OpenCode has hooks directory
    const hooksDir = join(this.opencodeHome, 'hooks');
    mkdirSync(hooksDir, { recursive: true });

    const hookPath = join(hooksDir, `hemmers-${hook.type}.js`);

    // OpenCode hook format
    const hookCode = `
// Hemmers hook: ${hook.type}
module.exports = {
  type: '${hook.type}',
  handler: async (context) => {
    console.log('[Hemmers] Hook triggered: ${hook.type}');
    // Hook logic here
  }
};
`;

    writeFileSync(hookPath, hookCode, 'utf-8');
    console.log(`✅ Hook "${hook.type}" registered with OpenCode`);
  }

  async unregisterHook(hookId: string): Promise<void> {
    const hookPath = join(this.opencodeHome, 'hooks', `hemmers-${hookId}.js`);

    if (existsSync(hookPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(hookPath);
    }
  }

  translateHook(hook: Hook): any {
    return {
      type: hook.type,
      priority: hook.priority || 0
    };
  }

  async registerTool(tool: Tool): Promise<void> {
    console.log(`⚠️  Tool registration for OpenCode not yet implemented`);
  }

  async unregisterTool(toolName: string): Promise<void> {
    // Not implemented
  }

  async injectMemory(memories: any[], maxTokens?: number): Promise<void> {
    console.log(`⚠️  Memory injection for OpenCode not yet implemented`);
  }

  async hasNativeMemory(): Promise<boolean> {
    // OpenCode has context but not persistent memory
    return false;
  }
}
