/**
 * Hermes Adapter
 * Integrates Hemmers with Hermes Agent
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
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class HermesAdapter extends BaseAdapter {
  readonly id = 'hermes';
  readonly name = 'Hermes';
  readonly supportedVersions = '>=1.0.0';

  private hermesHome: string;

  constructor() {
    super();
    this.hermesHome = process.env.HERMES_HOME || join(homedir(), '.hermes');
  }

  async detect(): Promise<AgentDetection> {
    const hermesConfig = join(this.hermesHome, 'config.json');
    const detected = existsSync(hermesConfig);

    return {
      name: this.name,
      path: detected ? this.hermesHome : '',
      detected,
      configPath: detected ? hermesConfig : undefined
    };
  }

  async capabilities(): Promise<AgentCapabilities> {
    await this.ensureDetected();
    return CapabilityDetector.detectHermes(this.hermesHome);
  }

  async install(): Promise<void> {
    await this.ensureDetected();
    const hemmersDir = join(this.hermesHome, 'hemmers');
    mkdirSync(hemmersDir, { recursive: true });
    console.log(`✅ Hemmers installed for Hermes`);
  }

  async uninstall(): Promise<void> {
    const hemmersDir = join(this.hermesHome, 'hemmers');
    if (existsSync(hemmersDir)) {
      const { rmSync } = await import('fs');
      rmSync(hemmersDir, { recursive: true, force: true });
    }
  }

  async configure(config: HemmersConfig): Promise<void> {
    await this.ensureDetected();
    writeFileSync(
      join(this.hermesHome, 'hemmers', 'config.json'),
      JSON.stringify(config, null, 2)
    );
  }

  async healthCheck(): Promise<HealthStatus> {
    const detection = await this.detect();
    return {
      healthy: detection.detected,
      issues: detection.detected ? undefined : ['Hermes not detected']
    };
  }

  async registerSkill(skill: Skill): Promise<void> {
    console.log(`⚠️  Hermes has native skills - integration pending`);
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
  async hasNativeMemory(): Promise<boolean> { return true; }
}
