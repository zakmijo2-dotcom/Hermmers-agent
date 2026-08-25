/**
 * Codex Adapter
 * Integrates Hemmers with Codex agent
 */

import { BaseAdapter } from '../adapter-api.js';
import {
  AgentDetection,
  AgentCapabilities,
  Skill,
  Hook,
  Tool,
  HemmersConfig,
  HealthStatus
} from '../../core/types/index.js';
import { CapabilityDetector } from '../capabilities.js';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class CodexAdapter extends BaseAdapter {
  readonly id = 'codex';
  readonly name = 'Codex';
  readonly supportedVersions = '>=1.0.0';

  private codexHome: string;
  private hemmersDir: string;

  constructor() {
    super();
    this.codexHome = join(homedir(), '.codex');
    this.hemmersDir = join(this.codexHome, 'hemmers');
  }

  async detect(): Promise<AgentDetection> {
    const codexConfig = join(this.codexHome, 'config.json');
    const detected = existsSync(codexConfig);

    if (!detected) {
      return { name: this.name, path: '', detected: false };
    }

    let version: string | undefined;
    try {
      const config = JSON.parse(readFileSync(codexConfig, 'utf-8'));
      version = config.version;
    } catch {}

    return {
      name: this.name,
      version,
      path: this.codexHome,
      detected: true,
      configPath: codexConfig
    };
  }

  async capabilities(): Promise<AgentCapabilities> {
    await this.ensureDetected();
    return CapabilityDetector.detectCodex(this.codexHome);
  }

  async install(): Promise<void> {
    await this.ensureDetected();
    mkdirSync(this.hemmersDir, { recursive: true });
    mkdirSync(join(this.hemmersDir, 'skills'), { recursive: true });

    writeFileSync(
      join(this.hemmersDir, 'manifest.json'),
      JSON.stringify({
        name: 'hemmers',
        version: '0.1.0',
        description: 'Universal AI Agent Enhancement Platform'
      }, null, 2)
    );

    console.log(`✅ Hemmers installed for Codex`);
  }

  async uninstall(): Promise<void> {
    if (existsSync(this.hemmersDir)) {
      const { rmSync } = await import('fs');
      rmSync(this.hemmersDir, { recursive: true, force: true });
    }
  }

  async configure(config: HemmersConfig): Promise<void> {
    await this.ensureDetected();
    writeFileSync(
      join(this.hemmersDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );
  }

  async healthCheck(): Promise<HealthStatus> {
    const detection = await this.detect();
    if (!detection.detected) {
      return { healthy: false, issues: ['Codex not detected'] };
    }

    const issues: string[] = [];
    if (!existsSync(this.hemmersDir)) {
      issues.push('Hemmers not installed');
    }

    return {
      healthy: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  async registerSkill(skill: Skill): Promise<void> {
    await this.ensureDetected();
    const skillPath = join(this.hemmersDir, 'skills', `${skill.name}.json`);
    writeFileSync(skillPath, JSON.stringify(skill, null, 2));
  }

  async unregisterSkill(skillName: string): Promise<void> {
    const skillPath = join(this.hemmersDir, 'skills', `${skillName}.json`);
    if (existsSync(skillPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(skillPath);
    }
  }

  async listSkills(): Promise<string[]> {
    const skillsDir = join(this.hemmersDir, 'skills');
    if (!existsSync(skillsDir)) return [];

    const { readdirSync } = await import('fs');
    return readdirSync(skillsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  translateSkill(skill: Skill): any {
    return skill;
  }

  async registerHook(hook: Hook): Promise<void> {
    console.log(`⚠️  Hook registration for Codex not yet implemented`);
  }

  async unregisterHook(hookId: string): Promise<void> {}

  translateHook(hook: Hook): any {
    return hook;
  }

  async registerTool(tool: Tool): Promise<void> {
    console.log(`⚠️  Tool registration for Codex not yet implemented`);
  }

  async unregisterTool(toolName: string): Promise<void> {}

  async injectMemory(memories: any[], maxTokens?: number): Promise<void> {
    console.log(`⚠️  Memory injection for Codex not yet implemented`);
  }

  async hasNativeMemory(): Promise<boolean> {
    return false;
  }
}
