/**
 * Cline Adapter
 * Integrates Hemmers with Cline (VS Code extension)
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
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class ClineAdapter extends BaseAdapter {
  readonly id = 'cline';
  readonly name = 'Cline';
  readonly supportedVersions = '>=1.0.0';

  private vscodeDir: string;
  private hemmersDir: string;

  constructor() {
    super();
    this.vscodeDir = join(homedir(), '.vscode');
    this.hemmersDir = join(this.vscodeDir, 'hemmers');
  }

  async detect(): Promise<AgentDetection> {
    // Cline is VS Code extension - check for settings
    const settingsPath = join(this.vscodeDir, 'settings.json');
    const detected = existsSync(settingsPath);

    return {
      name: this.name,
      path: detected ? this.vscodeDir : '',
      detected
    };
  }

  async capabilities(): Promise<AgentCapabilities> {
    await this.ensureDetected();
    return CapabilityDetector.detectCline(this.vscodeDir);
  }

  async install(): Promise<void> {
    await this.ensureDetected();
    mkdirSync(this.hemmersDir, { recursive: true });
    console.log(`✅ Hemmers installed for Cline`);
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
    return {
      healthy: detection.detected,
      issues: detection.detected ? undefined : ['Cline not detected']
    };
  }

  async registerSkill(skill: Skill): Promise<void> {
    console.log(`⚠️  Skill registration for Cline not yet fully implemented`);
  }

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
