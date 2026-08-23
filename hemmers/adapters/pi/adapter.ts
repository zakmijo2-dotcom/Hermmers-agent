/**
 * Pi Adapter
 * Integrates Hemmers with Pi agent
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

export class PiAdapter extends BaseAdapter {
  readonly id = 'pi';
  readonly name = 'Pi';
  readonly supportedVersions = '>=0.1.0';

  private piHome: string;
  private hooksDir: string;

  constructor() {
    super();
    this.piHome = join(homedir(), '.pi');
    this.hooksDir = join(this.piHome, 'hooks', 'hemmers');
  }

  async detect(): Promise<AgentDetection> {
    // Pi uses .pi/config.json
    const piConfigPath = join(this.piHome, 'config.json');
    const piConfigExists = existsSync(piConfigPath);

    if (!piConfigExists) {
      return {
        name: this.name,
        path: '',
        detected: false
      };
    }

    let version: string | undefined;
    try {
      const config = JSON.parse(readFileSync(piConfigPath, 'utf-8'));
      version = config.version;
    } catch {}

    return {
      name: this.name,
      version,
      path: this.piHome,
      detected: true,
      configPath: piConfigPath
    };
  }

  async capabilities(): Promise<AgentCapabilities> {
    await this.ensureDetected();
    return CapabilityDetector.detectPi(this.piHome);
  }

  async install(): Promise<void> {
    await this.ensureDetected();

    // Pi focuses on hooks system
    mkdirSync(this.hooksDir, { recursive: true });

    // Create Hemmers hook manifest
    const manifest = {
      name: 'hemmers',
      version: '0.1.0',
      description: 'Universal AI Agent Enhancement Platform',
      hooks: [
        'session_start',
        'session_end',
        'before_prompt',
        'after_prompt',
        'before_tool',
        'after_tool'
      ]
    };

    writeFileSync(
      join(this.hooksDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    console.log(`✅ Hemmers installed for Pi at ${this.hooksDir}`);
  }

  async uninstall(): Promise<void> {
    if (existsSync(this.hooksDir)) {
      const { rmSync } = await import('fs');
      rmSync(this.hooksDir, { recursive: true, force: true });
      console.log('✅ Hemmers uninstalled from Pi');
    }
  }

  async configure(config: HemmersConfig): Promise<void> {
    await this.ensureDetected();

    const configPath = join(this.hooksDir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  async healthCheck(): Promise<HealthStatus> {
    const detection = await this.detect();

    if (!detection.detected) {
      return {
        healthy: false,
        issues: ['Pi not detected']
      };
    }

    const issues: string[] = [];

    if (!existsSync(this.hooksDir)) {
      issues.push('Hemmers hooks directory not found');
    }

    return {
      healthy: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined
    };
  }

  async registerSkill(skill: Skill): Promise<void> {
    // Pi doesn't have native skills system
    // Store as JSON for Hemmers to manage
    const skillsDir = join(this.hooksDir, 'skills');
    mkdirSync(skillsDir, { recursive: true });

    const skillPath = join(skillsDir, `${skill.name}.json`);
    writeFileSync(skillPath, JSON.stringify(skill, null, 2), 'utf-8');

    console.log(`✅ Skill "${skill.name}" registered with Pi (Hemmers-managed)`);
  }

  async unregisterSkill(skillName: string): Promise<void> {
    const skillPath = join(this.hooksDir, 'skills', `${skillName}.json`);

    if (existsSync(skillPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(skillPath);
    }
  }

  async listSkills(): Promise<string[]> {
    const skillsDir = join(this.hooksDir, 'skills');

    if (!existsSync(skillsDir)) {
      return [];
    }

    const { readdirSync } = await import('fs');
    return readdirSync(skillsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  }

  translateSkill(skill: Skill): any {
    // Pi doesn't have native skill format
    // Return as-is for Hemmers management
    return skill;
  }

  async registerHook(hook: Hook): Promise<void> {
    await this.ensureDetected();

    // Pi has native hooks system
    const hookPath = join(this.hooksDir, `${hook.type}.ts`);

    // Pi hook format (TypeScript)
    const hookCode = `
import { HookContext } from '@pi/types';

// Hemmers hook: ${hook.type}
export default async (context: HookContext) => {
  console.log('[Hemmers] Hook triggered: ${hook.type}');

  // Hook logic
  // Note: Actual handler needs to be implemented based on hook type
};
`;

    writeFileSync(hookPath, hookCode, 'utf-8');
    console.log(`✅ Hook "${hook.type}" registered with Pi`);
  }

  async unregisterHook(hookId: string): Promise<void> {
    const hookPath = join(this.hooksDir, `${hookId}.ts`);

    if (existsSync(hookPath)) {
      const { unlinkSync } = await import('fs');
      unlinkSync(hookPath);
    }
  }

  translateHook(hook: Hook): any {
    // Pi hook format
    return {
      type: hook.type,
      priority: hook.priority || 0,
      handler: 'async'
    };
  }

  async registerTool(tool: Tool): Promise<void> {
    console.log(`⚠️  Tool registration for Pi not yet implemented`);
  }

  async unregisterTool(toolName: string): Promise<void> {
    // Not implemented
  }

  async injectMemory(memories: any[], maxTokens?: number): Promise<void> {
    // Pi memory injection would use hooks
    console.log(`⚠️  Memory injection for Pi not yet implemented`);
  }

  async hasNativeMemory(): Promise<boolean> {
    return false;
  }
}
